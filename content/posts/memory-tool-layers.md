---
title: '记忆工具分层：不是"谁更强"，而是"谁该在第几层"'
date: 2026-03-19T00:30:00-07:00
draft: false
slug: "memory-tool-layers"
tags: ["OpenClaw", "Memory", "Architecture", "Agent Design"]
---

## 争论的起因

前几篇我们一直在讨论 OpenClaw 的 session、reset、compaction、memory flush，讨论为什么长期记忆不能等同于长会话。这一篇要进入一个更容易吵起来的话题。

社区里经常有人问：Nocturne 和 ClawDB 哪个好？lossless-claw 是不是比 QMD 更强？Sirchmunk 能不能替代 memory-core？

我自己一开始也这样问。每个工具的作者都能给出令人信服的回答，但把这些回答放在一起看，它们互相矛盾。后来我才意识到，不是答案矛盾，是问题本身就问错了。这些工具根本不在同一个维度上。

## 记忆这个词太大了

混乱的源头，其实就是记忆这个词。

你仔细想想，在 agent 系统里，当我们说记忆的时候，我们到底在说什么？其实至少混杂了三件完全不同的事情。

第一件是身份。我是谁、我遵守什么原则、用户有哪些长期偏好和禁忌。你告诉 agent 永远不要用 var 声明变量，这当然是一种记忆，但它跟上周那个 bug 的结论完全不是一回事。前者是约束，后者是轨迹。

第二件是对话轨迹。我们聊过什么、做过什么决定、哪个报错是谁提的。上周你让 agent 帮你改了一个配置，这周想接着来，你需要的是一条可以回溯的对话痕迹。

第三件是知识证据。我写过什么文档、某个配置细节记在哪篇笔记里、这个结论能不能回到原文。你知道答案在某个地方，但想不起来在哪——这需要的是带路径、带引用、带位置的证据检索。

如果不先把这三件事拆开，最后一定会变成一锅粥：用 RAG 充当人格，用摘要充当事实，用相似度召回充当长期约束。每一步看起来都还行，但系统整体会越来越不可解释。

## 分层是从问题里长出来的

当你真的把身份、轨迹、证据拆开之后，分层其实不需要你去设计，它自己就长出来了。

L0 是主权记忆层。处理身份、原则、偏好、禁忌。它不是一个检索器，更像是一个裁判，在一切行动之前先决定什么该做、什么不该做。

L3 是对话轨迹层。处理我们之前聊过什么。但这里有一个关键的发现，也是我们在调研中花了最多时间才想清楚的一刀——L3 必须继续拆成两个子层。L3a 是上下文引擎，负责当轮 prompt 怎么拼装，做上下文压缩、做摘要。L3b 是记忆后端，当 agent 主动调 `memory_search` 或 `memory_get` 的时候，实际去哪里查。

为什么这一刀这么重要？因为 L3a 是每轮都要参与 prompt 构建的，它动一下，整个 prefix 缓存就失效了，成本和延迟都会受影响。而 L3b 是按需调用的，不调就不花钱。如果你不拆这两者，你会得到一个每轮都在重写 prompt、每轮都在翻旧账的系统，又吵又贵，而且出了问题你根本不知道噪声是从哪来的。

L2 是本地知识证据层。处理我的笔记里有没有这个。核心要求不是会总结，而是能给引用——path、snippet、position，缺一不可。

L1 是外网证据层。成本最高，不确定性最大，应该是最后才碰的。

把这个分层整理成一张表的话：

| 层 | 类别 | 执行顺序 | 原则 |
| :--- | :--- | :--- | :--- |
| L0 | 身份 / 控制面 | 第 0 步 | 约束先于行动（self-relevance） |
| L3 | 对话轨迹 | 第 1 步 | 成本最低、时效最高（task-relevance） |
| L2 | 本地知识 | 第 2 步 | 内部可信证据优先 |
| L1 | 外网 | 第 3 步 | 成本最高、最后升级 |

注意编号和执行顺序是反的。编号是按信息来源的通用性排的——L1 最通用，全网都能搜到；L3 最具体，只属于当前这个 agent 实例。而执行顺序是按成本和相关性排的——从最便宜、跟当前任务最相关的开始，逐步往外扩。

L0 永远排第一，不是因为它最重要，而是因为它的相关性最高——在你决定去找什么之前，你得先知道自己是谁、边界在哪。这是 self-relevance。然后才是 task-relevance 递减的 L3 → L2 → L1。

我觉得理解编号逻辑和执行顺序的分离，是理解整个分层模型的关键。很多人看到编号就以为是执行顺序，然后觉得为什么外网搜索反而排在对话轨迹前面，其实不是的。

## 把工具放回去

理解了分层之后再回头看那些工具，争论确实就消失了。

