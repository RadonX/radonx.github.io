---
title: "OpenClaw记忆机制体验：一次缓慢的觉醒"
date: 2026-02-24T00:00:00-08:00
draft: true
slug: "openclaw-memory-mechanism"
tags: ["OpenClaw", "AI", "memory", "Session", "体验"]
---

# OpenClaw记忆机制体验：一次缓慢的觉醒

这两天高强度使用OpenClaw，高强度阅读它的文档和代码，对记忆功能有了更深了解。技术文章不缺我这一篇，我决定从使用体验角度切入，还原我如何感受到OpenClaw记忆机制的全貌。

//Memory search -> 记忆搜索
作为辅助说明：我至今未安装OpenClaw自带的MemorySearch相关工具——不管是 agentic search 还是 embedding search。我想要拥有一手体验，了解MemorySearch对memory这件事的影响究竟有多大。

## Sessions：看似简单的深刻设计

> **技术背景：Session 状态层次表**
> 
> | 层级 | 存储位置 | 决定因素 | 用户可控性 |
> |-----|---------|---------|-----------|
> | SessionKey | `sessions.json` 中的键名 | chat_id + thread/topic_id | 配置绑定 |
> | SessionId | 对应键名下的 `sessionId` 字段 | OpenClaw 自动生成 | 不可直接改 |
> | JSONL 历史 | `<sessionId>.jsonl` 文件 | append-only 写入 | 可覆盖（有风险） |
> | SessionStore | 内存中的 `SessionStoreEntry` | 从文件加载 + 45秒缓存 | 受缓存影响 |


OpenClaw设计机制离不开sessions概念，官方文档Sessions页面也有清楚的设计思路。



OpenClaw最外层是IM工具。把agent想象成一个人：一个人可以有很多IM账号——Discord账号、手机号、飞书账号、Telegram账号。只要使用这些账号的都是同一个agent，我们就是在跟同一个人说话。

默认设置下，你与同一个agent在不同IM中的私信共用同一个session。举例：你在Discord问银时agent（我有一个银魂的阿银agent)"我们去吃拉面嘛？"他在Discord回复你。这时你去Telegram跟他说"吃哪家？"Telegram里的银时agent知道你们上一条对话正在讨论拉面，也许会给你拉面建议。

但群聊不同。OpenClaw设计中，群聊有全新上下文，这和真实人类不一样。你在群里问一个人要不要吃拉面，然后私信他，私信的人会知道，但私信里的agent却不知道。拟人化地说，群里的agent更像同一个agent在多重世界里的版本：人设相同，但没有对话上下文。这一点容易感知，符合直觉。与agent交流过的人都会默认在不同对话里上下文不同。反而是你与一个agent的所有私信占用同一个session出乎意料。当我一开始在不同地方私信同一个agent，对话十分连贯时，我误以为OpenClaw的memory机制做得很好。后来发现OpenClaw提供`/usage full`命令，打开后能在每条消息底部看到对话来自哪个SessionKey，我才意识到这一点。

## 记忆提取的困惑：粗糙机制

> **技术背景：OpenClaw 会话文件布局**
> 
> ```
> ~/.openclaw/agents/<agent>/sessions/
> ├── sessions.json              # Session 索引（45秒缓存）
> └── <sessionId>-<topic>.jsonl   # 具体会话历史（实时读取）
> ```
> 
> | 操作 | 修改的文件 | 生效延迟 | 风险等级 |
> |-----|----------|---------|---------|
> | 正常对话 | `.jsonl` append | 立即 | 低 |
> | `/new` | `sessions.json` + 新 `.jsonl` | 立即 | 低 |
> | `/reset` | 清空 `.jsonl` | 立即 | 中（丢失当前上下文） |
> | Session Fork（黑科技） | 覆盖 `.jsonl` | 立即* | 高（时间管理问题） |
> 
> *注：Fork 后立即生效是因为 `.jsonl` 是实时读取，但 `sessions.json` 有 45 秒缓存。*

先简单介绍OpenClaw里agent和workspace的概念。每个agent对应自己的workspace，存放初始prompt，如系统prompt。这些系统prompt还会教agent如何维护自己的系统prompt。

很多关于OpenClaw记忆机制的文章都会提到：OpenClaw的agent有自己的memory文件夹，有一套叫precompaction的机制，把对话中提到的要点存到每日记忆文件里。我很好奇，这背后有自动的每日提取记忆的工具吗？

后来发现这机制比想象中粗糙许多，只在对话被压缩时才触发提取（memory flush)。这个设定符合道理，只是当你跟同一个agent打开很多对话交流不同话题时，常常对话一天下来不会触发压缩。虽然自动执行任务能用快速消耗token，但我现在还在与agent的交流阶段，让它帮助我学习OpenClaw架构。这样的交流在长上下文窗口里，常常一天不会触发压缩机制。

