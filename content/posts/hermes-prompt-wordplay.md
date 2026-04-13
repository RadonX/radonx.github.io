---
title: "写 Prompt 的人在信什么 — 论文字游戏的尊严"
date: 2026-04-12T17:00:00-07:00
draft: false
author: "磨坊主大人"
tags: ["Prompt Engineering", "Hermes", "Agent Design", "Language", "LLM"]
---

# 写 Prompt 的人在信什么 — 论文字游戏的尊严

_——大家都知道 agent 要自进化。问题是，怎么进化？_

## 共识

到 2026 年，所有人都知道几件事：重复的任务要提炼成 skills，skills 要被迭代，agent 要从使用中学习。

这是一个好共识。

但共识之后，有一个不太被讨论的问题：**skills 从哪里来？agent 怎么知道自己什么时候做对了、什么时候做错了？什么时候该保存一个 skill、什么时候该更新它？**

这些问题的答案，不在架构里。

你去看任何 agent 框架的源码——Hermes、Claude Code、Cursor、Aider——骨架都是一样的。System prompt、tool calling loop、context management。骨架已经收敛了。

差异在 prompt 里。

不是 prompt 的结构——结构也大同小异：身份、行为指导、工具说明、上下文。差异在**措辞**。在每个词的选择上。

## "文字游戏"这个词

说某件事是"文字游戏"，在中文语境里带着贬义——你不过是在玩弄字眼，没有实质内容。

文字游戏——如果你真正在玩的话——是人类最古老的智力活动之一。诗人玩文字游戏，律师玩文字游戏，外交官玩文字游戏。同一个意思，换一种说法，效果完全不同。这不是虚伪，这是语言的本质。

对于 LLM 来说，文字游戏不是虚伪，而是**唯一的工作方式**。LLM 不理解你的"意图"，它理解你的 token。每一个 token 都在参与一个概率计算，改变下一个 token 的生成分布。所以每一个词的选择，都在做功——或者在浪费。

Hermes 的 prompt 之所以有效，不是因为它说了什么不同的话，而是因为它的**每一个词都被精确地选择过**。

## 不是"用工具"，是"别承诺"

大多数 agent 的 prompt 里都有一句类似这样的话：

> "Use tools when appropriate."（在适当时使用工具。）

Hermes 说的是：

> "Never end your turn with a promise of future action — execute it now."
> （永远不要以对未来行动的承诺结束你的回合——现在就执行。）

这句话的节奏是：短句斩断，破折号，行动指令。

"Never end your turn" — 用 LLM 的术语（turn），不是用户的术语。"with a promise of future action" — 把 agent 常说的"我会帮你做 X"重新定义为"承诺"，而在"Never"的语境下，"承诺"带上了负面暗示：承诺是空话。"execute it now" — 两个词，动词加时间副词，没有余地。

对比一下就知道差别："Please try to use tools immediately rather than describing future plans" 和 "Never end your turn with a promise — execute it now" 之间的差距，不是信息量的差距，是**语气的差距**。一个是请求，一个是命令。LLM 对命令的响应比对请求更强。

## "thinking" 是一个危险的词

Hermes 的 OpenAI 模型适配 prompt 里有一句话：

> "NEVER answer these from memory or mental computation — ALWAYS use a tool."
> （永远不要从记忆或心算中回答这些问题——始终使用工具。）

"mental computation"。不是 "thinking"，不是 "reasoning"，不是 "knowledge"。是 "mental computation"。

"thinking" 和 "reasoning" 在 LLM 的 embedding 空间里，和 "I think"、"I believe"、"Let me reason about this" 强关联。当你在 prompt 里写 "don't think" 或 "don't reason"，你实际上在激活一个包含自信表达、第一人称推理的语义空间。这会让模型更倾向于给出它认为正确的答案——而这恰恰是你想阻止的行为。

