---
title: "A Study in Memory, Pt. 1: Daily Reset and Compaction"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "daily-reset-and-compaction"
tags: ["OpenClaw", "Session Lifecycle"]
---

# Daily reset, idle reset, and compaction

这篇笔记解决一个高频混淆：**"会话何时会变'新'？"** 在 OpenClaw 里主要有两条完全不同的路径：

1) **Reset（换一颗新大脑 / 新 sessionId）**：/new、/reset、daily reset、idle reset
2) **Compaction（不换脑，只做"房间整理"）**：在同一个 sessionId 里把旧上下文摘要化

它们都会影响"模型本轮能看到的上下文"，但对**持久化的 session 记录（JSONL）**以及"记忆写盘"的触发点不同。

## 用户关心的本质问题（从对话里抽象）

- daily reset 到底 reset 的是什么？是"session 文件"还是"LLM 上下文"？
- idle reset 既然有 daily reset 了还有意义吗？谁优先？
- session log（JSONL）是 append-only 吗？compaction 会不会创建新文件？
- thread/topic 这种短对话会不会永远触发不了 compaction，从而"没有记忆提炼"？

## 一张表先把边界钉死

| 机制 | 触发 | 结果 | 会不会换 sessionId | 会不会改写历史 JSONL | 典型用途 |
|---|---|---|---:|---:|---|
| **Daily reset** | 到达每日重置时间（默认 **网关主机本地时间 04:00**）；在"下一条入站消息"时判断是否过期 | 强制开新 sessionId（像 /new） | ✅ | ❌（旧 JSONL 留着） | 防止 session 无穷增长；让"每天"天然切段 |
| **Idle reset** | 闲置超过 idleMinutes；同样在"下一条入站消息"时判断是否过期 | 强制开新 sessionId（像 /new） | ✅ | ❌ | 防止"沉睡会话"带着旧上下文复活 |
| **Manual reset**（/new、/reset） | 用户显式触发（以及 resetTriggers） | 立刻开新 sessionId | ✅ | ❌ | 你要主动切割话题/风格/模型 |
| **Compaction**（自动或 /compact） | session 上下文接近窗口上限；或手动 /compact | 在**同一个 sessionId**里，写入摘要条目，释放上下文空间 | ❌ | ✅（写入"摘要"条目，但不是重写旧条目） | 延长单个 session 的可用寿命 |
| **Pre-compaction memory flush** | 接近自动 compaction 时，可能先跑一次"silent memory flush" | 追加一个"提醒写 durable notes 的回合" | ❌ | 取决于你是否真的写了文件 | 把重要内容写到 workspace/memory（外置记忆） |

**文档证据点：** OpenClaw 的 session 生命周期在 `docs/concepts/session.md` 有明确描述，包括 daily reset 的默认时间点、idle 与 daily 的优先级、以及"过期判断发生在下一条入站消息"。

## Daily reset 的关键细节（最容易被误读）

1) **daily reset 不是定时器"到点立刻切脑"**。

   它的判断发生在"收到下一条入站消息"时：如果发现该 session 的 last update 早于最近一次 daily reset 时间点，就认为 session stale，然后创建新 sessionId。

2) **默认 daily reset 时间是网关主机本地时间 04:00**（不是 UTC，也不是用户时区）。

3) **reset 不会改写旧的 JSONL 文件**。

   OpenClaw 的 session transcripts 是按 sessionId 落到 `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`，reset 只是让"同一个 sessionKey 映射到新的 sessionId"。旧文件仍然保留，便于追溯/取证。

4) **Daily Logs 不是"自动生成的日志"**。

   daily reset ≠ 自动写 `memory/YYYY-MM-DD.md`。

   写 memory 文件只会在特定机制触发（例如 pre-compaction memory flush，或者 /new 的 session-memory hook；见后续第 2 篇）。

## Memory 写入触发机制：什么时候才会写 `memory/` 文件？

