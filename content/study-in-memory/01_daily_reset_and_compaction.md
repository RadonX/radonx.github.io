---
title: "A Study in Memory, Pt. 1: Daily Reset and Compaction"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "daily-reset-and-compaction"
tags: ["OpenClaw", "Session Lifecycle"]
---

# Daily reset, idle reset, and compaction

这篇笔记解决一个高频混淆：**“会话何时会变‘新’？”** 在 OpenClaw 里主要有两条完全不同的路径：

1) **Reset（换一颗新大脑 / 新 sessionId）**：/new、/reset、daily reset、idle reset
2) **Compaction（不换脑，只做“房间整理”）**：在同一个 sessionId 里把旧上下文摘要化

它们都会影响“模型本轮能看到的上下文”，但对**持久化的 session 记录（JSONL）**以及“记忆写盘”的触发点不同。

## 用户关心的本质问题（从对话里抽象）

- daily reset 到底 reset 的是什么？是“session 文件”还是“LLM 上下文”？
- idle reset 既然有 daily reset 了还有意义吗？谁优先？
- session log（JSONL）是 append-only 吗？compaction 会不会创建新文件？
- thread/topic 这种短对话会不会永远触发不了 compaction，从而“没有记忆提炼”？

## 一张表先把边界钉死

| 机制 | 触发 | 结果 | 会不会换 sessionId | 会不会改写历史 JSONL | 典型用途 |
|---|---|---|---:|---:|---|
| **Daily reset** | 到达每日重置时间（默认 **网关主机本地时间 04:00**）；在“下一条入站消息”时判断是否过期 | 强制开新 sessionId（像 /new） | ✅ | ❌（旧 JSONL 留着） | 防止 session 无穷增长；让“每天”天然切段 |
| **Idle reset** | 闲置超过 idleMinutes；同样在“下一条入站消息”时判断是否过期 | 强制开新 sessionId（像 /new） | ✅ | ❌ | 防止“沉睡会话”带着旧上下文复活 |
| **Manual reset**（/new、/reset） | 用户显式触发（以及 resetTriggers） | 立刻开新 sessionId | ✅ | ❌ | 你要主动切割话题/风格/模型 |
| **Compaction**（自动或 /compact） | session 上下文接近窗口上限；或手动 /compact | 在**同一个 sessionId**里，写入摘要条目，释放上下文空间 | ❌ | ✅（写入“摘要”条目，但不是重写旧条目） | 延长单个 session 的可用寿命 |
| **Pre-compaction memory flush** | 接近自动 compaction 时，可能先跑一次“silent memory flush” | 追加一个“提醒写 durable notes 的回合” | ❌ | 取决于你是否真的写了文件 | 把重要内容写到 workspace/memory（外置记忆） |

**文档证据点：** OpenClaw 的 session 生命周期在 `docs/concepts/session.md` 有明确描述，包括 daily reset 的默认时间点、idle 与 daily 的优先级、以及“过期判断发生在下一条入站消息”。

## Daily reset 的关键细节（最容易被误读）

1) **daily reset 不是定时器“到点立刻切脑”**。

   它的判断发生在“收到下一条入站消息”时：如果发现该 session 的 last update 早于最近一次 daily reset 时间点，就认为 session stale，然后创建新 sessionId。

2) **默认 daily reset 时间是网关主机本地时间 04:00**（不是 UTC，也不是用户时区）。

3) **reset 不会改写旧的 JSONL 文件**。

   OpenClaw 的 session transcripts 是按 sessionId 落到 `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`，reset 只是让“同一个 sessionKey 映射到新的 sessionId”。旧文件仍然保留，便于追溯/取证。

4) **Daily Logs 不是“自动生成的日志”**。

   daily reset ≠ 自动写 `memory/YYYY-MM-DD.md`。

   写 memory 文件只会在特定机制触发（例如 pre-compaction memory flush，或者 /new 的 session-memory hook；见后续第 2 篇）。

## Idle reset 的意义：它不是被 daily reset “覆盖掉”

当 daily reset 和 idle reset 同时配置时，OpenClaw 的规则是：**哪个先让 session 过期，就用哪个**。

- daily reset 更像“自然日切片”
- idle reset 更像“沉默窗口切片”

因此 idle reset 仍然有意义：它能在“同一天里长时间不说话”的情况下避免旧上下文复活。

## Compaction：不换 sessionId 的“房间整理”

compaction 的核心特征：

- **还在同一个 sessionId**
- 会在 JSONL 历史里写入一条“摘要（summary）”或等价条目
- 目标是减少“当前上下文窗口里需要塞的 tokens”，不是为了切割 session

### “短对话永远不触发 compaction”会怎样？

是的，短对话可能从不触发 compaction。

但这不是 bug：compaction 是应对“上下文快满”的策略。

如果你想让短对话也能形成 durable memory，应该靠：

- **显式 /new（触发 session-memory hook 写盘）**
- 或者把重要结论写进你的外置知识库（Obsidian/LogSeq/仓库）并让 OpenClaw 的 memory_search 能索引到

## 这一篇的“纠错点”（对素材的审核结论）

当前素材中最大的问题是：把大量 gateway logs / tool 结果原封不动贴进正文，导致读者看不到结论。

我已把它们压缩为上面的机制表 + 结论段，并把需要的“证据点”落到官方文档（`docs/concepts/session.md`）上。

下一篇（Pt. 2）会专门解决：/new vs /reset、previousSessionEntry 以及“为什么只有 /new 会触发 session-memory hook”。
