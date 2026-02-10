---
title: "A Study in Memory, Pt. 2: /new vs /reset"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "new-vs-reset"
tags: ["OpenClaw", "Session Lifecycle", "Hooks"]
---

# /new vs /reset：同一条 reset 入口，不同的“记忆钩子”

这一篇回答两个绕了很久的问题：

1) **/new 和 /reset 在 session 生命周期层面是不是同义词？**
2) **为什么你们观察到“/new 会写 memory 文件，而 /reset 不会”？**

结论先行：

- 在 **session reset** 层面：`/new` 与 `/reset` 都会触发 reset（创建新的 sessionId）。官方文档也把它们描述为同类 reset trigger。
- 在 **hooks** 层面：OpenClaw 内置的 `session-memory` hook **只监听 `command:new`**，因此默认情况下只有 `/new` 会触发“保存 session 到 memory/YYYY-MM-DD-*.md”的写盘行为。

## 用户关心的本质问题

- `/new` 和 `/reset` 是否完全一致？
- `previousSessionEntry` 是什么？为什么要存在？
- resetTriggered 对 /new 也是 true 吗？
- 如果我要做 session fork/override（换大脑），`previousSessionEntry` 会不会影响？

## 官方文档（能证的部分）

`docs/concepts/session.md` 的 “Reset triggers” 明确写到：

- exact `/new` or `/reset`（以及 resetTriggers 配置）会 start a fresh session id
- 并把 remainder of the message through（即 `/new <text>` 会把 `<text>` 当成新 session 的第一条用户消息）

=> 这部分“/new == /reset（同属 reset trigger）”是文档级结论。

## 代码级事实（文档没写，但代码写得很清楚）

### 1) `previousSessionEntry` 的语义

在 reset 发生时，OpenClaw 会从 session store（`sessions.json`）里取出当前 sessionKey 的旧 entry，并在 resetTriggered 时做一个浅拷贝：

- `entry`：旧会话的元数据（sessionId、sessionFile、updatedAt、token 统计、model override 等）
- `previousSessionEntry`：resetTriggered 时对 `entry` 的浅拷贝

它的用途不是“让新会话继承旧上下文”（上下文继承是另一套机制），而是：

- **给上层逻辑/命令处理器提供一个“刚刚被你杀死的旧会话在哪里”的指针**
- 典型用途：在 /new 时做 session-to-memory 的保存、或做审计/迁移/工具化操作

### 2) 为什么 /reset 没写 memory，而 /new 写了？

关键不在 `previousSessionEntry`，而在 **hook 订阅的 event key**。

OpenClaw 的 hook 系统区分：

- `command`：所有命令
- `command:new`：只匹配 `/new`
- `command:reset`：只匹配 `/reset`

而内置的 `session-memory` hook（bundled hook）声明的 events 是：

- `command:new`

所以默认行为就是：

- `/new`：reset + 触发 `session-memory` hook → 把 session 内容写到 `workspace/memory/YYYY-MM-DD-<slug>.md`
- `/reset`：reset，但**不会触发** `session-memory` hook（除非你自己写了一个 hook 监听 `command:reset`）

这也解释了对话里出现过的“互相冲突信息”：

- 有些讨论把 “/new 与 /reset 同属 reset triggers” 推导成 “它们会触发同样的记忆写盘行为”——这是不成立的。
- 正确模型是：**reset 是 reset，hook 是 hook。它们是两条可组合的管线。**

## 一个对照表（把探索性对话的冲突收敛掉）

| 问题 | 正确答案 | 常见误解 |
|---|---|---|
| /new 和 /reset 会不会都换 sessionId？ | ✅ 都会（同属 reset triggers） | 以为 /reset 只是“清空上下文不换文件” |
| `previousSessionEntry` 在 /new 与 /reset 时会不会都有？ | ✅ 都可能有（取决于 resetTriggered 且旧 entry 存在） | 以为只有 /new 才有 previousSessionEntry |
| 只有 /new 才写 memory 文件吗？ | ✅ 默认是的（内置 session-memory 只监听 command:new） | 以为写 memory 是 reset 的内建副作用 |
| daily reset 会自动写 daily logs 吗？ | ❌ 不会（见 Pt.1） | 把 daily reset 当成 daily logs 生成器 |

## 对当前素材的审核结论（需要修改点）

这份素材里混入了大量“探索过程中的中间结论”，其中最需要纠正的是：

- “/new 和 /reset 在核心逻辑完全相同，所以 memory hook 也相同” —— **错**（hook 订阅不同）。

我在 PR 里会把它们改成上面的“reset 同义、hook 不同义”的表述，并把证据点分别落到：

- 文档：`docs/concepts/session.md`（reset triggers）
- 代码/Hook 元数据：bundled `session-memory` hook 的 `events: ["command:new"]`（hook 只监听 /new）

下一篇（Pt.3）会专门列出：OpenClaw 的 hook 事件有哪些、哪些常被误以为存在但其实不存在，以及如何把 hook 用在“可控的自动化桥接”上。
