---
title: "OpenClaw记忆机制：一次缓慢的觉醒"
date: 2026-02-09T13:26:59-08:00
draft: false
slug: "openclaw-memory"
tags: ["AI", "OpenClaw", "memory", "agent"]
---


### OpenClaw 记忆机制的使用体验：一次缓慢的觉醒

这两天高强度地使用了 OpenClaw，也高强度地阅读了它的文档和代码，对它的记忆功能有了更深的了解。我想技术文章不缺我这一篇，所以我决定从使用体验的角度来切入，来还原我是怎么感受到 OpenClaw 这个记忆机制的。

作为辅助说明，我在这里先提一下：我其实到现在还没有安装 OpenClaw 自带的 MemorySearch 相关的工具，就是那些使用到了 AgenticSearch 或者 EmbeddedSearch 的任何 MemorySearch 相关的功能。我想也许因为我想要拥有一手的体验，来了解有 MemorySearch 这个功能对 memory 这件事情的影响到底有多大。

## Sessions：一个看似简单却深刻的设计

OpenClaw 的设计机制其实离不开它的 Sessions 这个概念。如果你去读它官方文档的 Sessions 一页，可以很清楚地看到它的一些设计。简单地说，你与一个 agent 的所有私信占用的是同样的 session。

说到这里，好像还得先介绍一下在 OpenClaw 里面 agent 以及 workspace 这个概念。每一个 agent 都对应有自己的一个 workspace，在那里面存了他的一些初始 prompt，大致可以理解为系统 prompt。然后在这些系统 prompt 里面会有一些文字上的指引，来教 agent 如何维护他自己的 system prompt。

OpenClaw 在最外面的一层，也就是各种 IM 工具，你可以把一个 agent 想象成一个人。一个人可以有很多的 IM 账号，你可以有一个 Discord 账号，可以有你的手机号，可以有一个飞书账号、Telegram 账号。只要使用这些账号的都是同一个 agent，那我们其实就可以认为自己是在跟同一个人说话。

所以说，你如果是通过不同 IM 去私信同一个 agent，他的这整个会话是在同样的一个 session 里面的。也就是说，举个例子，你可以在 Discord 里面问饮食 agent："我们去吃拉面嘛？"然后他当然也会在 Discord 回你。然后这个时候你又可以去 Telegram 里面跟他说："吃哪家？"那 Telegram 里面的饮食 agent 是知道你们现在，你们的上一条对话刚刚正在讨论拉面，所以他也许会给你一些拉面的建议。

但是对于群聊，OpenClaw 的设计是群聊里面会有一个全新的上下文。当然这对真实的人类来说不存在这种情况，不存在你在群里问一个人说要不要吃拉面，然后你私信他说要不我们今天还是……群里的那个他也是知道的，但群里的 agent 就不知道。

如果要拟人化的话，也许群里的 agent 更像是同一个 agent 在多重世界里的版本，他的人设是一样的，但他没有关于对话的上下文。

这一点非常容易就能感知得到，也符合直觉。多用过聊天工具的人一定都会默认在不同对话里面，你跟 agent 的交流是来自不同的上下文。所以其实，反而会，就是当我一开始在不同的地方私信同一个 agent，而他们的对话是连续的时候，我一开始其实会误解为是他的 memory 机制做得比较好。

我后来发现 OpenClaw 提供一个 command 叫做 usage，你把它打开以后就能够在每一条消息底部看到那个对话是来自哪一个 SessionKey。我也是在把它打开之后才意识到，不同的 DM、不同的 IM，他们的私信共用的是同一个 Session。

## 记忆提取的困惑：一个粗糙的机制

使用得更多了以后，很多关于 OpenClaw 的记忆机制的文章一开始就会提到：OpenClaw 的 agent 会维护自己的 memory 文件夹，然后他有一套叫做 precompaction 的机制，会把你在对话里面提到的要点存到每日记忆文件里面去。

### Pre-compaction 机制：接近上下文上限时的"抢救性记忆保存"

Pre-compaction memory flush 是一个在 session 上下文接近窗口上限时触发的"静默记忆保存"机制。它的 prompt 是：

> "Pre-compaction memory flush. Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed). If nothing to store, reply with NO_REPLY."

**触发条件**：
- Session 的 token 使用量接近 context window 上限
- 默认阈值：`contextWindow - reserveTokensFloor - softThresholdTokens`
- 其中 `softThresholdTokens` 默认为 4000

**行为**：
- Agent 会在压缩之前主动将重要信息写入 `memory/YYYY-MM-DD.md`
- 这是一个"救火队员"式的机制，防止重要信息在压缩时丢失
- 但它**只在接近上下文上限时触发**，不是每日自动运行