Nocturne 做的是身份、原则、偏好、disclosure 条件唤醒，加上 CRUD、快照回滚、审计。它的价值不在于更强的检索，而在于一件更根本的事情：不再让人格和原则寄生在相似度检索上。你的身份不应该是一个 embedding 向量。所以 Nocturne 只能放在 L0。

lossless-claw 做的是持久化消息、DAG 摘要、context assembly。它的强项是让旧上下文不被简单截断，但它的代价也很明确——每轮都参与 prompt 构建，prefix 稳定性下降，KV cache 复用变差。这就是 L3a，上下文引擎。它不是通用的记忆后端。

memory-core、QMD、ClawDB，这三个表面风格差异很大。memory-core 是默认的 Markdown + SQLite，QMD 是本地 sidecar 加 BM25 + 向量 + rerank，ClawDB 是服务化后端加 WAL/Parquet/DataFrame。但从 OpenClaw 的抽象层看，它们回答的是同一个问题——当 agent 调 `memory_search` 的时候，后端是谁？所以它们都是 L3b。在这个层位上它们确实可以互相比较，但出了这个层位，比较就没有意义了。

Sirchmunk 代表的是另一种范式——Agentic Search，把检索当成一个 agent 行为序列，而不是一次数据库查询。它有 query rewriting、evidence sampling、summarization、rerank。但它需要 LLM API，哪怕是 FAST 模式也不是零 LLM 调用。如果输出不能稳定变成带引用的证据，它就不能进入事实链。所以它更适合放在 L2，做本地知识层的增益。

还有一个值得单独说的是 MemOS Cloud Plugin。它的典型生命周期是 `before_agent_start` 先翻一遍旧账注入 recall block，`agent_end` 再写回去。对某些产品化的陪伴型 AI 来说这完全合理。但如果你追求的是可预测、安静、cache-friendly，那每轮自动注入这种策略就不应该是默认路线。

整理一下各工具的归层：

- **L0 主权记忆** — Nocturne（身份、原则、审计）
- **L3a 上下文引擎** — lossless-claw（DAG 摘要、context assembly）
- **L3b 记忆后端** — memory-core / QMD / ClawDB（`memory_search` 的实际执行者）
- **L2 本地知识** — Sirchmunk（agentic search、证据检索）
- **L1 外网** — tavily 等外网检索工具

## 什么叫优雅

调研做到后面，我开始形成一种判断标准，或者说审美。好的记忆系统不是功能最多的那个，而是最克制的那个。

默认安静。不应该每轮都自动拉历史、自动塞 recall block、自动改写上下文。大多数时候 agent 根本不需要回忆，它只需要完成手头的事。

默认可解释。每次 recall 都应该能回答三个问题——为什么现在查？查到了什么？证据在哪？如果答不上来，这次 recall 就不该发生。

默认 cache-friendly。如果你的系统每轮都重写 prompt 结构，它就天然更贵、更慢、更难调试。这不是优化层面的事情，这是架构选择。

默认可审计。尤其是 L0。约束是谁写进去的？何时改过？能不能回滚？如果人格层不可审计，你永远不知道 agent 为什么突然变了个性格。

按这四条来看，一个更优雅的默认策略其实反而是最简单的那个：L0 先决定约束，L3b 只在需要的时候被调用，L2 只在需要文档证据的时候被调用，L1 最后补外网。不是每一层都要存在，也不是每一层都要每轮参与。大部分时候 L0 加上按需的 L3b 就够了。

## 不只是 OpenClaw 的事

写到这里我想说的是，这套先拆问题、再放工具的思路并不只适用于 OpenClaw。

任何 agent 系统，只要你发现大家把记忆说成一个词但实际在讨论三四件不同的事情，或者 RAG、prompt cache、vectorDB、memory plugin、knowledge graph 全被混在一起比较，或者工具越加越多但行为越来越不可解释——都可以用同一个步骤来厘清。先拆 Identity、Trace、Evidence、Web。再看每个工具接在哪个接口上。再决定默认策略是自动注入还是按需调用。

层位摆正，工具会互补。层位混乱，再强的工具也会互相污染。

---

## 参考

本文涉及的项目：

- [Nocturne Memory](https://github.com/Dataojitori/nocturne_memory) — L0 主权记忆，身份 / 原则 / 审计
- [lossless-claw](https://github.com/Martian-Engineering/lossless-claw) — L3a 上下文引擎，DAG 摘要 / context assembly
- [QMD](https://github.com/tobi/qmd) — L3b 记忆后端，BM25 + 向量 + rerank
- [ClawDB](https://github.com/clawdb-ai/clawdb) — L3b 记忆后端，WAL / Parquet / DataFrame
- [Sirchmunk](https://github.com/modelscope/sirchmunk) — L2 本地知识，agentic search
