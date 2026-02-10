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

（这篇文章里我会尽量把“我当时的误解”原样保留，但在关键点上把机制讲清楚。不然写到最后，读者只会继承我当时的困惑。）

## Sessions：一个看似简单却深刻的设计

OpenClaw 的设计机制离不开 Sessions 这个概念。如果你去读它官方文档的 Session Management 一页，可以很清楚地看到它的一些设计：

- 官方文档：<https://docs.openclaw.ai/concepts/session>

### “我以为的连续对话”到底来自哪里？

说到 Sessions，好像还得先介绍一下在 OpenClaw 里面 agent 以及 workspace 这个概念。每一个 agent 都对应有自己的一个 workspace，在那里面存了它的“初始指令集”（一堆 Markdown 文件）。这些文件更像是 OpenClaw 让 agent 维持人格与 SOP 的方式，而不是模型天生拥有的长期记忆。

OpenClaw 在最外面的一层，也就是各种 IM 工具，你可以把一个 agent 想象成一个人：一个人可以有很多 IM 账号（Discord、Telegram、手机号……）。

我一开始很自然地把它理解成：

> 只要对面是同一个 agent，那么无论我在哪个 IM 上私信它，我都在同一个 session 里。

这个直觉在 OpenClaw 的默认配置里**部分成立**，但成立的原因不是“不同渠道天然共享会话”，而是因为 OpenClaw 对 **DM 的 sessionKey 有一个可配置的聚合策略**。

- 默认 `session.dmScope: "main"`：**所有 DM 会汇总进同一个“主会话”**（追求连续性）。
- 如果你把它改成 `per-channel-peer` / `per-account-channel-peer`：DM 会被拆得更细，以避免“多用户 DM 共用同一个上下文”的隐私风险。

这也解释了一个很微妙的体验：当我在不同地方私信同一个 agent，感觉对话是连续的时候，我一开始会误以为这是“记忆做得好”；但实际上，很多时候只是 **DM 被折叠到同一个主 session** 里而已。

我后来发现 OpenClaw 提供一个 command 叫做 usage（以及 /status 一类的信息指令），你把它打开以后就能够在每一条消息底部看到那个对话是来自哪一个 SessionKey。我也是在把它打开之后才意识到：我以为的“跨 IM 记忆”，很多时候只是 sessionKey 规则在背后帮我做了聚合。

### 群聊/话题为什么“像平行宇宙”？

但是对于群聊（以及 Telegram 的 forum topic），OpenClaw 的默认策略是：**它们永远是独立的 sessionKey**。也就是说：

- 群里有群的上下文
- 话题有话题的上下文
- 私信有私信的上下文

如果要拟人化的话，也许群里的 agent 更像是同一个 agent 在多重世界里的版本：人设是一样的，但它不共享你在私信里积累的那堆对话细节。

这一点非常容易感知，也符合直觉：多用过聊天工具的人都会默认“不同对话”来自不同上下文。

## 记忆提取的困惑：一个（看起来）粗糙的机制

使用得更多了以后，很多关于 OpenClaw 的记忆机制的文章会提到：

- agent 会维护自己的 `memory/` 文件夹
- 似乎存在一种“把对话要点写入每日记忆”的机制

我当时把它想得很浪漫：像是每天凌晨跑一个小 cron，把你们今天聊过的东西都整理成日记。

但 OpenClaw 的现实设计比这“更工程、更冷静”。

### 先澄清：daily reset ≠ 自动生成 daily logs

一个最容易误解的点是：**daily reset（每天重置 session）并不会自动写 `memory/YYYY-MM-DD.md`**。

daily reset 做的事情更像是“切段”：为了防止 session 无限增长，它会在满足条件时为同一个 sessionKey 分配新的 sessionId（创建新的 transcript 文件），而旧 transcript 文件会保留。

真正“提醒/促使模型写 durable notes”的路径，常见的是两类：

1) **/new 触发的 session-memory hook**（默认只监听 `command:new`）
2) **pre-compaction memory flush**：当一个会话接近自动 compaction 时，runtime 可能插入一次“silent memory flush turn”，提醒模型把重要信息写盘（前提是 workspace 可写）

这两者跟 daily reset 是两条不同的管线。

### 我的问题：那 precompaction 到底是什么？

我当时的困惑主要有三个：

- 这是有一个自动的工具吗？
- 这是一个每日写入工具吗？
- 这是一个机制来每日提取每日的记忆吗？

后来读完文档，再对照行为，我才意识到：我把“记忆写盘”想成了一个**以日为单位**的流程，但 OpenClaw 更像是一个**以会话生命周期关键点为单位**的流程。

更准确的说：

