---
title: "A Study in Memory, Pt. 2: /new vs /reset"
date: 2026-02-09T19:01:25-08:00
draft: false
slug: "new-vs-reset"
tags: ["OpenClaw", "Session Lifecycle", "Hooks"]
---

# /new vs /reset and the 'previousSessionEntry' Object

This note clarifies the critical difference between the `/new` and `/reset` commands, explaining how the former triggers a memory-saving hook via the `previousSessionEntry` object, while the latter does not.

---
## User's Core Questions

> - "Reset 和 new 到底是不是完全一致？"
> - "官方文档也表示 new , reset 是同义词吗？"
> - "不理解，进一步解释 previousSessionEntry 有啥用。2. resetTriggered 对 new 也是true 吗？"
> - "也就是说我的fork session hack 除了改sessions.json 别无他法改变加载的previous session entry？"

## Canonical Explanation


---
