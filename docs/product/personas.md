# Personas

## Primary: Cost-aware solo agent user

- **Who:** A developer running opencode (or a similar coding agent) for daily work. Pays for API tokens out of pocket or via a small team budget.
- **Workflow:** Planning step (architecting, decomposing, hard debugging) followed by execution step (writing/editing code, running tests, applying fixes). Knows from experience these need different model tiers.
- **Pain:** Model choice dominates cost by 1–2 orders of magnitude, but there's no tool that connects intelligence × price **per task type**. They're either overpaying (using a premium model for everything) or under-performing (using a cheap model for planning).
- **Job to be done:** "Pick a pair of models — one for planning, one for execution — that minimizes my total spend without ruining the hard steps."
- **Decision style:** Wants a clear recommendation, fast. Will glance at the reasoning (quadrants, ratio) but won't read methodology. Trust erodes fast if a recommendation looks wrong on its face (e.g. a known-weak model in the "planning" slot).

## Secondary (not yet served): Team lead doing build-vs-buy

- Mentioned in passing during discovery; explicitly **out of scope** for the mature version per vision §"Who it's for." Recorded so it doesn't leak into scope.

## Explicitly excluded: Self-hoster optimizing GPU TCO

- Per README §Caveats and vision §"What it is not." The cost axis is irrelevant for them; the bar chart (intelligence only) is the useful surface, and that's incidental, not the product.