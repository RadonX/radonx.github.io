---
title: "A Study in Memory, Pt. 6: Memory Tool Layers - Hydrated"
date: 2026-03-17T00:33:00-07:00
draft: false
slug: "memory-tool-layers"
tags: ["OpenClaw", "Memory", "Architecture", "Agent Design", "Guide"]
---

# 记忆工具分层：从哲学到配置，为什么不是“谁更强”，而是“谁该在第几层”

前几篇我们一直在讨论 OpenClaw 的 session、reset、compaction、memory flush，以及“为什么长期记忆不能等同于长会话”。

这一篇要把这些“新知”彻底变成**可直接使用的技巧/配置/决策依据**。

这篇文章采用一个固定方法论来梳理：

**scan → structure → deep dive → context → elegance → thinking pattern → problem reframing → cross-domain transfer → formal clarification → generalization**

---

## 1) scan：先扫清“memory”这个词里其实混了几件事

在 agent 系统里，“memory”这个词至少混杂了三类完全不同的问题：

1.  **Identity / Constitution**
    - 我是谁？
    - 我遵守什么原则？
    - 用户有哪些长期偏好、禁忌、约定？

2.  **Conversation Trace**
    - 我们之前聊过什么？
    - 上周那个 bug 的结论是什么？
    - 哪个报错、哪个截图、哪条决定是谁提的？

3.  **Knowledge Evidence**
    - 我写过什么文档？
    - 某个配置细节在哪篇笔记？
    - 这个结论能不能回到原文和引用？

如果不先把这三类问题拆开，任何“记忆系统”最终都会走向混乱：

- 用 RAG 充当人格
- 用摘要充当事实
- 用相似度召回充当长期约束

---

## 2) structure：分层不是增加复杂度，而是给每个问题一个固定位置

基于上面的拆分，一个更清晰的结构是：

- **L0：Identity / Sovereign Memory**
  - 处理身份、原则、偏好、禁忌、情境触发
  - 它不是“检索器”，而是“路由器/裁判”

- **L3：Conversation / Runtime Trace**
  - 处理对话轨迹的可回溯性
  - 但这一层必须继续拆成两类：
    - **L3a：Context Engine**（上下文组装/压缩策略）
    - **L3b：Memory Backend**（`memory_search` / `memory_get` 的后端实现）

- **L2：Local Knowledge Evidence**
  - 处理本地知识库、文档库、笔记库的证据检索
  - 核心要求不是“会总结”，而是“能给引用”

- **L1：Web Evidence**
  - 处理外网检索
  - 应当是最后升级路径，而不是默认入口

这里最关键的一步是：

> **L3 必须拆成 L3a 和 L3b。**

如果不拆，你就会把“上下文管理”和“记忆后端”混在一起，最后得到一个既吵、又贵、又不可调试的系统。

---

## 3) deep dive：每一层真正应该暴露什么接口？

分层一旦停留在“概念”层面，很快就会再次混乱。要让它可执行，每层都需要最小接口契约。

### L0：Identity / Sovereign Memory

输入：情境、任务、触发条件  
输出：约束、偏好、禁止项、路由建议  
失败模式：宁可不触发，也不要污染人格

### L3a：Context Engine

输入：当前会话历史  
输出：当轮 prompt context 的组装结果  
失败模式：可能牺牲 cache 复用，可能引入动态重写成本

### L3b：Memory Backend

输入：`memory_search(query)` / `memory_get(path)`  
输出：可追溯的记忆片段  
失败模式：找不到就返回空，不应自动“想办法补全”

### L2：Knowledge Evidence

输入：query + 可选过滤器  
输出：`path + snippet + position` 这种证据项  
失败模式：宁可空，也不要“先生成答案再补来源”

### L1：Web Evidence

输入：外部 query  
输出：URL + 摘要 + 不确定性提示  
失败模式：失败就停，不应强行编造成事实

---

## 4) context：把现有工具放回它们真正该在的位置

现在把常见的“记忆工具”放回这套结构里，很多争论会瞬间消失。

### Nocturne Memory → L0

它解决的问题是：

- 身份
- 原则
- 偏好
- disclosure 条件唤醒
- CRUD + 快照回滚 + 审计