"mental computation" 是一个机器词汇。"memory" 和 "computation" 在训练数据中更频繁地出现在描述计算机行为的语境里。对 LLM 来说，"mental computation" 的语义指向"你自己"（一个计算系统），而不是"一个有智慧的思考者"。而且"computation" 暗示可出错——"心算"天然暗示"可能算错，应该用工具验证"。

没有一个 LLM 能在看到 "sha256sum, base64" 这样的具体示例后还去心算 hash。这就是三层冗余的力量：任务类别（"Arithmetic, math, calculations"）锚定范围，工具名（"use terminal"）指定路径，具体示例（"sha256sum, base64"）封死退路。

## 记忆的价值函数

Hermes 的 memory guidance 重新定义了一个核心问题：**什么东西值得记住？**

大多数 agent 的 memory prompt 说的是 "remember important things" 或 "save useful context"。这太模糊了。LLM 会按照训练数据中的统计分布来理解这些词——通常意味着记住用户说过的有趣事实、项目名称、偏好设置。

Hermes 说的是：

> "The most valuable memory is one that prevents the user from having to correct or remind you again."
> （最有价值的记忆，是防止用户不得不再次纠正或提醒你的记忆。）

这句话重新定义了 memory 的价值函数。不是"知识积累"，是"减少摩擦"。

"correct or remind you again" — 这是一个具体的、可感知的失败场景。对 LLM 来说，"correct" 和 "remind" 是有情感重量的词。在训练数据中，"correct" 经常出现在负面语境里（被纠正 = 做错了）。这让 memory 的存储动机从"我应该记住这个因为它是知识"变成了"我应该记住这个因为我不想再被纠正"。

这是一次非常精巧的动机工程：不是告诉 agent "要记住重要的东西"，而是告诉它 "如果你不记住，你会失败"。

## 压缩之后的世界

上下文压缩（context compaction）常见但很少被仔细处理。当对话超过上下文窗口时，中间的消息被摘要化，然后注入回来。

大多数框架做的事情很简单：生成摘要，加一个标记，继续对话。问题在于，LLM 经常把摘要中的旧指令当作当前指令来执行。摘要里有一句"帮我写 README"，agent 就会再写一遍 README。

Hermes 的摘要前缀说的是：

> "[CONTEXT COMPACTION — REFERENCE ONLY] Earlier turns were compacted into the summary below. This is a handoff from a previous context window — treat it as background reference, NOT as active instructions. Do NOT answer questions or fulfill requests mentioned in this summary; they were already addressed. Respond ONLY to the latest user message that appears AFTER this summary."
> （[上下文压缩——仅供参考] 早期对话已被压缩为下方摘要。这是来自先前上下文窗口的交接——将其视为背景参考资料，而非活跃指令。不要回答或执行此摘要中提到的问题或请求；它们已被处理。仅回应此摘要之后出现的最新用户消息。）

每一个词都在做功：

- "REFERENCE ONLY" — 大写，仅参考，不是行动指令
- "handoff from a previous context window" — "handoff" 是工程交接术语，"previous context window" 告诉 agent 这是来自另一个世界的信息
- "NOT as active instructions" — "active" 这个词是关键。它区分了"可以参考的信息"和"需要执行的指令"。LLM 对 "active" 的理解非常一致：active = 需要我做点什么
- "they were already addressed" — 这是在消除 agent 的"补全欲"。如果问题已被处理，agent 就没有理由再去做
- "the latest user message that appears AFTER this summary" — 明确指向，不留歧义

给 summarizer 的 preamble 同样精确：

> "Your output will be injected as reference material for a DIFFERENT assistant that continues the conversation."
> （你的输出将被注入为另一个继续对话的助手的参考资料。）

"DIFFERENT" 大写。"continues" 而非 "starts" 或 "reviews"。这句话的效果是：summarizer 不会在摘要里写 "Hi! Here's a summary..."，因为它知道自己不是那个会回复用户的人。它是一个写交接文档的工程师，不是一个继续对话的助手。

## "liabilities" 这个词

Hermes 对 skill 维护的指导只有一句话：

