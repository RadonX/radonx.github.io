---
title: "A Study in Memory, Pt. 3: Hook Events Analysis"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "hook-events"
tags: ["OpenClaw", "Automation", "Hooks"]
---

# Hook 事件：有哪些、没有哪些，以及怎么把它们用在“可控自动化”上

你们在探索 `session-memory`（/new 写盘）与 pre-compaction memory flush（接近压缩的 silent turn）时，最大的认知陷阱是：

- 看到一个行为，就以为一定存在一个“对应的 hook event”

但 OpenClaw 的真实设计是：

- 有些行为是 **hook**（事件订阅 + handler）
- 有些行为是 **runtime 机制**（在某个执行路径里直接调用）

它们看起来都像“事件触发”，但可定制性完全不同。

## 用户关心的本质问题

- OpenClaw 到底有哪些 internal hook events？
- pre-compaction memory flush 是不是 hook？能不能 hook 到它？
- /new 与 /reset 这种命令的 hook 粒度是怎样的？
- 如果要做“桥接/自动化”（例如 webhook → sessions_send），hook 应该选哪一层？

## 事件分类：三层模型

### 1) Command events（命令层）

这是最容易理解的一层：

- `command`：所有命令
- `command:new`：只在 `/new` 时触发
- `command:reset`：只在 `/reset` 时触发

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

用于在注入 bootstrap files 时替换 persona（例如 soul-evil 这种“只在 purge window 换 SOUL.md”的实验）。

## 哪些“看起来像事件”的东西，其实不是 hook

### Pre-compaction memory flush：是 runtime 机制，不是 hook

它的特点：

- 发生在 session 接近 auto-compaction 之前
- 以一个“silent memory flush turn”的形式运行（提醒模型把 durable notes 写盘）
- 触发条件由 token/window 估算决定，并且只有 workspace 可写时才会发生

这更像“执行器在关键节点插入一个额外回合”，而不是对外暴露的 hook。

=> 如果你想定制它，通常要改实现或提供新的配置项，而不是“写一个 hook”。

## 当前 bundled hooks（给素材一个确定清单）

以你们的讨论为准（且以 repo 当前实现为准），常见 bundled hooks 包括：

- `session-memory`：events = `["command:new"]`
- `command-logger`：events = `["command"]`
- `boot-md`：events = `["gateway:startup"]`
- `soul-evil`：events = `["agent:bootstrap"]`

（这份清单的意义是“给读者一个基线”，避免把 runtime 机制误当成 hook。）

## 给“自动化桥接”的建议：hook 用来“接”，sessions_send 用来“投”

如果你的目标是：

- 外部系统（或另一个 bot）触发某件事
- 然后把内容投递到特定 `sessionKey`，让绑定的 agent 去出站

最稳的架构通常是：

1) 用 hook 或 channel plugin 提供一个**可控的入站入口**（HTTP webhook / 本地队列 / CLI）
2) 在 handler 里做权限校验、去重、日志
3) 最后用“sessionKey 投递”的方式进入目标会话（等价于 `sessions_send`）

避免做：

- 观察 outbound 再桥接（实现复杂、容易循环、边界难控）

## 对当前素材的审核结论（需要修改点）

- Pt.3 目前是空壳（只有 front matter），缺失关键内容。
- 我已补上：事件三层模型、hook vs runtime 的边界、bundled hooks 清单、以及桥接建议。

下一篇（Pt.4）会把这些工程结论上升到“为什么作者偏好 clean-slate + 外置记忆，而不是无限长会话”的设计取舍。