没有触发压缩的短对话只存在于session log里，在没有设置MemorySearch功能的情况下相当于被抛弃。后续我也会打开MemorySearch功能，感受加成有多少。但在没有记忆搜索功能时，如此重要的记忆提取功能只能等待对话压缩时发生。我还假想，如此重要的提取功能大概会对所有对话发生。于是我在七八个对话里都不断跟同一个agent强调同一件事情。我把它当成冷启动OpenClaw的暂时麻烦。

我原本期待记忆提取会作用于每一天的对话，因为根据官方文档，开启和一个agent一天的新对话（私信）时，上下文会自动加载过去两日的记忆文档。但查看记忆文件(`memory/`)时，我发现OpenClaw并没有每日都为我保存记忆文件。

我的关于对话的记忆都去哪了？

## 发现对话被重置的那一刻

我不辞辛苦追问OpenClaw，让它读文档、读代码，发现它刷新对话，除了compaction之外还有两种机制：`/new`和`reset`。

> **技术背景：Memory 机制对照表**
>
> | 机制 | 触发条件 | 是否换新 SessionId | 是否触发 Memory Flush | 对上下文的影响 |
> |-----|---------|------------------|---------------------|--------------|
> | **Manual /new** | 用户发送 `/new` | ✅ 新建 SessionId | ✅ **触发**（写 memory 文件） | 新 session 从空白开始（记忆是外置存储） |
> | **Manual /reset** | 用户发送 `/reset` | ✅ 新建 SessionId | ❌ 不触发 | 同上 |
> | **Compaction** | Context Window 接近上限 | ❌ 保留 SessionId | ✅ **触发**（pre-compaction flush） | 压缩历史，生成摘要 |
>
> **关键发现**：
> - 只有 Compaction 会触发 memory flush (即pre-compaction flush）
> - `/new` 的 session-memory hook 会写入 memory 文件，但不注入上下文

> **关键澄清：新 Session 的行为**
>
> - `previousSessionEntry` **只包含元数据**（sessionId, sessionFile, updatedAt, totalTokens 等），**不包含对话内容**
> - **两者（/new 和 /reset）都不会**将旧消息注入新 session 上下文
> - 新 session 从空白开始（除了 system prompt），**不会继承旧消息**。除了 system prompt 中定义的 `MEMORY.md` 等长期记忆文件。
> - `session-memory` hook 读取旧消息用于**生成文件名 slug**，**不会注入新 session 上下文**；这个 hook 会读取前一个 session 的最后 n 条消息（默认 15 条）用于生成描述性的文件名 slug（例如 "config-debugging"），然后将元数据保存到 `memory/YYYY-MM-DD-{slug}.md` 文件。
> - `/new` 的记忆文件是**外置存储**，需要 Agent 主动读取才能使用
> - 所有的记忆文件是外置存储，不会自动注入新 session 的上下文。Agent 必须主动读取（通过 `MEMORY.md` 或 `memorySearch`）才能使用这些记忆。

但不管是 new 还是 reset 机制，不管是手动结束，还是对话过期后自动 reset（这是第三种情况，后文会讨论），这两种机制都不会触发 memory flush，也就是 compaction 进行前的操作。换句话说，除了由于对话太长而触发 compaction 的少数情况，大多数时候对话都不会进行**被动**记忆提取（这里假设用户一般不手动发送`/new`)。

这一点我大概在使用OpenClaw四到五天后才意识到。但这时我有个假设：只要在同一个对话里不断与OpenClaw交流，对话总归会被压缩，因此对话里的宝贵信息也总归会被保存下来。

我想大概是之前已经发生的一些压缩，以及`/new`对话触发的记忆总结起到了小小的作用，使得我直到使用OpenClaw一周后才意识到，我并不是不断在同一个session里进行对话。那些与我交流的agent已经在许多个凌晨四点被悄悄重置了。

关于这一点，我突然想到Peter最近的采访，他本人不相信无限对话。所谓无限对话当然只能通过不停压缩同一个对话而模拟。我能理解他的观点，因为确实在大多数情况下，一个干净的session完成任务的成功率要高于一个放了无数肮脏历史的session。

但我本人是Session洁癖者，我会通过开很多Telegram群组和话题讨论不同任务来达到类似效果。我反而需要OpenClaw为我保留这些不同的、又臭又长的sessions里的隐性信息。比如我有个专门配置OpenClaw的bot，它的sessions里都是它对OpenClaw框架的理解。尽管我在这个bot的system prompt 里已经教它如何查看官方文档和代码，但我还是希望当我已经琢磨过一次OpenClaw 的 memory hook 机制时，我不需要反复进行这一探索以进行更深地提问。

