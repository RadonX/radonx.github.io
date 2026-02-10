---
title: "A Study in Memory, Pt. 1: Daily Reset and Compaction"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "daily-reset-and-compaction"
tags: ["OpenClaw", "Session Lifecycle"]
---

# Daily Reset, Idle Reset, and Compaction

This note explains the core lifecycle events of an OpenClaw session: automatic resets (daily and idle) and context compaction. It clarifies their purpose, triggers, and effects on session history and memory.

---
## User's Core Questions

> - "但是像 Thread 这种模型的话，会不会因为对话太短，从来没有触发 compaction 而导致记忆没有被提炼呢？"
> - "每日重置时reset的是纯文件session logs? 还是会实打实地影响LLM context？"
> - "那设置闲置超时还有意义吗？它不还是会被‘每日重置’？"
> - "Session log 是append only 的吗？还是会随着compaction创建新session？"
> - "我这两天读了一下OpenClaw 代码，发现它每过 idle reset time 会自动/new新对话。我感觉这个机制不太合理。"

## Canonical Explanation

### Mechanism Comparison Table



### Detailed Analysis
