---
title: "A Study in Memory, Pt. 5: Usage Guide"
date: 2026-02-24T23:00:00-08:00
draft: false
slug: "usage-guide"
tags: ["OpenClaw", "Memory", "Best Practices"]
---

# Usage Guide：OpenClaw 记忆机制的最佳实践

前四篇文章我们从技术角度深入分析了 OpenClaw 的记忆机制。这一篇我们将这些发现转化为**可直接使用的建议**。

## 🧠 核心心智模型

在进入具体建议之前，先明确几个关键认知：

1. **Session ≠ Memory**：Session 是临时上下文，Memory 是持久存储
2. **新 Session 从空白开始**：所有 reset 都不会注入旧消息
3. **记忆是外置存储**：写入 memory 文件不会自动注入上下文
4. **Daily Reset 不写记忆**：每日重置只创建新 SessionId
5. **只有两个记忆写入触发点**：`/new`（确定）和 pre-compaction flush（不确定）

## 🔧 使用建议（按优先级排序）

### 【建议 0】延长 Session TTL（全局配置）

**适用场景**：所有不想频繁手动 `/new` 的使用场景

**操作方法**：
在 `openclaw.json` 中配置：
```json
{
  "session": {
    "sessionTtl": 30  // 从默认 7 天改为 30 天或更长
  }
}
```

**风险避免点**：
- 避免 daily reset 频繁打断长期对话
- 减少因短期重置导致的记忆丢失风险

**注意**：
这只是延长 session 被自动重置的时间，仍需配合 `/new` 或 memory search 保证记忆持久化。

### 【建议 1】每天手动发送 `/new`（最可靠）

**适用场景**：所有需要保留记忆的对话

**操作时机**：
- 每天结束时
- 重要话题结束时
- 切换到新的工作内容前

**风险避免点**：
- 避免依赖 daily reset 自动保存（它不会保存）
- 避免依赖 compaction 自动触发（短对话可能永远不会触发）

### 【建议 2】重要结论写入 MEMORY.md

**适用场景**：
需要跨 session 持续记住的信息：
- 配置偏好（如"优先使用 OpenClaw 内置 CLI"）
- 工作流程（如"如何配置 OpenClaw"）
- 上下文信息（如"当前项目背景"）

**风险避免点**：
不要指望 session 自动传递这些信息

**文件位置**：workspace 根目录的 `MEMORY.md`

### 【建议 3】启用 memory search

**适用场景**：需要检索历史对话的碎片信息

**风险避免点**：
不启用的情况下，未触发压缩的短对话等同于被抛弃

**注意**：
这是外置工具，不改变 session 机制，但能显著提升记忆可用性。

### 【建议 4】使用 `/new` 切割话题

**适用场景**：同一个 agent 处理多个不同主题时

**风险避免点**：
避免不同主题的信息混杂在同一个 memory 文件中

**文件组织**：
每次 `/new` 会生成独立的 `memory/YYYY-MM-DD-{slug}.md` 文件，便于后续检索。

### 【建议 5】按任务分工多个 agent

**适用场景**：不同类型的工作（邮件、配置、写作等）

**风险避免点**：
避免单个 agent 的 session 过长或记忆混乱

**原理**：
每个 agent 的 System Prompt 定义了其核心目的，重置后仍记得自己的职责。

## ⚠️ 常见误区

### 误区 1：Daily reset 会自动保存当天记忆
- **为什么会这么想**：直觉认为"每天重置"应该配套"每天保存"
- **实际行为**：Daily reset 只创建新 SessionId，不触发任何记忆写入

### 误区 2：`/new` 会把旧消息注入新会话
- **为什么会这么想**：以为"新会话"应该继承"旧上下文"
- **实际行为**：新会话从空白开始（除了 System Prompt），记忆文件是外置存储

### 误区 3：Compaction 会保存所有重要信息
- **为什么会这么想**：以为压缩时会自动提取记忆
- **实际行为**：Pre-compaction flush 只是"提醒 Agent 写"，Agent 可能选择不写

### 误区 4：同一个私信对话永远不会断
- **为什么会这么想**：默认设置下，同一个 agent 的所有私信共用一个 session
- **实际行为**：Daily reset（04:00）和 idle reset 会自动创建新 SessionId

### 误区 5：写入 memory 文件后就能自动使用
- **为什么会这么想**：以为保存=注入
- **实际行为**：Memory 文件是外置存储，Agent 必须主动读取

## 📌 一句话总结行为模型

**主动 `/new` + 写入 MEMORY.md + 启用 memory search = 可靠的记忆机制；依赖自动化 = 记忆丢失。**

---

## 系列文章导航

- [Pt. 1: Daily Reset and Compaction](/daily-reset-and-compaction)
- [Pt. 2: /new vs /reset](/new-vs-reset)
- [Pt. 3: Hook Events Analysis](/hook-events)
- [Pt. 4: Philosophy](/philosophy)
- [Pt. 5: Usage Guide](/usage-guide)（本篇）
