---
title: "A Study in Memory, Pt. 2: /new vs /reset and previousSessionEntry"
date: 2026-02-09T22:38:00-08:00
draft: false
slug: "new-vs-reset"
tags: ["OpenClaw", "Session Lifecycle", "Hooks"]
---

# /new vs /reset and the `previousSessionEntry` Object

This note clarifies the critical difference between the `/new` and `/reset` commands, explaining how the former triggers a memory-saving hook via the `previousSessionEntry` object, while the latter does not.

---
## User's Core Questions

> - "Reset 和 new 到底是不是完全一致？"
> - "官方文档也表示 new , reset 是同义词吗？"
> - "不理解，进一步解释 previousSessionEntry 有啥用。2. resetTriggered 对 new 也是true 吗？"

---
## Canonical Explanation

### The Fundamental Difference

`new` and `reset` are **not** identical. While both start a new session, only `/new` is designed to save the memory of the preceding conversation.

| Command | Triggers Memory Hook? | Purpose |
| --- | --- | --- |
| `/new` | ✅ **Yes** | Start a new session **while attempting to preserve context** from the old one. |
| `/reset` | ❌ **No** | Start a completely fresh, clean-slate session, **discarding all immediate context**. |

### The Mechanism: `command:new` Hook and `previousSessionEntry`

The memory-saving behavior of `/new` is enabled by a built-in hook called `session-memory`.

1.  **Trigger**: The `session-memory` hook is registered **only** for the `command:new` event. It is **not** registered for `command:reset`.
2.  **The "Inheritance" Object (`previousSessionEntry`)**: When `/new` is executed, the system creates a temporary, in-memory object called `previousSessionEntry`, which is a snapshot of the old session's metadata.
3.  **The Hook's Action (`saveSessionToMemory`)**: The hook uses the `previousSessionEntry` to find the old session's log file, reads its recent content, asks an LLM to summarize it, and saves that summary to a new file in the `memory/` directory.

In essence, `previousSessionEntry` is the "last will and testament" of the old session, and the `session-memory` hook is the "executor" that only shows up when the death is triggered by `/new`.