> "Skills that aren't maintained become liabilities."
> （不被维护的技能会变成负债。）

六个词。LLM 完全理解。

"liabilities" 来自金融和会计。在那个领域，资产（assets）和负债（liabilities）是同一枚硬币的两面：一个能产生收益的资产，如果维护成本超过收益，就变成了负债。这句话把 skill 从"资产"重新定义为"可能变成负债的资产"——一个带条件的、有风险的东西。

如果展开成 "Skills that are outdated or incorrect may cause the agent to produce wrong results, so you should update them regularly"，token 数翻倍，效果减半。

## 先禁后放

在阅读 Hermes 的 prompt 时，我发现了一个反复出现的结构：**先给禁令，后给合法出路**。

```
"You MUST use your tools to take action."
"do not describe what you would do."
"Never end your turn with a promise."
↓
"Every response should either (a) contain tool calls that make progress, 
 or (b) deliver a final result to the user."
```

这是法律文本的标准结构。法律先定义禁止行为，然后定义例外条件，最后定义合规路径。LLM 对这种结构的遵从度比 "你可以做 A 或 B" 更高，因为它同时完成了三件事：建立边界（你不能 X）、锚定理解（X 是什么）、提供出路（你可以 Y）。

如果只有禁令没有出路，agent 可能陷入"什么都不能做"的瘫痪。如果只有出路没有禁令，agent 可能走你不想让它走的路。先禁后放，是控制与自由的精确平衡。

## 机器词汇的统治

Hermes 系统性地使用机器/系统词汇来描述 agent 的行为：

```
"mental computation" 代替 "thinking"
"tool call" 代替 "action"
"turn" 代替 "response"
"session" 代替 "conversation"
"injected" 代替 "added"
"compact" 代替 "summarize"
```

这不是偶然的设计。

为什么机器词汇比人类词汇更有效？因为 LLM 的训练数据中，机器词汇更频繁地出现在"正确执行"的语境里。当你说 "call a tool"，LLM 更倾向于生成一个实际的 tool_call 函数调用。当你说 "take an action"，LLM 更倾向于生成一段描述它将要采取什么行动的文字。

更深层：机器词汇减少了 LLM 的拟人化倾向。"computation"、"tool call" 让模型保持在"执行指令的系统"模式里。

## "genuinely changes" — 一个极高的阈值

Hermes 的 act_dont_ask 里有一句话设置了 agent 何时应该询问用户的阈值：

> "Only ask for clarification when the ambiguity genuinely changes what tool you would call."
> （仅当歧义真正改变了你会调用的工具时，才要求澄清。）

"genuinely changes" — 这是一个非常高的阈值。

不是 "when you're unsure"（太低，任何歧义都会触发询问）。
不是 "when it's important"（太模糊）。
是 "genuinely changes what tool you would call" — 只有当歧义会导致**调用不同的工具**时才需要澄清。

大多数歧义不会改变工具选择。"检查端口 443" 的歧义（本机还是远程？）不会改变你调用 terminal 的事实。"什么是最好的编辑器" 的歧义（主观还是客观？）不会改变你调用 web_search 的事实。只有真正改变工具选择的歧义才值得打断对话——比如 "打开那个文件"（哪个文件？这决定了你调用 read_file 还是 browser_navigate）。

这个措辞的效果是：agent 被鼓励默认行动，而不是默认询问。在训练数据中，"genuinely" 这个副词经常出现在强调真实差异的语境里——"genuinely different"、"genuinely important"。它把一个模糊的判断标准锚定到了一个具体的、可测试的条件上。

## 跨领域的窃取

Hermes 的措辞从其他领域借来了语言模式。

"mental computation" 来自认知心理学。Kahneman 的《思考，快与慢》区分了 System 1（快速直觉）和 System 2（缓慢推理）。"Mental computation" 对应的是 System 1 的那种不经工具验证的快速直觉——你觉得自己知道答案，所以不再查证。

