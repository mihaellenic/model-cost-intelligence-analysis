# B2 online research: coding-agent task taxonomy and task mix

## 1. Sources examined

11 sources: five empirical/benchmark papers, two trace datasets, two vendor workflow sources, one routing paper, and one review benchmark.

- [Khojah et al.](https://arxiv.org/html/2404.14901) — FSE observational study; strong direct task-mix evidence but only 24 ChatGPT users, not coding agents.
- [Hao et al.](https://arxiv.org/html/2403.10468) — empirical analysis of 580 shared developer chats; useful taxonomy, selection-biased toward publicly shared PR/issue chats.
- [AgentTelemetry](https://github.com/Krishnachaitanyakc/AgentTelemetry) — 2026 conference benchmark/case study; quantitative spans from a constrained SWE-bench agent.
- [SyFI TraceLab](https://tracelab.cs.washington.edu/) — public university trace dataset; real Codex/Claude Code sessions, but no semantic task labels.
- [Microsoft VS Code guidance](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide) — first-party, prescriptive workflow documentation.
- [Cursor](https://prod.cursor.com/blog/scaling-agents) — vendor research write-up; operationally credible but self-reported.
- [LiveCodeBench](https://arxiv.org/abs/2403.07974), [BigCodeBench](https://arxiv.org/abs/2406.15877), and [SWE-Lancer](https://proceedings.mlr.press/v267/miserendino25a.html) — strong benchmark evidence for distinct task capabilities, not workflow mixes.
- [FrugalGPT](https://arxiv.org/abs/2305.05176) — foundational routing paper; validates difficulty/reliability routing, but is not coding-specific.
- [Code Review Agent Benchmark](https://arxiv.org/abs/2603.23448) — recent preprint defining code review as a standalone agent task.

## 2. Task types observed

| Type label | One-line definition | Source(s) that use it | Frequency mentioned across sources |
|---|---|---|---|
| Planning / context / consultation | Understand requirements, codebase, alternatives, and create an actionable plan. | [Khojah et al.](https://arxiv.org/html/2404.14901), [VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide), [Cursor](https://prod.cursor.com/blog/scaling-agents), [SWE-Lancer](https://proceedings.mlr.press/v267/miserendino25a.html) | 4/11 |
| Implementation / artifact manipulation | Generate, modify, refactor, or otherwise produce code and related artifacts. | [Khojah et al.](https://arxiv.org/html/2404.14901), [Hao et al.](https://arxiv.org/html/2403.10468), [VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide), [LiveCodeBench](https://arxiv.org/abs/2403.07974), [BigCodeBench](https://arxiv.org/abs/2406.15877) | 7/11 |
| Repair / issue resolution | Diagnose failures and change code in response to errors or feedback. | [Hao et al.](https://arxiv.org/html/2403.10468), [VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide), [LiveCodeBench](https://arxiv.org/abs/2403.07974), [Khojah et al.](https://arxiv.org/html/2404.14901) | 4/11 |
| Review / verification / testing | Independently evaluate output, run checks, identify defects, and decide whether to proceed. | [VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide), [Cursor](https://prod.cursor.com/blog/scaling-agents), [Hao et al.](https://arxiv.org/html/2403.10468), [AgentTelemetry](https://github.com/Krishnachaitanyakc/AgentTelemetry), [Code Review Agent Benchmark](https://arxiv.org/abs/2603.23448) | 6/11 |
| Tool use / retrieval / execution | Search/read context, invoke libraries or tools, execute code, and interpret results. | [AgentTelemetry](https://github.com/Krishnachaitanyakc/AgentTelemetry), [TraceLab](https://tracelab.cs.washington.edu/), [BigCodeBench](https://arxiv.org/abs/2406.15877), [LiveCodeBench](https://arxiv.org/abs/2403.07974) | 4/11 |
| Learning / training | Build transferable understanding rather than solve the immediate work item. | [Khojah et al.](https://arxiv.org/html/2404.14901), [Hao et al.](https://arxiv.org/html/2403.10468) | 2/11 |
| Managerial judgment | Select between technical proposals or prioritize work rather than implement it. | [SWE-Lancer](https://proceedings.mlr.press/v267/miserendino25a.html) | 1/11 |

## 3. Volume share per source

| Source | Context (tool/population) | Task type shares reported (with unit — tokens / turns / time) | Notes on method |
|---|---|---|---|
| [Khojah et al.](https://arxiv.org/html/2404.14901) | 24 professionals, GPT-3.5, five workdays; 180 SE dialogues | **Purpose, dialogues:** consultation 62.2%, artifact manipulation 31.7%, training 6.1%. **SDLC stage, dialogues:** planning/analysis 7.8%, design 4.4%, implementation 57.8%, testing 10.6%, unassigned 19.4%. | Manual classification; measures interactions, not agent tokens. |
| [Hao et al.](https://arxiv.org/html/2403.10468) | 198 PR and 329 issue initial SE prompts | **PR / issue prompts:** code generation 20% / 27%; conceptual 18% / 14%; how-to 13% / 22%; issue resolution 12% / 14%; review 9% / 4%. | Manual taxonomy of public shared chats; initial prompt only, not full-session effort. |
| [AgentTelemetry](https://github.com/Krishnachaitanyakc/AgentTelemetry) | Instrumented GPT-4o-mini ReAct agent on 112 SWE-bench Lite cases | **Span count:** reasoning 29.9%, LLM calls 28.1%, retrieval 21.9%, memory 7.3%, tool calls 4.4%, planning 3.7%, agent 3.7%, guardrail 1.1%. | Operational telemetry spans, not semantic workflow phases or tokens. |
| [TraceLab](https://tracelab.cs.washington.edu/) | 8,058 real Claude Code/Codex sessions, 665,453 agent steps | **Agent-step trigger:** 85.7% tool-triggered for both provider groups. | Strong evidence that tool-result handling is a major execution loop; it does not label planning/code/review. |

## 4. Aggregate default mix

There is **no published default token mix** for planning versus execution in coding-agent sessions. I found no credible “20% planning / 80% execution tokens” estimate.

The closest quantitative proxy is the small professional-ChatGPT study: **planning + design 12.2%, implementation 57.8%, testing 10.6%, unassigned 19.4% of dialogues**. Its alternative purpose taxonomy clashes with that split: **62.2% consultation, 31.7% artifact manipulation, 6.1% training**. [Khojah et al.](https://arxiv.org/html/2404.14901)

So the defensible default is: **do not price a two-role workflow from literature alone**. A provisional interaction-count prior could be planning/context ~10–15%, implementation ~55–65%, verification ~10–15%, other ~15–25%; it must be calibrated against local agent traces before converting to token cost.

## 5. A2 verdict

**A 3rd tier is warranted**: **verification/review**. Cursor’s otherwise two-way planner/worker structure adds a judge; VS Code explicitly separates planning, implementation, testing/debugging, and fresh-context review; benchmarks separately evaluate self-repair and code review. [Cursor](https://prod.cursor.com/blog/scaling-agents) [VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide) [LiveCodeBench](https://arxiv.org/abs/2403.07974) [Code Review Agent Benchmark](https://arxiv.org/abs/2603.23448)

This need not mean a third paid model: verification may be a cheap model plus deterministic tests/lint/CI. But merging it into “execution” hides a different success criterion and an important quality gate.

## 6. One-sentence-per-type fitness note

- **Planning/context:** fitness is long-context, architectural reasoning, and source-grounded synthesis; VS Code explicitly recommends a reasoning/deep-understanding-optimized model for planning. [VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide)
- **Implementation:** fitness is instruction following plus code/API composition, measured separately by BigCodeBench’s complex-instruction and multi-library tasks. [BigCodeBench](https://arxiv.org/abs/2406.15877)
- **Repair:** fitness is diagnosis and feedback incorporation, separately measured by LiveCodeBench self-repair. [LiveCodeBench](https://arxiv.org/abs/2403.07974)
- **Review/verification:** fitness is discriminating judgment against requirements and defect detection, not merely generating plausible code; review benchmarks score this directly. [Code Review Agent Benchmark](https://arxiv.org/abs/2603.23448)
- **Tool use/retrieval:** fitness is selecting tools, navigating state, and interpreting results; BigCodeBench and LiveCodeBench measure tool/function use and code execution separately. [BigCodeBench](https://arxiv.org/abs/2406.15877) [LiveCodeBench](https://arxiv.org/abs/2403.07974)
- **Learning/training:** fitness is accurate explanation and pedagogy; this is distinct from immediate task completion and has no dedicated coding-agent benchmark in this source set. [Khojah et al.](https://arxiv.org/html/2404.14901)
- **Managerial judgment:** fitness is comparative trade-off selection under a rubric, separately tested by SWE-Lancer’s managerial tasks. [SWE-Lancer](https://proceedings.mlr.press/v267/miserendino25a.html)

## 7. Source appendix

- [Beyond Code Generation](https://arxiv.org/html/2404.14901) — Ranim Khojah et al., FSE 2024. Observed 24 professionals and 180 SE dialogues; supplies the best available purpose and lifecycle interaction mix.
- [Developers’ Shared Conversations with ChatGPT](https://arxiv.org/html/2403.10468) — Huizi Hao et al., 2024. Manually labels 580 PR/issue initial prompts into 16 inquiry types and reports their frequencies.
- [AgentTelemetry](https://github.com/Krishnachaitanyakc/AgentTelemetry) — Krishna Chaitanya Balusu, AIware 2026. Defines nine agent-telemetry span types and reports their distribution in a 112-case SWE-bench trace.
- [SyFI TraceLab](https://tracelab.cs.washington.edu/) — SyFI, University of Washington, 2026 snapshot. Public real-world Claude Code and Codex trace data; useful for token and tool-loop composition, not task semantics.
- [Set up a context engineering flow in VS Code](https://code.visualstudio.com/docs/agents/guides/context-engineering-guide) — Microsoft, living documentation accessed 2026-08-29. Specifies planning, implementation, testing/debugging, and independent review workflows.
- [Scaling long-running autonomous coding](https://prod.cursor.com/blog/scaling-agents) — Wilson Lin/Cursor, 2026-01-14. Describes planners, workers, and a judge in large-scale autonomous coding experiments.
- [LiveCodeBench](https://arxiv.org/abs/2403.07974) — Naman Jain et al., 2024; ICLR 2025. Separates generation, self-repair, code execution, and test-output prediction.
- [BigCodeBench](https://arxiv.org/abs/2406.15877) — Terry Yue Zhuo et al., 2024; ICLR 2025. Measures complex instruction following and multi-library function/tool composition.
- [SWE-Lancer](https://proceedings.mlr.press/v267/miserendino25a.html) — Samuel Miserendino et al., ICML 2025. Separates independent engineering tasks from managerial proposal-selection tasks.
- [FrugalGPT](https://arxiv.org/abs/2305.05176) — Lingjiao Chen, Matei Zaharia, James Zou, 2023. Shows routing should react to query reliability/difficulty rather than assume a fixed task mix.
- [Code Review Agent Benchmark](https://arxiv.org/abs/2603.23448) — Yuntong Zhang et al., 2026 preprint. Treats code review as a distinct evaluable agent capability.