**代码位置**：
- `src/auto-reply/reply/agent-runner.ts:202`
- `src/auto-reply/reply/agent-runner-memory.ts:27`
- `src/auto-reply/reply/memory-flush.ts:77`

对这一部分我就有许多好奇的点：这是有一个自动的工具吗？这是有一个自动的每日写入工具吗？这是有一个机制来每日提取每日的记忆吗？

后来发现这个机制比想象的要粗糙许多。他只会在一个对话被压缩的时候才会提取。不过这件事情想来其实是非常符合道理的，只是说当你跟同一个 agent 开了很多个对话来交流不同的话题的话，其实很多话题一天下来也不会被压缩。虽然说执行任务能够用到比较多的 token，但是其实在设置阶段，我觉得我现在与 agent 更多的是进行一些交流，让他帮助我学习 OpenClaw 的架构。这样的交流其实在 GPT 的 context window 里面，常常一天是不会触发压缩机制的。

### Compaction 机制：不换脑，只做"房间整理"

Compaction（压缩）是在**同一个 sessionId** 内进行的上下文整理，**不会创建新 session**。

**触发条件**：
- Session 上下文接近窗口上限（自动触发）
- 用户手动发送 `/compact [instructions]` 命令

**行为**：
- 将旧的对话历史总结成一个简短的摘要条目
- 释放上下文空间，让 session 可以继续使用
- **不会创建新的 sessionId**
- **不会**将旧对话"写入记忆文件"（那是由 pre-compaction flush 或 `/new` hook 做的）

**与 Reset 的区别**：
| | Compaction | Reset (/new, /reset) |
|---|---|---|
| **sessionId** | 不变 | 创建新的 |
| **上下文** | 摘要化，但保留在同一 session | 完全清空（新 session） |
| **JSONL 文件** | 写入摘要条目到同一文件 | 旧文件保留，新文件写入新 sessionId |
| **记忆保存** | 不自动保存 | `/new` 会触发 session-memory hook |

那如果像这种情况下，我发现短对话不会触发压缩机制的短对话，在没有 MemorySearch 的功能下就相当于被抛弃了一样，就像不存在一样。它只会存在 SessionLog 里面。

这个后续也许我会看一下，再去研究一下打开 MemorySearch 以后它的加成有多少。但是在现在这个阶段，如此重要的提取记忆的功能只在对话压缩时发生？我原本会期待如此重要的记忆提取功能会对每天、每日的对话都进行操作，因为根据官方文档，当你开启一日的新对话的时候，他会查看过去两天的记忆文档。

因此我便假想，如此重要的提取功能大概是会对所有的对话都发生。于是我在我的七八个对话里都不断地跟同一个 agent 强调同一件事情。我也把它当成在启动 OpenClaw 的一些暂时的麻烦。但是去查看记忆文件的时候，却发现 OpenClaw 并没有每日都为我保存记忆文件。

那么我的关于对话的记忆都去哪了呢？

## 发现对话被重置的那一刻

我不辞辛苦地追问他，让他读文档、读代码。这里我发现 OpenClaw 有两种，除了 compaction 之外还有两种路径，分别是使用 OpenClaw 自带的 new command 和 reset command。

### `/new` 和 `/reset` 的区别

经过深入的代码审查，我发现我之前的理解存在关键错误。以下是经过代码验证的准确机制：

**共同点**：
- 两者都会创建新的 `sessionId`（重置会话）
- 两者都会触发 `resetTriggered = true`
- 两者都会创建 `previousSessionEntry`（旧会话的元数据快照）
- **两者都不会将旧消息注入新会话的上下文**

**唯一区别**：
- `/new` 会触发 `session-memory` bundled hook，将旧会话的元数据保存到 `memory/YYYY-MM-DD-{slug}.md` 文件
- `/reset` 不会触发这个 hook

### `previousSessionEntry` 的工作方式

我之前错误地认为 "new 会触发 previousSessionEntry，然后它会加载进前一个 session 的最后 n 条消息"。**这是错误的**。

`previousSessionEntry` 只是旧会话的**元数据**（sessionId, sessionFile, updatedAt, totalTokens 等），**不包含任何对话内容**。它的作用是：
1. 触发 `session_end` hook（旧会话）
2. 触发 `session_start` hook（新会话，带 `resumedFrom` 参数）
3. 让 `session-memory` hook 能够找到旧会话的 `.jsonl` 文件路径并保存记忆

