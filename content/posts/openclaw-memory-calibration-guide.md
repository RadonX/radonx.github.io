---
title: "OpenClaw 的记忆不是你以为的那样（附使用指南）"
date: 2026-02-25T10:00:00-08:00
draft: false
slug: "openclaw-memory-calibration-guide"
tags: ["OpenClaw", "Memory", "Debug", "Guide", "Best Practices"]
---

# Usage Guide：OpenClaw 记忆机制的最佳实践

如果你使用了 OpenClaw 一段时间，大概率会遇到这些令人困惑的时刻：昨天还配合默契的 AI bot，今天就忘记了你们的约定。

这是 OpenClaw 的设计机制，但它的运作方式和我们的直觉相去甚远。
我们以为对话（Session）会自动提取为长期记忆（Memory），但大多数时候并不会。
本指南会介绍相关机制，解释 OpenClaw **为什么会失忆**，以及**如何在现有框架下尽可能避免**。


## 🧠 核心心智模型

先明确以下几个要点：

1. **Session ≠ Memory**：Session 是临时上下文，Memory 是持久存储
2. **新 Session 从空白开始**：所有类型的 reset 都不会注入旧消息
3. **记忆是外置存储**：memory 文件不会自动注入上下文
4. **Daily Reset 不写记忆**：每日重置只创建新 SessionId
5. **只有两个记忆写入触发点**：`/new`（确定）和 pre-compaction flush（不一定，由agent自行判断）

## 🔧 使用建议（按优先级排序）

### 1. 延长 Session Reset 时间（全局配置）

**适用场景**：所有不想被频繁 reset 的对话

**操作方法**：
修改 `openclaw.json` 配置，可使用 CLI
```bash
openclaw config set session.resetByType.dm.idleMinutes 10080      # dm, 7天
openclaw config set session.resetByType.thread.idleMinutes 10080  # thread, 7天
```

**说明**：
- 默认值：1 天（1440 分钟）
- 我的设置：7 天（10080 分钟）
- `mode: "idle"` 表示**只使用 idle reset**，**不会触发 daily reset**
- 同一对话 7 天内无活动后才会触发 reset

**注意**：
这只是延长 session 被自动重置的时间，减少因短期重置导致的记忆丢失风险。仍需配合 `/new` 或 memory search 保证记忆持久化。

### 2. 手动发送 `/new`（最可靠）

**适用场景**：所有需要保留记忆的对话

**操作时机**：
- 对话被自动 reset 前
- 重要话题结束时
- 切换到新的工作内容前

**注意**：
- daily/idle reset 不触发记忆提取
- 避免依赖 compaction 自动触发提取（短对话可能永远不会触发）

### 3. 明示 agent 记住重要信息

**适用场景**：
需要跨 session 持续记住的信息：
- 配置偏好（如"优先使用 OpenClaw 内置 CLI"）
- 工作流程
- 上下文信息

**注意**：
不要指望 agent 自动传递这些信息，要求 agent 在 `MEMORY.md` 中**记住**信息。

### 4. 启用 memory search

**适用场景**：需要检索历史对话的碎片信息

**注意**：
- 不启用 memory search 的情况下，未触发记忆提取的对话等同于被抛弃。
- 这是外置工具，不改变 session 机制，但能显著提升记忆可用性。

### 5. 使用 `/new` 切割话题

**适用场景**：同一个 agent 在同一对话处理多个不同主题时

**注意**：
- 避免不同主题的信息混杂在同一个 memory 文件中
- 每次 `/new` 会生成独立的 `memory/YYYY-MM-DD-{slug}.md` 文件，便于后续检索。

### 6. 按任务分工多个 agent

**适用场景**：不同类型的工作（邮件、配置、写作等）

**作用**：
避免单个 agent 的职能或信息混乱

**原理**：
每个 agent 各自维护的 System Prompt 或记忆定义了其核心目的，重置后仍记得自己的职责。

## ⚠️ 常见误区

### 误区 1：同一个私信对话永远不会断
- 默认设置下，同一个 agent 的所有私信共用一个 session
- **实际行为**：Daily reset（04:00）或 idle reset 会自动重置会话

### 误区 2：`/new` 会把旧消息注入新会话
- **以为**：新会话会读取旧记忆
- **实际行为**：新会话从空白开始（除了 System Prompt），记忆文件是外置存储，由 agent 根据 system prompt 决定是否阅读

### 误区 3：Daily reset 会自动保存当天记忆
- **以为**：每天重置应该配套每天保存
- **实际行为**：Daily reset 只创建新 session，不触发任何记忆写入

### 误区 4：写入 memory 文件后就能自动使用
- **以为**：保存=注入
- **实际行为**：Memory 文件是外置存储，Agent 必须主动读取

## 想要了解更多？

我花了一周才意识到：
OpenClaw 的记忆表现与用户的期待有所偏差，问题的根源在于 OpenClaw 的默认机制并不符合直觉。它倾向于**遗忘**，而不是**记忆**。
OpenClaw 的记忆并不是对话的自然沉淀，
`compaction`、`reset`、`session-memory hook` 等机制，会在你没有察觉的情况下改变 agent 的状态。

本文从用户使用角度出发，从 https://mp.weixin.qq.com/s/SiDku-uk_jU6WwvIr2ofuQ 中提取了其中有用的技巧，希望能让你的 OpenClaw 更稳定。原文在对 OpenClaw 的体验和复盘、尝试和感悟中，穿插了技术细节拆解。它详细描写了，我是如何在使用 OpenClaw 的第一周中，不断否定我自己的猜测（早知道一开始就直接读文档了），逐步定位了影响 OpenClaw 记忆的关键机制。