这决定了它不是“检索器”，而是“主权记忆层”。

它的价值不在于更强检索，而在于：

> 不再让人格、原则、偏好寄生在相似度检索上。

所以 Nocturne 的正确位置只能是 **L0**。

---

### lossless-claw → L3a

lossless-claw 的核心是：

- 持久化消息
- DAG 摘要
- context assembly
- `lcm_grep / lcm_expand`

它的强项是“让旧上下文不被简单截断”。

但它的代价也非常明确：

- 每轮都参与 context assembly
- prompt 结构变成动态拼装
- prefix 稳定性下降
- KV/prompt cache 复用变差

所以它不是通用“记忆后端”，而是 **L3a：上下文引擎**。

---

### memory-core / QMD / ClawDB → L3b

这三者的共同点是：

它们都在回答同一个问题——

> 当 agent 调 `memory_search` / `memory_get` 时，到底去哪查？

- **memory-core**：默认后端，本地 Markdown + SQLite 索引
- **QMD**：本地 sidecar，BM25 + 向量 + rerank
- **ClawDB**：服务化后端，WAL/Parquet/DataFrame、背压、隔离、签名路由

注意：

QMD 和 ClawDB 表面看风格差别很大，一个偏本地搜索器，一个偏服务化后端；但从 OpenClaw 的抽象层看，它们都属于 **L3b**，因为它们都在实现同一对工具接口。

---

### Sirchmunk → L2

Sirchmunk 代表的是另一种范式：

- Agentic Search
- FAST / DEEP
- query rewriting
- evidence sampling
- summarization / rerank

它不是纯粹的索引器，而是“把检索当成 agent 行为序列”。

但它最重要的约束也很清晰：

- **需要 LLM API**（哪怕是本地 OpenAI-compatible endpoint）
- FAST 也不是“零 LLM”
- 输出如果不能稳定变成“引用证据”，就不能进入事实链

所以它更适合放在 **L2：本地知识证据检索**，而不是 L3。

---

### MemOS Cloud Plugin → 不适合作为默认层，而更像“自动 recall 注入器”

MemOS Cloud Plugin 的典型生命周期是：

- `before_agent_start` → `/search/memory` → 注入 recall block
- `agent_end` → `/add/message` → 写回

它的重点不是“放在哪一层”，而是它采用了一种特定策略：

> **每次运行前都自动翻旧账。**

这件事对某些产品化陪伴型 AI 是合理的；但如果你的目标是：

- 可预测
- 不吵
- cache-friendly
- 默认不自动注入

那它就不适合做默认路线。

---

## 5) elegance：什么才叫“优雅的记忆系统”？

优雅不是“功能多”，而是：

### A. 默认不吵
不应该每轮都自动拉历史、自动塞 recall block、自动改写上下文。

### B. 默认可解释
每次 recall 都应该能回答：

- 为什么现在查？
- 查到了什么？
- 证据在哪？

### C. 默认 cache-friendly
如果你的系统每轮都重写 prompt 结构，它就天然更贵、更慢、更难调试。

### D. 默认可审计
人格层（L0）尤其如此：

- 约束是谁写进去的？
- 何时改过？
- 能不能回滚？

如果按这四条评估，一个更优雅的默认策略其实很简单：

> **L0 先决定约束；L3b 只在需要时被调用；L2 只在需要文档证据时被调用；L1 最后补外网。**

---

## 6) thinking pattern：每种工具背后的思想模型不同

一旦你看清每个工具背后的“thinking pattern”，很多误用就会自动消失。

### Nocturne 的 thinking pattern
“记忆首先是主权与身份。”

### lossless-claw 的 thinking pattern
“记忆首先是上下文压缩问题。”

### QMD / ClawDB 的 thinking pattern
“记忆首先是检索后端与工程可靠性问题。”

### Sirchmunk 的 thinking pattern
“检索首先是一种可自适应的 agent 行为，而不是一次数据库查询。”

它们都对，但它们回答的是不同问题。

---

## 7) problem reframing：不要再问“哪个更强”，要问“它该放在哪层”

大多数记忆工具比较文章都会问：