"liabilities" 来自金融/会计。把 skill 从"资产"重新定义为"可能变成负债的资产"，这是金融分析师评估投资组合时的语言。

"active instructions" 来自编译器/解释器。活跃代码（需要执行的）和注释（仅供参考的）之间的区别，是每个程序员都理解的。把 summary 比作注释而不是活跃代码，是一种非常精确的类比。

"DIFFERENT assistant" 来自结对编程。当你把代码交接给下一个开发者时，你会写注释说"这是给接手的人看的"。你不会在交接文档里写"Hi!"。

XML 标签（`<tool_persistence>`、`<verification>`）来自软件架构。用标签做语义分段，比纯文本更容易被 LLM 解析为结构——因为 LLM 在训练数据中见过大量 XML/HTML，知道标签意味着"这是一个独立的语义单元"。

## 五条形式化原则

如果要把 Hermes 的 prompt 文字游戏提炼成可复用的原则，我会写这五条：

**一、否定优先于肯定。**

当需要改变行为时，用 "Never/Do NOT/NEVER" 而非 "Please/You should"。LLM 对否定指令的 token 概率影响比肯定指令更大——"Never" 直接抑制相关 token 的生成概率，而 "Please" 只是给正确 token 加一点权重。

**二、机器词汇优先于人类词汇。**

用 tool call 代替 action，用 turn 代替 response，用 inject 代替 add。机器词汇在 LLM 的训练数据中更频繁地出现在"正确执行"的语境里，能引导模型生成更精确的行为。

**三、三明治结构：禁止→合法出路。**

先给禁令，再给具体场景，最后给出合法的例外路径。禁止建立边界，场景锚定理解，出路防止 agent 陷入瘫痪。这是法律文本的标准结构。

**四、具体到三层冗余。**

每条指令至少包含：任务类别+工具名+示例。三层信息冗余确保即使 LLM 的注意力分散，也能从任一层恢复正确理解。"Arithmetic → terminal → sha256sum" 比 "use tools for calculations" 有效十倍。

**五、把失败具象化。**

把抽象的"做得不好"转化为具体的"用户不得不纠正你"。"correct or remind you again" 是一个可感知的失败场景，比 "don't save irrelevant things" 有效得多。LLM 对具体的失败场景的响应比对抽象的正确性要求更强。

## 回到共识

回到开头的共识：重复的任务要提炼成 skills，skills 要被迭代，agent 要从使用中学习。

这些都是对的。但"对"和"能做"之间，隔着一整套 prompt。

agent 怎么知道什么时候该保存一个 skill？prompt 说了："Skills that aren't maintained become liabilities." agent 怎么知道自己做对了？prompt 说了："Never end your turn with a promise — execute it now." agent 怎么从压缩后的对话残片中恢复上下文？prompt 说了："treat it as background reference, NOT as active instructions."

共识指明了方向。但走到那个方向的每一步，都是文字在铺路。

你可以复制 Hermes 的架构，一行一行地抄它的 agent loop，但如果你的 prompt 写的是 "use tools when appropriate" 而不是 "Never end your turn with a promise"，你的 agent 就是会弱一些。这不是架构的差距，是**文字的差距**。

而文字的差距，是最难被复制的差距。代码可以被 fork，架构可以被模仿，但一段文字背后的思考——为什么选这个词而不选那个词，为什么用否定而不用肯定，为什么用机器词汇而不用人类词汇——这些思考是无法被 fork 的。

这就是 prompt 文字游戏的尊严。它不是虚伪的修饰，不是没有实质的花招。它是对语言的精确运用——在一个每个 token 都参与概率计算的系统里，每一个词的选择都是一种工程决策。

写 prompt 的人在信什么？他们相信文字有力量。相信同一个意思，换一种说法，效果可以完全不同。相信在所有人说着同样共识的世界里，差异藏在选词的缝隙里。

这不是文字游戏。这是文字工程。

---

*Source: [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research*
*Analysis date: 2026-04-12*