- **compaction** 是“上下文快满了怎么办”的问题：它会在同一个 sessionId 里写入一条摘要（不会换 sessionId），用来释放上下文空间。
- **pre-compaction memory flush** 是“压缩之前先别丢关键细节”的提醒：它不是每天跑，而是在接近压缩时发生；而且它只是“提醒你写”，最终有没有写到文件，取决于那一轮模型是否真的把内容落盘。

于是我发现了一件很现实的事：

> 如果你的对话很短、很分散，既不触发 compaction，也不主动 /new，那么你期待的“记忆提炼”可能根本不会发生。

这并不意味着对话不存在——它仍然在 session transcript（JSONL）里；只是它没有被提升为“外置、可复用、可检索”的 durable notes。

（这也正是为什么我后面会对 MemorySearch 的价值产生兴趣：当 durable notes 不足时，是否能从 transcript 里捞回碎片，决定了“短对话是不是被抛弃”。）

## 发现对话被重置的那一刻

我不辞辛苦地追问他，让他读文档、读代码。

在这段探索里，我一开始把很多东西混成了一团：compaction、/new、/reset、daily reset、idle reset……

现在回头看，其实可以先把问题拆开：

- **Reset（换 sessionId）**：/new、/reset、daily reset、idle reset（都属于“开始一个 fresh session id”）
- **Compaction（不换 sessionId）**：在同一个 sessionId 里做摘要化，以延长可聊长度

官方文档对 reset 的描述非常明确：`/new` 和 `/reset` 都会 start a fresh session id，并且会把命令后面的文本作为新 session 的第一条消息继续处理。

### /new 和 /reset：我误会它们“完全相同”的地方

我当时以为：既然 /new 与 /reset 都是 reset，那它们对“记忆写盘”的影响应该也一样。

这是我后来确认的一个关键纠错点：

- 在 **reset** 层面：`/new` 与 `/reset` 的确同属 reset triggers（都会换 sessionId）
- 在 **hook** 层面：OpenClaw 内置的 `session-memory` hook 默认只监听 `command:new`

所以默认行为会长得像这样：

- `/new`：reset + （命中 `command:new`）→ 有机会触发“保存 session 到 memory 文件”
- `/reset`：reset，但**不会**触发 `session-memory`（除非你自己写 hook 监听 `command:reset`）

这也解释了我当时观察到的现象：我以为“系统应该每天自动写 daily logs”，但实际上我看到的“偶尔会写”，很多时候来自我自己在某个节点用了 `/new`，或者在长对话接近 compaction 时触发了 pre-compaction 相关机制。

### 还有一种更隐蔽的 reset：daily reset / idle reset

更“穿透我直觉”的，是 daily reset。

它不是到点立刻切脑，而是：在**下一条入站消息**时检查“上次更新时间”是否早于最近一次 daily reset 时间点（默认是网关主机本地时间 04:00），如果是，就认为 stale，然后开一个新的 sessionId。

所以它会发生得很安静：你并不会收到一个“我已经重置了”的通知。你只会在某些时刻突然觉得：对面像“换了一个人”。

## 对"陪伴型 AI"的反思

看到 daily reset 的那一刻，我想起了作者曾经发表的观点：他不是无限对话的信徒。

所以我想他宁可通过强制的 SessionReset、一些更工程化的记忆建立机制，也不愿意让一个 Session 在反复压缩中无限延长。

但是像 OpenClaw 这样的 app，如果你把你的 agent 作为一个陪伴者，其实你是需要过去一段时间的记忆被压缩在上下文里的，而不是在下一次提及某一件事情时再去主动寻找。

我觉得它的这个每天重置机制对我来说有两种失败的场景。

一种是类似一个 cosplay 的角色，它的语言丧失了灵魂。语言这种东西很难被总结为几句话再还原出来，因为每一句话的节奏都包含了信息。

还有另外一种失败模式则是一些在对话中产生的经验。比如说我的专门为我设置 OpenClaw 的 agent，我需要他记住优先使用 OpenClaw 内置的 CLI 来配置 config。尽管我已经在他的 memory markdown 文件里面要求他主动地去阅读官方文档以及代码作为信息根据，但是总归会有一些碎片的信息是我在对话中偶尔提及的。

其实这种信息如果能够被它主动地提取，放到每次都要加载的长期文件中的话，也是有效的。但 OpenClaw 的默认机制并不会自动把所有“短对话碎片”升格为资产。

这多少说明作者并没有太把它当成一个陪伴型 AI，更多的是把它当成一个用来进行大量短任务的 AI：

- session 是短的、可被 reset 的
- “长期性”要靠外置记忆（durable notes / 知识库 / 可检索）重建

---

如果你想看更技术化、但仍然可读的一组素材（四篇短系列），我把这次探索中的关键结论收束成了一个专栏：

- A Study in Memory（Pt.1~Pt.4）：<https://radonx.github.io/study-in-memory/>

Chat with meeting transcript: <https://notes.granola.ai/t/4cfedf64-cd74-4e6d-808e-24745fb1f206-00best9l>