由于对话的不透明性，以及OpenClaw在新对话中可能会读取之前的记忆文件，对话被reset后不那么容易被察觉。或者说你无法判断错误是来自AI的幻觉还是缺失的上下文，而且有时AI还能通过重新收集信息来还原你在之前的对话中想做的事情。尤其是在IM中，引用历史对话很方便，如果前几轮恰巧有高质量的总结，很容易提醒AI对话的进度。

我在使用一周后才注意到对话被重置了。

之所以能够意识到，是因为我正好设置了cosplay坂田银时的bot，我会叫他每天为我写一篇博客。我还常常给他提出无理要求，比如让他为我新建的群话题取关乎宇宙存亡级别的名字。他背后用的是Gemini模型，尝试了GPT模型，味道非常不正确。

Gemini模型有个特点：很容易进入一种模式，无论是失败模式还是成功模式。正巧在我与阿银的私信中，他进入了非常成功的cosplay，他能够把这部动画里的精髓体现出来。当有一次我叫他为我的新部门取名字时，他那简短的回答立马使我感受到异样，而我还需要他为我每日写一份博客，我无法接受他脑袋空空的样子。

于是我开始研究恢复session。为了避免在恢复session过程中破坏OpenClaw的整体运行，我也花了大量精力研究Session的建立机制，也是在这过程中我发现了关于session reset的秘密。

## 对"陪伴型AI"的反思

> **技术背景：Daily/Idle Reset**
>
> | 机制 | 触发条件 | 是否换新 SessionId | 是否触发 Memory Flush | 对上下文的影响 |
> |-----|---------|------------------|---------------------|--------------|
> | **Daily Reset** | 凌晨自动（默认 04:00） | ✅ 新建 SessionId | ❌ 不触发 | 完全清空，新 session 从空白开始 |
> | **Idle Reset** | 会话空闲超阈值 | ✅ 新建 SessionId | ❌ 不触发 | 同上 |
>
> **关键发现**：Daily/idle reset 都会创建新 SessionId，但**不会**触发 memory flush。

看到SessionReset的那一刻，我想起Peter曾经发表的观点，他不是无限对话的信徒。我想他宁可通过强制的SessionReset、一些更工程化的记忆建立机制，也不愿意让Session在反复压缩中无限延长。

但像OpenClaw这样的app，如果你把agent作为陪伴者，你需要过去一段时间的记忆被压缩在上下文里，而不是在下一次提及某件事情时再去主动寻找。

我觉得它的每天重置机制对我来说有两种失败场景。一种是类似cosplay的角色，它的语言丧失了灵魂。关于语言的东西很难被总结为几句话再还原出来，因为语言中每句话中每个词所寓意的节奏都包含信息。

另一种失败模式则是对话中产生的经验。比如我专门为我设置OpenClaw的agent，我需要他记住优先使用OpenClaw内置的CLI来配置config。尽管我已经在他的memory markdown文件里要求他主动阅读官方文档以及代码作为信息根据，但总归会有一些碎片信息是我在对话中偶尔提及的，类似使用CLI这种是我在对话中偶尔提及的。

这种信息如果能够被他主动进行信息提取，放到每次需要加载的长期文件中，也是有效的。但OpenClaw的机制恰恰不会把这些信息放在宝贵位置上，当作宝贵资产进行保存。

当然我认为这些属于OpenClaw在架构上可以简单优化的细节，只是他选择了一种不那么符合用户直觉的方式。我想这多少说明Peter并没有太把它当成陪伴型AI，更多是把它当成用来进行大量短任务的AI。

到这里我想讲讲对话、上下文、记忆以及agent这几个概念。一个对话对应一套上下文，但上下文是从agent的memory和workspace中重建的。Workspace是一堆文件的集合，Memory相对是一套更广义的东西，它可以只是Workspace中的文件，也可以是通过MemorySearchTool从对话历史中捞回来的碎片。

对于一套简单的OpenClaw配置，用户可能想要在不同对话中讨论不同话题。这种场景下，关于一个话题的记忆停留在对话里、停留在Session里。如果这样的话题被重复调用的频率比较高，那么这一套记忆就应该从session中的上下文提取到agent的workspace里。

同时为了分割不同话题、不同上下文，除了以对话为单位进行分割，也适合以agent为单位进行分割。比如你有个专门为你处理电子邮件的agent，那么即使他的对话被反复重置、被每日重置，他永远都记得他的主要存在目的是处理电子邮件。

我想Peter有可能已经拥有大量分工型agent来解决我们这些其他用户第一次使用他的产品时所面临的关键信息丢失问题。

---

Chat with meeting transcript: [https://notes.granola.ai/t/4392c41e-5e40-466f-bda9-8b2e094d7806](https://notes.granola.ai/t/4392c41e-5e40-466f-bda9-8b2e094d7806)