- 哪个效果更好？
- 哪个更聪明？
- 哪个更像长期记忆？

这其实问错了。

更好的问题是：

1.  它解决的是 **identity / trace / evidence / web** 中的哪一类？
2.  它默认是 **自动注入** 还是 **按需工具调用**？
3.  它输出的是 **答案** 还是 **证据**？
4.  它的代价是 **cache、可解释性、审计性、部署复杂度** 中的哪一项？

一旦问题这样重写，分层就会自然浮现出来。

---

## 8) cross-domain transfer：这套方法不仅适用于 OpenClaw

这套“先分层、再放工具”的方法，不只是 OpenClaw 可以用。

任何 agent 系统，只要遇到以下现象，都适用：

- 大家把“记忆”说成一个词，但实际在讨论三四件不同的事
- RAG、prompt cache、vectorDB、memory plugin、knowledge graph 被混在一起
- 工具越来越多，但行为越来越不可解释

在这些场景下，你都可以用同一套步骤：

- 先拆 Identity / Trace / Evidence / Web
- 再看每个工具接在哪个接口上
- 再决定默认策略是否自动注入

---

## 9) formal clarification：给出可执行的运行时路由（默认策略）

**你最关心的：编号逻辑 vs 执行顺序**

这套编号（L0-L3）是按**信息的“来源”和“性质”**分类，而不是执行顺序。执行顺序（L0→L3→L2→L1）则是按**成本与相关性**决策。

| 编号逻辑 (Numbering Logic) | 类别 (Category) | 执行顺序 (Execution Order) | 原则 (Principle) |
| :--- | :--- | :--- | :--- |
| **L0** | Meta / Control Plane | **0** | **约束先于行动 (Self-Relevance First)** |
| **L1** | Public / External | **3** | 最高成本、最后升级 |
| **L2** | Private / Curated | **2** | 内部可信证据优先 |
| **L3** | Instance / Trace | **1** | **最低成本、最高时效性 (Task-Relevance First)** |

这解释了为什么“最相关”的 L0 排第一（与 agent 自身最相关），然后才是与“当前任务”最相关的 L3。

**默认路由（cache-friendly / 不吵）：**

1.  **Consult L0**：加载约束（原则/偏好/禁忌）
2.  **按需调用 L3b**：只有在“需要历史证据”时才 `memory_search`/`memory_get`
3.  **按需调用 L2**：只有在“需要文档证据”时才检索 KB（Sirchmunk/QMD/rg 等）
4.  **必要时 L1**：外网补证
5.  **写回可选**：只写“可复用结论/原则”，并保证可审计

---

## 10) generalization：选型与演进的最小决策树

- 你最在意 **人格约束与审计** → 先做 L0（Nocturne）
- 你最在意 **稳定、缓存、可预测** → L3b（memory-core/QMD/ClawDB）优先
- 你最在意 **“丢文件就能搜”且接受 LLM 调用** → L2（Sirchmunk）做增益
- 你最在意 **超长叙事连续性** → 再考虑 L3a（lossless-claw）作为特例

一句话总结：

> 记忆系统的关键，不是“谁最强”，而是“谁该在第几层”。

当层位摆正，工具会互补；当层位混乱，再强的工具也会互相污染。

---

## Hydration：实用配置、命令与决策矩阵

### 配置片段（Configuration Snippets）

#### memory-core（默认）
```json5
// ~/.openclaw/openclaw.json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true,
        "provider": "openai", // or gemini/voyage/local/ollama
        "model": "text-embedding-3-small",
        // Hybrid search (BM25 + vector) for better relevance
        "query": {
          "hybrid": { "enabled": true, "vectorWeight": 0.7, "textWeight": 0.3 }
        }
      }
    }
  }
}
```

#### QMD
```json5
// ~/.openclaw/openclaw.json
{
  "memory": {
    "backend": "qmd",
    "citations": "auto",
    "qmd": {
      "includeDefaultMemory": true,
      "update": { "interval": "5m" },
      "paths": [
        { "name": "docs", "path": "~/your-docs-folder", "pattern": "**/*.md" }
      ]
    }
  }
}
```

