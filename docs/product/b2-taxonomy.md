# B2: Coding-agent task taxonomy

The concluded taxonomy from reconciling `b2-evidence/local-session-mining.md` and `b2-evidence/online-research.md`. This retires assumption A2 and unblocks B1.

## Taxonomy: 3 task types

| Type | Definition | Fitness dimension (feeds B6) | Default model |
|---|---|---|---|
| **PLANNING** | Understand requirements/codebase/logs, form a hypothesis, design an approach, scope work, answer factual questions about the code, draft prose deliverables. Includes exploratory debugging (root cause unknown) and QA (read-to-explain). Deliverable may be a plan, a hypothesis, or a prose answer — the common factor is *reasoning over large context before producing a conclusion*. | Long-context comprehension + causal reasoning. Distinct from code-generation skill. | The planning model (strong/expensive). |
| **EXECUTION** | Write/edit code, apply a settled fix, run tests and iterate until green, perform mechanical edits and commit housekeeping. The design is already settled; the work is producing the artifact. | Edit-precision / first-pass-green rate under a spec. Narrower than general intelligence. | The execution model (cheaper). |
| **VERIFICATION** | Independently evaluate output: run checks, detect defects, review code against requirements, decide whether to proceed or re-run. A quality gate, not artifact production. | Defect-detection / discriminating judgment. Distinct from generation. | Often $0 — deterministic tests, lint, CI. When model-based, uses the execution model. Does **not** force a 3rd recommended model. |

### What was folded in and why

- **QA** (local report's 3rd tier: read code, explain, no edit) → folded into **PLANNING**. The deliverable is prose, but the *model-selection dimension* is long-context reasoning, identical to planning. Folding it into execution would mislabel the reasoning load.
- **TRIVIAL** (commit housekeeping, git-status reads) → folded into **EXECUTION**. 3% of volume, always at the tail, no distinct model-selection dimension. Any instruction-following model suffices.
- **Repair/issue-resolution** (online report) → not a separate tier. In the local traces, repair was inseparable from planning (diagnosing) until the cause was known, then collapsed into execution (fixing). It's a *session shape*, not a *task type* for cost modeling.

### Why VERIFICATION and not QA is the 3rd tier

The two reports independently surfaced a 3rd tier but named different ones. Verification wins because:

1. **It affects the cost model.** Failed verification → re-run execution → more tokens. QA doesn't loop back; it's a one-way read-and-explain. A cost-optimization tool must model the loop.
2. **It's externally validated.** Cursor's planner/worker/judge architecture, VS Code's separate review stage, and the Code Review Agent Benchmark all treat verification as a distinct capability with its own fitness dimension (defect detection, not generation).
3. **It doesn't inflate the recommendation.** Verification is frequently deterministic ($0) or billed to the execution model. The pair output (D2) stays a pair; verification is a cost line item, not a 3rd model slot. This is the explicit reason D2 is *not* reopened.

## Default task mix

**Point estimate: PLANNING ~65%, EXECUTION ~30%, VERIFICATION ~5%** (token-weighted).

This is derived from the local session-mining aggregate (PLANNING 68% + QA 6% = 74%; EXECUTION 23% + TRIVIAL 3% = 26%), with ~5% carved out of execution for the verification sub-activity that the local agent labeled as execution (test-running, iterating-to-green) but the online evidence argues is distinct.

### The variance is the real finding

The point estimate is misleading without its range. Session-to-session, from the local traces:

- **PLANNING: 40% → 99%** of tokens. Dominates investigation-heavy sessions (debugging, research, commit analysis). Drops toward 40% in build-out sessions where the plan was settled early.
- **EXECUTION: 0% → 57%.** Zero in pure-research/Q&A sessions; majority in test-driven build-outs.
- **VERIFICATION: 0% → ~15%.** Zero when the user didn't run gates; highest in sessions with active test-iteration loops.

**Implication for the product:** a hardcoded 60/40 default will be wrong for a large fraction of users. This is why B5 (adjustable task-mix slider) is promoted from "later" to "next" — the mix is genuinely variable, and a user-adjustable control is the honest fix. B1's pair output should surface the mix as a visible, adjustable parameter from day one, not hide it as a constant.

### Why the local number (not the literature's) is the default

The online research found no published token-weighted task mix for coding agents. The closest proxy (Khojah et al.) reported planning+design at ~12% — but that's *dialogue-counted* from ChatGPT sessions with 24 professionals, not *token-weighted* from coding-agent sessions. Coding agents read massive tool_results (logs, docs, diffs) that inflate planning's token share far beyond its dialogue-count share. For a per-token cost tool, the token-weighted local number is the relevant one. The literature proxy is recorded as a sanity check, not the basis.

## How this feeds B1 (the pair output)

B1 ranks a pair (planning model + execution model) by expected $ across the task mix. Concretely:

```
expected_cost = (planning_share × planning_model_cost_per_1m)
              + (execution_share × execution_model_cost_per_1m)
              + (verification_share × verification_cost)
```

Where `verification_cost` is 0 if deterministic gates are assumed, or `execution_model_cost_per_1m` if model-based verification is assumed. B1 ships with the deterministic assumption (verification = $0) as the default, and the model-based assumption as a toggle — because the verification tier's cost is the one a user is most likely to disagree with.

## Open questions deferred to B6 (not blocking B1)

- **Is a model's "planning fitness" measurable separately from general intelligence?** Both reports say yes (long-context comprehension, causal reasoning) but no coding-agent benchmark currently splits it. B6 owns this.
- **Is "verification fitness" (defect detection) measurable separately?** The Code Review Agent Benchmark suggests yes. B6 evaluates whether to source it.
- These don't block B1 because B1's first version uses general intelligence as the fitness proxy for both roles, with the taxonomy providing the *cost weighting*, not a per-type fitness score. Per-type fitness is the B6 graduation.