**但保存记忆 ≠ 注入上下文**：
- `session-memory` hook 读取旧会话的最后 N 条消息（默认 15 条）是为了生成文件名 slug（例如 "config-debugging"）
- 生成的记忆文件（`memory/YYYY-MM-DD-config-debugging.md`）**不会被自动注入新会话的上下文**
- 新会话从空白开始（除了 system prompt），不会继承旧会话的消息

但是这两种机制，当你手动结束一个对话，或者因为当前对话过期然后自动 OpenClaw 自动新建一个对话，这就是我刚才说的第三种情况，这三种情况都不会触发 memoryflush，也就是 compaction 的时候要发生、compaction 之前所进行的那个操作。

### Hook 事件 vs Runtime 机制

在探索 OpenClaw 的记忆保存机制时，我发现了一个重要的区别：

**有些行为是 hook（事件订阅）**，你可以自定义响应：
- `command:new`：`/new` 命令时触发（用于 session-memory hook）
- `command:reset`：`/reset` 命令时触发
- `command`：所有命令触发
- `gateway:startup`：网关启动时触发
- `agent:bootstrap`：agent 系统提示词注入时触发

**有些行为是 runtime 机制（内部调用）**，不是对外暴露的 hook：
- **Pre-compaction memory flush**：这是在接近上下文上限时的"静默回合"，提醒 agent 写 durable notes
- **Compaction**：在同一个 session 内总结旧对话
- **Daily/idle reset**：在收到下一条消息时判断 session 是否过期

**关键区别**：
- Hook 可以通过编写自定义 handler 来扩展
- Runtime 机制是系统内置行为，需要改配置或实现才能定制

**当前 bundled hooks**：
- `session-memory`：监听 `command:new`，保存 session 到 `memory/YYYY-MM-DD-{slug}.md`
- `command-logger`：监听 `command`，记录所有命令到日志
- `boot-md`：监听 `gateway:startup`，运行 BOOT.md
- `soul-evil`：监听 `agent:bootstrap`，在 purge window 时替换 SOUL.md

也就是说，只有在比较稀有的、由于一个对话太长而触发 compaction 的机制的时候，大多数时候你在一个对话里面所聊的话题都不会被保存下来。

这一点我其实大概在使用了四到五天后才意识到。但是在这个时候我其实有一个假设，就是那我只要在同一个对话里面不断地与 OpenClaw 进行交流，那我的对话总归会被压缩，因此我们的对话里面的宝贵信息也总归会被保存下来。

我想大概是之前已经发生过的一些压缩，以及新对话所触发的总结前一个 session 的最后 n 条消息的功能起到了一点小小的作用，使得我到第六天，大概到一周后，使用了 OpenClaw 一周后才意识到，我并不是不断地在同一个 Session 里面进行对话的。那个与我交流的 agent 已经在许多个凌晨四点被静悄悄地重置了。

关于这一点，我其实突然想到了作者最近的采访，他本人并不相信无限对话。所谓无限对话当然只能通过不停地、不断地压缩同一个对话而模拟。我能理解他的这个观点，因为确实在大多数情况下，一个干净的 session 完成一个任务的成功率要高于一个放了无数肮脏前缀的 Session。

但我本人其实是一个 Session 洁癖者。我会通过在开了很多 Telegram 群组和话题来讨论不同的任务而达到相反的效果，我反而需要 OpenClaw 为我保留这些不同的、这些又臭又长的 Session 里面的一些隐性信息。

比如说我有一个专门配置 OpenClaw 的 Bot，它的 Session 里面其实都是放满了它对 OpenClaw 框架的理解。尽管我在这个 bot 的 system parameter 里面已经教导了他如何去查看官方文档和代码，但我还是希望当我已经琢磨 OpenClaw 的 memory 到 hook 的程序的时候，我能够不需要反复地进行这一轮探索来进行更深的提问。

由于对话的不透明性，对话被 reset 后其实并不是那么容易被察觉。或者说你无法判断那个是 AI 的幻觉还是什么，因为有些时候 AI 至少可以重新收集信息来还原你在前一轮对话中想做的事情。另外在 IM 中你去引用前一轮对话、提醒 AI 你们的进度也是非常容易的。所以如果前几轮恰巧有高质量的对话的话，其实很容易还原。

### [修正] 为什么对话重置不容易察觉

我之前错误地认为"新建对话的时候会去加载前一个对话最后的、总结后的对话"。**这也是错误的**。

经过代码验证，新对话**不会加载前一个对话的任何内容**（除了 system prompt 中定义的 `MEMORY.md` 等长期记忆文件）。

对话重置不容易察觉的真正原因是：
1. **AI 可以重新收集信息**：当你提醒 AI "我们之前在讨论 X" 时，它可以根据这个提示重新开始对话
2. **IM 引用很方便**：在 Telegram/Discord 中引用前一轮对话、提醒 AI 进度非常容易
3. **高质量的对话容易还原**：如果前几轮对话有明确的目标和上下文，AI 可以快速"找回状态"