这是一个高频误解：很多人以为 daily reset 会自动生成 daily memory 文件。**这是错误的**。

OpenClaw 中写入 `memory/YYYY-MM-DD-*.md` 文件的**只有 3 种途径**：

| 触发方式 | 写入 `memory/` | 频率 | 文件日期 |
|---------|---------------|------|----------|
| **`/new` command** | ✅ Yes (via session-memory hook) | 手动触发 | **当天**（触发 `/new` 的日期） |
| **Pre-compaction flush** | ✅ Yes (silent memory flush) | 上下文接近上限时 | **当天**（触发 flush 的日期） |
| **Daily reset** | ❌ No | 每天（默认 04:00） | 无（不会自动写入） |
| **Idle reset** | ❌ No | 闲置超时后 | 无（不会自动写入） |
| **`/reset` command** | ❌ No (hook 不监听) | 手动触发 | 无 |

**关键点**：

1. **只有 `/new` 会写 memory 文件**
   - 文件名：`memory/YYYY-MM-DD-{slug}.md`
   - 日期 = **触发 `/new` 的当天**，不是前一天
   - 例如：2 月 20 日开始对话，2 月 21 日发送 `/new` → 写入 `memory/2026-02-21-*.md`

2. **Daily/idle reset 不会写 memory**
   - 它们只是创建新 sessionId
   - 不会触发任何 hook 写入 memory 文件
   - 如果你的 session TTL = 7 天且从不手动 `/new`，那么 7 天内**不会有任何 daily memory 文件**

3. **Pre-compaction flush 不可靠**
   - 只在上下文接近上限时触发
   - 短对话可能永远触发不了
   - **不能依赖它作为每日记忆机制**

**如何实现可靠的 daily memory？**

如果你想要每天自动生成 memory 文件，需要：

1. **手动方案**：每天发送 `/new`（触发 session-memory hook）
2. **自动化方案**：创建一个 cron job，每天定时调用 `/new`（通过 `sessions_send` 或 webhook）
3. **Agent 主动写入**：在 system prompt 中教导 agent 每天结束时主动写入 `memory/YYYY-MM-DD.md`

## Idle reset 的意义：它不是被 daily reset "覆盖掉"

当 daily reset 和 idle reset 同时配置时，OpenClaw 的规则是：**哪个先让 session 过期，就用哪个**。

- daily reset 更像"自然日切片"
- idle reset 更像"沉默窗口切片"

---

## 记忆提取机制的脆弱性分析（2026-02-24 更新）

经过深入代码审查和实际使用，我们发现 OpenClaw 的记忆提取机制**确实脆弱**。以下是关键发现：

### 记忆提取的触发路径

**系统自动触发**（有限）：
- `/new` 命令 → session-memory hook → 写入 `memory/YYYY-MM-DD-{slug}.md`
- 接近 context window 上限 → pre-compaction flush → 提醒 Agent 写 `memory/YYYY-MM-DD.md`

**不会触发记忆提取**的机制：
- Daily reset（每天 04:00）→ ❌ 只创建新 sessionId，不写 memory
- Idle reset（闲置超时）→ ❌ 只创建新 sessionId，不写 memory
- `/reset` 命令 → ❌ 只创建新 sessionId，不写 memory
- Compaction 本身 → ❌ 只压缩上下文，不写 memory

**Agent 主动触发**（不确定）：
- Agent 可以主动使用文件工具写入 `MEMORY.md` 或 `memory/YYYY-MM-DD.md`
- 取决于 System Prompt 教导和 Agent 的行为
- 完全不可控

### 脆弱性体现

1. **Daily reset 不写记忆**
   - 每天早上 04:00 session 被重置
   - **但没有任何记忆被保存**
   - 除非用户手动 `/new` 或对话很长触发 flush

