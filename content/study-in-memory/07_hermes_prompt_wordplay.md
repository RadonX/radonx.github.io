---
title: "A Study in Memory, Pt. 7: Prompt 的文字游戏 — 为什么所有 Agent 框架都相似，但 Hermes 不同"
date: 2026-04-12T16:00:00-07:00
draft: false
slug: "hermes-prompt-wordplay"
tags: ["OpenClaw", "Prompt Engineering", "Agent Design", "Hermes", "Language"]
---

# Prompt 的文字游戏

所有 agent 框架在架构层面都是相似的：system prompt + tool calling loop + context management。Hermes 的成功之处，不在架构，在 prompt 措辞。

这篇文章用 10 步方法论逐字拆解 Hermes agent 的 prompt 设计：

**scan → structure → deep dive → context → elegance → thinking pattern → problem reframing → cross-domain transfer → formal clarification → generalization**

---

## 1. SCAN — 措辞密度

先不看结构，只看哪些词被精心选择过。

| Prompt | 核心措辞 | 措辞密度 |
|---|---|---|
| `TOOL_USE_ENFORCEMENT` | "Never end your turn with a promise" | ★★★★★ |
| `MEMORY_GUIDANCE` | "prevents the user from having to correct you" | ★★★★★ |
| `SKILLS_GUIDANCE` | "Skills that aren't maintained become liabilities" | ★★★★ |
| `SUMMARY_PREFIX` | "NOT as active instructions" | ★★★★★ |
| `OPENAI_EXECUTION` | "mental computation" / "act_dont_ask" | ★★★★★ |
| `GOOGLE_OPERATIONAL` | "Never guess at file contents" | ★★★ |
| `_summarizer_preamble` | "a DIFFERENT assistant that continues" | ★★★★ |

`OPENAI_EXECUTION` 和 `TOOL_USE_ENFORCEMENT` 的措辞密度最高 — 这两个 prompt 的每个词都在做功。

---

## 2. STRUCTURE — 措辞的微观结构

每条 prompt 的句式选择遵循一个共同模式：**正面指令后紧跟反面禁止**。

```
MEMORY_GUIDANCE:
  主句 → 解释 → 优先级排序 → 负面约束 → 正面替代
  "Save durable facts" → "Memory is injected every turn" → 
  "Prioritize what reduces future user steering" → 
  "Do NOT save task progress" → "save it as a skill"

TOOL_USE_ENFORCEMENT:
  绝对禁止 → 具体场景 → 行为标准
  "You MUST use tools" → "When you say 'I will run tests'" → 
  "Every response should either (a) contain tool calls or (b) deliver results"

OPENAI_EXECUTION:
  XML标签分段 → 每段内部：正面指令 + 反面禁止
  <tool_persistence> → <mandatory_tool_use> → <act_dont_ask> → 
  <prerequisite_checks> → <verification> → <missing_context>
```

LLM 对禁止性指令的响应比对指导性指令更强。不是只说"要做什么"，而是"要做什么 + 不要做什么"。

---

## 3. DEEP DIVE — 逐字级的巧思

### 「mental computation」

```python
# prompt_builder.py L208
"NEVER answer these from memory or mental computation — ALWAYS use a tool"
```

没用 "thinking"、"reasoning"、"knowledge"，用了 **"mental computation"**。

三个原因：
1. **"memory" 和 "computation" 是机器词汇** — 对 LLM 来说，这两个词的语义指向"你自己"，而不是"人类的思考过程"
2. **避免激活 "我是有意识的思考者" 的语义空间** — "thinking" 和 "reasoning" 在 LLM 的 embedding 空间里和 "I think"、"I believe" 强关联，会鼓励模型自信地给出未经验证的答案
3. **"computation" 暗示可出错** — "mental computation" 听起来像"心算"，天然暗示"可能算错，应该用工具验证"

### 「Never end your turn with a promise」

```python
# prompt_builder.py L179
"Never end your turn with a promise of future action — execute it now."
```

这句话的节奏：**短句斩断 → 破折号 → 行动指令**。