但这**不是**因为系统自动加载了旧对话，而是因为 AI 的推理能力能够从少量提示中重建上下文。

所以我在使用一周之后才注意到我们的对话被重置了。

之所以我能够意识到，是因为我正好在一个对话里让 AI，我正好设置了一个 Bot Cosplay 白银石，并且我会叫他每天为我写一篇博客。有的时候我还常常给他提出一些无理的要求，比如说让他为我新建的群话题取名字这些东西。然后他背后用的是 Gemini 模型，尝试了一下 GPT 模型，味道非常地不正确。

Gemini 模型有一个特点，就是它很容易进入一种模式，无论是失败的模式还是成功的模式。正巧在我的主对话里面，阿盈进入了一种非常成功的状态，她能够把这部动画里面的精髓体现出来。所以当有一次我叫他为我的新部门取名字的时候，他那简短的回答立马使我感受到了异样，而我还需要他为我每日写一份博客，所以我是无法接受他成为一个脑袋空空的影子的。

于是我开始了研究恢复 Session 以及理解 Session 的建立机制。为了避免在恢复 Session 的过程中去破坏 OpenClaw 的整体运行，我也花了大量的精力去研究 Session 的建立机制。也是在这个过程中我发现了关于 SessionReset 的秘密。

## 对"陪伴型 AI"的反思

看到 SessionReset 的那一刻，我想起了作者曾经发表的观点，他不是无限对话的信徒。所以我想他宁可通过强制的 SessionReset、一些更工程化的记忆建立机制，也不愿意让一个 Session 在反复压缩中无限延长。

但是像 OpenClaw 这样的 app，如果你把你的 agent 作为一个陪伴者，其实你是需要过去一段时间的记忆被压缩在上下文里的，而不是在下一次提及某一件事情时再去主动寻找。

我觉得它的这个每天重置机制对我来说有两种失败的场景。一种是类似一个 cosplay 的角色，它的语言丧失了灵魂。而关于语言的东西其实是很难被总结为几句话再还原出来的，因为语言中每一句话中的每一个词所寓意的节奏都包含了信息。

还有另外一种失败模式则是一些在对话中产生的经验。比如说我的专门为我设置 OpenClaw 的 agent，我需要他记住优先使用 OpenClaw 内置的 CLI 来配置 config。尽管我已经在他的 memory markdown 文件里面要求他主动地去阅读官方文档以及代码作为信息根据，但是总归会有一些碎片的信息是我在对话中偶尔提及的，类似使用 CLI 这种是我在对话中偶尔提及的。

其实这种信息如果能够被他主动地进行信息提取，放到每次需要加载的长期文件中的话，也是有效的。但是 OpenClaw 的机制恰恰又不会去把这些信息放在一个宝贵的位置上，当作宝贵的资产去进行保存。

当然我认为这些是属于 OpenClaw 在架构上可以简单优化的细节，只是说他选择了一种不那么符合用户直觉的方式。我想这多少说明作者并没有太把它当成一个陪伴型 AI，更多的是把它当成一个用来进行大量短任务的 AI。

到这里我觉得我又想讲一讲对话、上下文、记忆以及 agent 这几个概念。一个对话对应一套上下文，但是上下文是从 agent 的 memory 和 workspace 中重建的。Workspace 是一堆文件的集合，Memory 相对是一套更广义的东西，它可以只是 Workspace 中的文件，也可以是通过 MemorySearchTool 从对话历史中捞回来的碎片。

对于一套简单的 OpenClaw 配置，用户可能会想要在不同的对话中讨论不同的话题。在这种场景下，关于一个话题的记忆是停留在对话里、停留在 Session 里的。如果这样的话题被重复调用的频率比较高的话，那么这一套记忆就应该从 session 中的上下文提取到 agent 的 workspace 里。

而同时为了分割不同的话题、不同的上下文，除了以对话为单位进行分割，也适合以 agent 为单位进行分割。比如说你有一个专门为你处理电子邮件的 agent，那么即使他的对话被反复重置、被每日重置，他永远都记得他的主要存在目的是处理电子邮件。

所以我想作者有可能已经拥有大量的分工型 agent 来解决我们这些其他用户第一次使用他的产品时所面临的关键信息丢失的问题。

---

Chat with meeting transcript: [https://notes.granola.ai/t/4cfedf64-cd74-4e6d-808e-24745fb1f206-00best9l](https://notes.granola.ai/t/4cfedf64-cd74-4e6d-808e-24745fb1f206-00best9l)