2. **Short conversations 永远不会保存**
   - 如果对话都很短（永远不会接近上限）
   - **永远不会触发 flush**
   - **也永远不会触发 `/new`**（除非手动）
   - 这些对话就"消失"在 session log 中

3. **依赖 Agent 主动性**
   - Pre-compaction flush 只是"提醒"
   - Agent 可能忽略（回复 `NO_REPLY`）
   - Agent 可能忘记写
   - 完全不可控

4. **只有 `/new` 是可靠的**
   - 但需要用户手动发送
   - 或者配置自动化 cron job

### session-memory hook vs Pre-compaction flush 的本质区别

| 特性 | session-memory hook | pre-compaction flush |
|------|---------------------|---------------------|
| **触发时机** | 用户发送 `/new` 或 `/reset` | Session 上下文接近上限 |
| **谁写文件** | Hook **直接写**（不需要 Agent） | **Agent 主动写** |
| **确定性** | ✅ 100%（每次 `/new` 都写） | ❌ 不确定（Agent 可能不写） |
| **文件路径** | `memory/YYYY-MM-DD-{slug}.md` | `memory/YYYY-MM-DD.md`（固定） |
| **文件组织** | 多文件（每次触发创建新文件） | 单文件（多次 flush 追加） |
| **LLM 调用目的** | 生成 slug（文件名） | 决定写什么内容 |

### 为什么记忆机制"脆弱"？

核心问题：**Daily reset 不会触发记忆提取**

这意味着：
- 如果你的 Session TTL = 7 天
- 如果你从不手动 `/new`
- 如果你的对话都很短（不会触发 flush）
- **那么 7 天内不会有任何 memory 文件被生成**

对话历史只存在于 `.jsonl` transcript 文件中，需要 Agent 主动使用 `memory_search` 工具才能检索。

### 实用建议

**如何让记忆更可靠？**

1. **每天手动 `/new`**（最可靠）
   ```
   每天手动发送 /new
   → 触发 session-memory hook
   → 自动保存当天对话
   ```

2. **自动化 `/new`**
   ```
   用 cron job 每天定时调用 /new
   → 自动触发 session-memory hook
   → 每天自动保存
   ```

3. **启用 MemorySearch**
   ```
   配置 memorySearch.enabled = true
   → Agent 可以搜索历史记忆
   → 即使不自动加载，也能查询
   ```

**代码依据**：
- `src/hooks/bundled/session-memory/handler.ts:65-283`（hook 实现）
- `src/auto-reply/reply/memory-flush.ts:12-18`（flush prompt）
- `src/auto-reply/reply/agent-runner-memory.ts`（flush 调度）

因此 idle reset 仍然有意义：它能在"同一天里长时间不说话"的情况下避免旧上下文复活。

## Compaction：不换 sessionId 的"房间整理"

compaction 的核心特征：

- **还在同一个 sessionId**
- 会在 JSONL 历史里写入一条"摘要（summary）"或等价条目
- 目标是减少"当前上下文窗口里需要塞的 tokens"，不是为了切割 session

### "短对话永远不触发 compaction"会怎样？

是的，短对话可能从不触发 compaction。

但这不是 bug：compaction 是应对"上下文快满"的策略。

如果你想让短对话也能形成 durable memory，应该靠：

- **显式 /new（触发 session-memory hook 写盘）**
- 或者把重要结论写进你的外置知识库（Obsidian/LogSeq/仓库）并让 OpenClaw 的 memory_search 能索引到

## 这一篇的"纠错点"（对素材的审核结论）

当前素材中最大的问题是：把大量 gateway logs / tool 结果原封不动贴进正文，导致读者看不到结论。

我已把它们压缩为上面的机制表 + 结论段，并把需要的"证据点"落到官方文档（`docs/concepts/session.md`）上。

下一篇（Pt. 2）会专门解决：/new vs /reset、previousSessionEntry 以及"为什么只有 /new 会触发 session-memory hook"。