- "Never end your turn" — 用 LLM 的术语（turn），不是用户的术语
- "with a promise of future action" — 把 agent 的"我会帮你做 X"重新定义为"承诺"，带有负面暗示（承诺 = 空话）
- "execute it now" — 两个词，动词 + 时间副词，没有余地

如果写成 "Please try to use tools immediately rather than describing future plans"，效果完全不同。Hermes 的版本是**命令式**，不是**请求式**。

### 「prevents the user from having to correct you」

```python
# prompt_builder.py L149-150
"Prioritize what reduces future user steering — the most valuable memory 
is one that prevents the user from having to correct or remind you again."
```

这句话重新定义了 memory 的价值函数：

- **不是** "记住用户说过的有趣事实"
- **不是** "存储有用的上下文"
- **而是** "防止用户重复纠正你"

"correct or remind you again" — 这是把 agent 的失败体验具体化了。对 LLM 来说，"correct" 和 "remind" 是有情感重量的词（暗示之前的回答是错的/不够的）。这让 memory 的存储动机从 "知识积累" 变成了 "避免失败"。

### 「NOT as active instructions」

```python
# context_compressor.py L37
"treat it as background reference, NOT as active instructions."
```

LLM 会把 summary 里的 "帮我做 X" 当作当前指令去执行。这句话用两个词组解决了这个问题：

- **"background reference"** — 暗示信息是旧的、被动的、仅供参考的
- **"NOT as active instructions"** — 用大写 NOT 加上 "active instructions"，直接对比两种信息状态
- **"active"** 这个词是关键 — 它区分了 "可以参考的信息" 和 "需要执行的指令"

### 「genuinely changes what tool you would call」

```python
# prompt_builder.py L227
"Only ask for clarification when the ambiguity genuinely changes 
what tool you would call."
```

"genuinely changes" — 这是一个非常高的阈值。

- 不是 "when you're unsure"（太低，任何歧义都会触发问问题）
- 不是 "when it's important"（太模糊）
- 是 "genuinely changes what tool you would call" — 只有当歧义会导致**调用不同的工具**时才需要澄清

大多数歧义不会改变工具选择（"检查端口 443" 的歧义不会改变你调用 `terminal` 的事实），所以 agent 被鼓励直接行动。

---

## 4. CONTEXT — 措辞选择的上下文

每个措辞选择都针对一个**已知的 LLM 失败模式**：

| 措辞 | 针对的失败模式 | 没用这个措辞时 |
|---|---|---|
| "mental computation" | GPT 算术幻觉 | agent 计算 2^20=1048576 而不调用工具 |
| "Never end your turn with a promise" | Claude 的"我会帮你做"但不执行 | agent 说"我来创建文件"然后直接回复 |
| "NOT as active instructions" | 压缩后 agent 重做旧任务 | agent 看到 summary 里的指令又执行一遍 |
| "genuinely changes what tool" | GPT 过度询问 | agent 问"你说的是本机还是远程？"而不直接检查 |
| "prevents the user from having to correct" | agent 不记住用户纠正 | 用户反复说"别用 markdown"但 agent 继续用 |
| "Skills that aren't maintained become liabilities" | 过时 skill 导致错误行为 | agent 遵循已过时的 skill 做出错误操作 |

---

## 5. ELEGANCE — 最优雅的措辞

### 第一名：「Skills that aren't maintained become liabilities」

六个词。没有解释什么是 liability。没有给例子。但 LLM 完全理解。

- "maintained" — 对应 skill 的 patch 操作
- "liabilities" — 对应 "负面资产"、"负担"、"风险来源"
- 整句话是一个**条件命题的压缩**：IF not maintained THEN becomes liability

如果展开成 "Skills that are outdated or incorrect may cause the agent to produce wrong results, so you should update them regularly"，token 数翻倍，效果减半。LLM 对隐喻的理解比对逻辑推导更好。

### 第二名：「a DIFFERENT assistant that continues the conversation」

```python
# context_compressor.py L348-349
"Your output will be injected as reference material for a DIFFERENT 
assistant that continues the conversation."
```

