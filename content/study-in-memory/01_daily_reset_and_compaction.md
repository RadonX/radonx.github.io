---
title: "A Study in Memory, Pt. 1: Daily Reset and Compaction"
date: 2026-02-09T22:38:00-08:00
draft: false
slug: "daily-reset-and-compaction"
tags: ["OpenClaw", "Session Lifecycle", "Fact Check"]
---

# Daily Reset, Idle Reset, and Compaction

This note clarifies the core lifecycle events of an OpenClaw session, based on our debugging conversations.

---
## User's Core Questions

> - "但是像 Thread 这种模型的话，会不会因为对话太短，从来没有触发 compaction 而导致记忆没有被提炼呢？"
> - "每日重置时reset的是纯文件session logs? 还是会实打实地影响LLM context？"
> - "那设置闲置超时还有意义吗？它不还是会被‘每日重置’？"
> - "Session log 是append only 的吗？还是会随着compaction创建新session？"

---
## Canonical Explanation

### Key Distinction: Daily Logs vs. Daily Reset

| 机制 (Mechanism) | Daily Logs (`memory/YYYY-MM-DD.md`) | Daily Reset (Session Reset) |
| --- | --- | --- |
| **是什么 (What is it?)** | 一个按日期命名的 **文件**，用于存储短期记忆。 | 一个控制会话生命周期的 **策略**。 |
| **作用 (Purpose)** | 充当 agent 的“草稿纸”或“短期记事本”。 | 防止单个会话无限变长，强制开启新对话。 |
| **谁来操作 (Who Acts?)** | **Agent 主动写入**（当它认为需要记笔记时）。 | **系统自动执行**（当新消息到达一个已过期的会话时）。 |
| **影响对象 (What it Affects)**| Workspace 中的 `memory/` 目录下的 Markdown 文件。 | `sessions/` 目录中的会话历史文件 (`.jsonl`)。 |
| **结果 (Outcome)** | 信息被持久化存储在文件系统中。 | 旧的对话历史被丢弃，一个全新的、空白的会话被创建。 |

In summary, as you correctly concluded: **`Daily Reset` destroys session history, so the system cannot automatically generate `Daily Logs` from it. `Daily Logs` depend entirely on the agent's active decision to write notes during a session.**

### Key Principles

1.  **Reset vs. Compaction**: `Reset` destroys the session history and starts a fresh one. `Compaction` happens within a single session, summarizing older parts to manage context window size without creating a new session.
2.  **Session Log (`.jsonl`)**: The log is append-only. Compaction adds a summary entry to the *same* log. A Reset ends one log file's use and starts a new one for the new session.
3.  **Idle vs. Daily Resets**: When both are configured, `whichever expires first` triggers the reset. A long `idleMinutes` does not prevent a `dailyReset`.