#### lossless-claw
```json5
// ~/.openclaw/openclaw.json
{
  "plugins": {
    "slots": {
      "contextEngine": "lossless-claw"
    },
    "entries": {
      "lossless-claw": {
        "enabled": true,
        "config": {
          "freshTailCount": 32,
          "contextThreshold": 0.75,
          "incrementalMaxDepth": -1
        }
      }
    }
  }
}
```

#### MemOS Cloud Plugin
```json5
// ~/.openclaw/openclaw.json
{
  "plugins": {
    "entries": {
      "memos-cloud-openclaw-plugin": {
        "enabled": true,
        "config": {
          "apiKey": "YOUR_MEMOS_API_KEY",
          "recallEnabled": true,
          "recallGlobal": false, // Isolate by conversation
          "memoryLimitNumber": 5, // Be conservative
          "relativity": 0.5,
          "recallFilterEnabled": true, // Recommended to reduce noise
          "recallFilterModel": "qwen2.5:7b" // Use a local/cheap model for filtering
        }
      }
    }
  }
}
```

### CLI 命令（CLI Recipes）

#### QMD

```bash
# 检查状态
qmd status

# 手动更新索引
qmd update

# 手动生成 embeddings
qmd embed

# 搜索
qmd query "your query" -c memory-root --json
```

#### lossless-claw

```bash
# 进入 TUI
lcm-tui

# TUI 里可以：
# - 按 / 搜索
# - 按 d/e/x 展开/描述节点
# - 按 q 退出
```

#### Jujutsu (jj) / Git（用于 KB 维护）

```bash
# 检查 jj repo 状态
cd ~/.openclaw/shared/knowledge
jj status

# 提交变更
jj commit -m "docs: update memory architecture"

# 查看日志
jj log -n 5
```

### 决策矩阵：L3b 后端怎么选 (memory-core vs QMD vs ClawDB)

| 维度 | memory-core | QMD | ClawDB |
|---|---|---|---|
| **Cache-Friendly** | ✅ (稳定 prompt) | ✅ (稳定 prompt) | ✅ (稳定 prompt) |
| **可解释性** | ✅ (SQLite) | ✅ (SQLite + explain) | ✅ (WAL可回放) |
| **社区成熟度** | ✅ (内置) | 🟢 (活跃，API趋稳) | 🔴 (新，社区信号弱) |
| **部署复杂度** | ✅ (零配置) | 🟠 (需装 CLI/Bun/SQLite) | 🟠 (需起服务/配置队列) |
| **是否需LLM API** | ❌ (可选) | ✅ (rerank/expand) | ❌ |
| **性能** | 🟢 (够用) | 🟢 (本地混合) | 🟢 (WAL+DataFrame) |
| **优雅点** | 简洁 | 本地混合检索 | 工程可靠性 |
| **推荐默认？** | ✅ | 🟢 (值得尝试) | 🟠 (PoC 优先) |

### 常见陷阱（Gotchas / Pitfalls）

1.  **KV/prompt cache 命中率下降**
    - **元凶**：lossless-claw、MemOS 等“每轮自动注入/改写上下文”的机制
    - **后果**：每轮 prefill 成本上升，延迟变高，调试困难
    - **对策**：默认用工具式 recall，保持 prompt 稳定

2.  **L0/L3 混用污染人格**
    - **元凶**：把 Nocturne 当资料库，或用 RAG 检索原则
    - **后果**：agent 行为不可预测、约束时有时无
    - **对策**：L0 只放“宪法”，不放“资料”；RAG 只检索“资料”，不碰“原则”

3.  **双真相一致性地狱**
    - **元凶**：MD 文件和 clawdb/qmd index 都被当成主存储
    - **后果**：改了 MD，索引没跟上；或反之
    - **对策**：明确“MD 为真相，索引为派生”，并建立单向同步机制（pull/push）

4.  **忘记写回（Capture/Promotion 缺失）**
    - **元凶**：只做 retrieval，忘了“自我进化”需要写回
    - **后果**：agent 永远在重复犯错
    - **对策**：建立“失败/纠错 → 写 learnings → 定期 review → 提升到 L0/KB”的闭环