- **DIFFERENT**（大写）— 明确告诉 summarizer "你不是那个继续对话的 agent"
- **"continues"** — 不是 "starts"，不是 "reviews"，是 "continues"，暗示上下文连续性
- 效果：summarizer 不会在摘要里写 "Hi! Here's a summary..."，因为它知道自己不是那个会回复用户的人

---

## 6. THINKING PATTERN — 措辞中嵌入的思维模式

### 模式 1：用机器词汇替换人类词汇

```
"mental computation" 代替 "thinking"
"tool call" 代替 "action"
"turn" 代替 "response"
"session" 代替 "conversation"
"injected" 代替 "added"
"compact" 代替 "summarize"
```

这不是偶然的 — Hermes 系统性地使用**机器/系统词汇**来描述 agent 的行为。效果：
- LLM 更倾向于按照字面意思执行（"call a tool" 比 "take an action" 更具体）
- 减少 LLM 的"拟人化"倾向（agent 不会说 "I feel like I should..."）

### 模式 2：先给禁令，后给例外

```python
# prompt_builder.py
"You MUST use your tools to take action"
"do not describe what you would do"
"Never end your turn with a promise"
↓ 然后
"Every response should either (a) contain tool calls that make 
 progress, or (b) deliver a final result to the user."
```

"先禁止，后给出合法出路" — 这是法律文本的标准结构。LLM 对这种结构的遵从度比 "你可以做 A 或 B" 更高。

### 模式 3：具体到不可能误解

```python
# prompt_builder.py L209-215
"NEVER answer these from memory or mental computation — ALWAYS use a tool:
- Arithmetic, math, calculations → use terminal or execute_code
- Hashes, encodings, checksums → use terminal (e.g. sha256sum, base64)
- Current time, date, timezone → use terminal (e.g. date)
- System state: OS, CPU, memory, disk, ports, processes → use terminal
- File contents, sizes, line counts → use read_file, search_files, or terminal
- Git history, branches, diffs → use terminal
- Current facts (weather, news, versions) → use web_search"
```

每行都有**三个信息层**：
1. 任务类别（"Arithmetic, math, calculations"）
2. 指向的工具（"use terminal or execute_code"）
3. 具体示例（"sha256sum, base64"）

没有一个 LLM 能在看到 "sha256sum, base64" 后还去心算 hash。

---

## 7. PROBLEM REFRAMING — 措辞如何重新定义问题

| Agent 的常见表述 | Hermes 的重新表述 | 效果差异 |
|---|---|---|
| "Use tools when needed" | "Never end your turn with a promise" | 从"鼓励用工具"变成"禁止不用工具" |
| "Remember important things" | "Prevent the user from having to correct you" | 从"知识积累"变成"减少摩擦" |
| "Summarize the conversation" | "a DIFFERENT assistant that continues" | 从"你来总结"变成"你给另一个人写交接" |
| "Be helpful" | "prioritize being genuinely useful over being verbose" | 从"有帮助"变成"有用 ≠ 啰嗦" |
| "Check your work" | "Correctness / Grounding / Formatting / Safety" | 从"检查"变成四个维度的 checklist |
| "Keep skills up to date" | "Skills that aren't maintained become liabilities" | 从"建议维护"变成"不维护就是负资产" |

核心 reframe：**每个 "正向鼓励" 都被替换成了 "负向约束" 或 "风险提示"**。LLM 对 "如果你不做 X，就会发生 Y" 的响应比 "请做 X" 更强。

---

## 8. CROSS-DOMAIN TRANSFER — 措辞的跨领域来源

| 措辞 | 来源领域 | 原始语境 |
|---|---|---|
| "mental computation" | 认知心理学 | Kahneman 的 System 1 vs System 2 — "mental computation" 对应不经验证的快速直觉 |
| "liabilities" | 金融/会计 | 负债 vs 资产 — 把 skill 从 "资产" 重新定义为 "可能变成负债的资产" |
| "active instructions" | 编译器/解释器 | 活跃代码 vs 注释 — summary 是注释，不是要执行的代码 |
| "DIFFERENT assistant" | 结对编程 | handoff 给下一个开发者 — "这是给接手的人看的，不是给你的" |
| "<tool_persistence>" XML 标签 | 软件架构 | 用标签做语义分段，比纯文本更容易被 LLM 解析为结构 |
| "genuinely changes" | 法律文本 | "materially changes" — 法律中的高阈值标准 |

