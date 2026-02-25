---
title: "A Study in Memory, Pt. 3: Hook Events Analysis"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "hook-events"
tags: ["OpenClaw", "Automation", "Hooks"]
---

# Hook 事件：有哪些、没有哪些，以及怎么把它们用在"可控自动化"上

你们在探索 `session-memory`（/new 写盘）与 pre-compaction memory flush（接近压缩的 silent turn）时，最大的认知陷阱是：

- 看到一个行为，就以为一定存在一个"对应的 hook event"

但 OpenClaw 的真实设计是：

- 有些行为是 **hook**（事件订阅 + handler）
- 有些行为是 **runtime 机制**（在某个执行路径里直接调用）

它们看起来都像"事件触发"，但可定制性完全不同。

## 用户关心的本质问题

- OpenClaw 到底有哪些 internal hook events？
- pre-compaction memory flush 是不是 hook？能不能 hook 到它？
- /new 与 /reset 这种命令的 hook 粒度是怎样的？
- 如果要做"桥接/自动化"（例如 webhook → sessions_send），hook 应该选哪一层？

## 事件分类：三层模型

### 1) Command events（命令层）

这是最容易理解的一层：

- `command`：所有命令
- `command:new`：只匹配 `/new`
- `command:reset`：只匹配 `/reset`

这层适合做：

- 命令审计（command-logger）
- /new 时保存 session 到外置记忆（session-memory）

### 2) Gateway lifecycle events（网关生命周期层）

典型如：

- `gateway:startup`

用于 BOOT.md、初始化任务等。

### 3) Agent bootstrap events（系统提示词注入层）

典型如：

- `agent:bootstrap`

用于在注入 bootstrap files 时替换 persona（例如 soul-evil 这种"只在 purge window 换 SOUL.md"的实验）。

## 哪些"看起来像事件"的东西，其实不是 hook

### Pre-compaction memory flush：是 runtime 机制，不是 hook

它的特点：

- 发生在 session 接近 auto-compaction 之前
- 以一个"silent memory flush turn"的形式运行（提醒模型把 durable notes 写盘）
- 触发条件由 token/window 估算决定，并且只有 workspace 可写时才会发生

这更像"执行器在关键节点插入一个额外回合"，而不是对外暴露的 hook。

=> 如果你想定制它，通常要改实现或提供新的配置项，而不是"写一个 hook"。

## 当前 bundled hooks（给素材一个确定清单）

以你们的讨论为准（且以 repo 当前实现为准），常见 bundled hooks 包括：

- `session-memory`：events = `["command:new"]`
- `command-logger`：events = `["command"]`
- `boot-md`：events = `["gateway:startup"]`
- `soul-evil`：events = `["agent:bootstrap"]`

（这份清单的意义是"给读者一个基线"，避免把 runtime 机制误当成 hook。）

## 给"自动化桥接"的建议：hook 用来"接"，sessions_send 用来"投"

如果你的目标是：

- 外部系统（或另一个 bot）触发某件事
- 然后把内容投递到特定 `sessionKey`，让绑定的 agent 去出站

最稳的架构通常是：

1) 用 hook 或 channel plugin 提供一个**可控的入站入口**（HTTP webhook / 本地队列 / CLI）
2) 在 handler 里做权限校验、去重、日志
3) 最后用"sessionKey 投递"的方式进入目标会话（等价于 `sessions_send`）

避免做：

- 观察 outbound 再桥接（实现复杂、容易循环、边界难控）

## 对当前素材的审核结论（需要修改点）

- Pt.3 之前曾被另一个 agent 写成了"哲学稿"（且与 Pt.4 重复），并且文件名也被改坏，导致 `03_hook_events.md` 丢失。
- 我已在本 commit 中恢复：
  - 文件名：`03_hook_events.md`
  - 内容：hook taxonomy + hook vs runtime 边界

---

## 2026-02-24 更新：Hook 机制的边界和限制

### Pre-compaction Memory Flush 的真实性质

经过深入代码审查，我们确认了 pre-compaction memory flush **不是 hook**，而是 runtime 机制：

**代码位置**：
- `src/auto-reply/reply/memory-flush.ts:12-18`（flush prompt 定义）
- `src/auto-reply/reply/agent-runner-memory.ts`（flush 调度）

**特点**：
- 触发条件：`contextWindow - reserveTokensFloor - softThresholdTokens`
- 执行方式：插入一个"静默回合"（silent turn）
- Prompt 内容：
  ```
  Pre-compaction memory flush.
  Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed).
  IMPORTANT: If the file already exists, APPEND new content only and do not overwrite existing entries.
  If nothing to store, reply with NO_REPLY.
  ```

**关键限制**：
- ✅ Agent 可以选择写什么
- ❌ Agent 也可以选择不写（回复 `NO_REPLY`）
- ❌ 无法通过 hook 自定义（因为是 runtime 机制）
- ❌ 不保证每次都写（不可控）

### Session Memory Hook vs Pre-compaction Flush：本质区别

| 维度 | Session Memory Hook | Pre-compaction Flush |
|------|---------------------|---------------------|
| **类型** | Hook（可自定义） | Runtime 机制（固定） |
| **触发** | `/new` 或 `/reset` 命令 | 接近 context window 上限 |
| **可控性** | ✅ 高（可写自定义 handler） | ❌ 低（只能改 prompt） |
| **确定性** | ✅ 100%（每次触发都写） | ❌ 不确定（Agent 可能不写） |
| **文件写入** | Hook 直接写 | Agent 主动写 |
| **LLM 用途** | 生成 slug（文件名） | 决定写什么内容 |
| **文件组织** | `memory/YYYY-MM-DD-{slug}.md`（多文件） | `memory/YYYY-MM-DD.md`（单文件，追加） |

### 为什么说记忆机制"脆弱"？

从 Hook 的角度来看：

1. **只有 `command:new` 有 bundled hook**
   - `command:reset` 没有 bundled hook
   - Daily/idle reset 不触发任何 `command` 事件
   - 因此这些操作**不会**触发任何 hook 写入 memory

2. **Pre-compaction flush 不是 hook**
   - 无法通过 hook 机制自定义
   - 无法保证每次都写
   - 完全依赖 Agent 的主动性

3. **记忆提取的触发点很有限**
   - **系统自动触发**：只有 `/new`（通过 hook）
   - **半自动触发**：pre-compaction flush（提醒 Agent，但不保证写）
   - **手动触发**：Agent 主动写入（完全不可控）

**结论**：
记忆机制的脆弱性部分来自于 **hook 的不完整覆盖**：
- 没有监听 `command:reset` 的 bundled hook
- 没有监听 daily/idle reset 的 hook
- Pre-compaction flush 不是 hook（无法自定义）

因此，**只有 `/new` 命令提供了可靠的、可定制的记忆提取机制**。

下一篇（Pt.4）会把这些工程结论上升到"为什么作者偏好 clean-slate + 外置记忆，而不是无限长会话"的设计取舍。