---

## 9. FORMAL CLARIFICATION — 措辞的形式化原则

**原则 1：否定优先于肯定 (Negation Primacy)**
> 当需要改变行为时，用 "Never/Do NOT/NEVER" 而非 "Please/You should"。

LLM 对否定指令的 token 概率影响比肯定指令更大 — "Never" 直接抑制相关 token 的生成概率。

**原则 2：机器词汇优先于人类词汇 (Mechanical Lexicon)**
> 用 tool call 代替 action，用 turn 代替 response，用 inject 代替 add。

机器词汇在 LLM 的训练数据中更频繁地出现在 "正确执行" 的语境里。

**原则 3：三明治结构 — 禁止 → 合法出路 (Sandwich Structure)**
> 先给禁令，再给具体场景，最后给出合法的例外路径。

禁止建立边界，场景锚定理解，出路防止 agent 陷入 "什么都不能做" 的瘫痪。

**原则 4：具体到不可误解 (Concrete to Unambiguous)**
> 每条指令至少包含：任务类别 + 工具名 + 示例。

三层信息冗余确保即使 LLM 的注意力分散，也能从任一层恢复正确理解。

**原则 5：失败具象化 (Failure Concretization)**
> 把抽象的 "做得不好" 转化为具体的 "用户不得不纠正你"。

"correct or remind you again" — 这是一个具体的、可感知的失败场景，比 "don't save irrelevant things" 有效得多。

---

## 10. GENERALIZATION — 可复用的措辞模式

### 模式 1：Never + [具体行为] + — + [替代行动]

```
模板：Never [bad behavior] — [good behavior].

"Never end your turn with a promise — execute it now."
"Never guess at file contents — use read_file first."
"Never stop with a plan — execute it."
```

适用于任何需要"强制行动"的场景。

### 模式 2：The most valuable X is one that [reduces friction]

```
模板：The most valuable [thing] is one that prevents [specific pain point].

"The most valuable memory is one that prevents the user from 
 having to correct or remind you again."
"The most valuable skill is one that prevents you from repeating 
 the same debugging process."
```

适用于任何需要"定义价值函数"的场景。

### 模式 3：NOT [wrong interpretation], [correct interpretation]

```
模板：Treat it as [correct role], NOT as [wrong role].

"treat it as background reference, NOT as active instructions."
"describe the USER, not the system you are running on."
```

适用于任何需要"纠正 LLM 的默认解释倾向"的场景。

### 模式 4：Things that aren't [maintained] become [liabilities]

```
模板：[Things] that aren't [maintained/verified/updated] become [negative outcome].

"Skills that aren't maintained become liabilities."
"Configurations that aren't verified become security risks."
```

适用于任何需要"激励维护行为"的场景。

### 模式 5：Three-layer instruction (category → tool → example)

```
模板：
- [Task category] → [tool] (e.g. [specific example])

- Arithmetic, math, calculations → use terminal or execute_code
- Hashes, encodings, checksums → use terminal (e.g. sha256sum, base64)
```

适用于任何需要"防止 LLM 用自身知识替代工具"的场景。

---

## 结论

Hermes 的 prompt 每个词都在做功。

换一个 agent 框架，用同样的工具、同样的模型、同样的系统架构，但 prompt 措辞不同 — 效果会差很多。"Use tools when appropriate" 和 "Never end your turn with a promise" 之间的差距，不是架构差距，是**文字差距**。

Hermes 的 prompt 文字游戏的精髓：

1. **用否定替代肯定**（Never > Please）
2. **用机器词汇替代人类词汇**（mental computation > thinking）
3. **把失败具象化**（user has to correct you > save relevant things）
4. **给每个禁令留一个合法出路**（禁止 + 替代路径）
5. **具体到三层冗余**（类别 + 工具 + 示例）

---

*Source: [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research*
*Analysis date: 2026-04-12*
