# B16 task: lens card — three purpose-labeled strategies + capability ceiling (D20+D21)

## Context

You are implementing **B16** for "Model Cost Intelligence Analysis". Read in
`docs/product/decision-log.md`: **D18** (frontier-band planning floor — do not
change), **D19** (pair separation — do not change), **D20** (lens card — this
task), **D21** (capability-ceiling reference row — this task). Also read
`docs/product/b15-report.md` for the current pair-card state.

**Why (trial 2 outcome):** the mechanics are now trusted, but the card "feels
one-note" — the top-3 was `glm-5.3-flash` planning over three DeepSeek
executors. The ranked list is correct; it's just three answers to the *same*
question (minimize spend). D20's solution: present **purpose-labeled
strategies** — each the provably optimal pair for its own objective — instead
of rank positions. D21 adds a fourth row, the **capability ceiling** (best
planning + best execution regardless of cost), as the contrast that makes the
cost optimization's value visible. This is **presentation-only**: no floor,
separation, or ranking changes.

## Constraints that DO NOT change

- Floors: planning ≥ frontier band (max − 8, band-adjustable), execution ≥
  median — computed exactly as today.
- D19 separation (≥1.5× price OR ≥2.0 intelligence points) — every displayed
  pair must satisfy it.
- The **recommended pair stays the expected-$ argmin** over all qualifying
  pairs — same math, same top position, same price. Trial 2's mechanics were
  approved; do not touch the ranking.
- `src/lib/pair.js` stays a pure module. Lens selection is a pure function of
  (models, mix, verification toggle, band) so it's testable without DOM.

## The three rows

### Row 1 — "Cheapest qualifying pair" (current recommended pair)

Unchanged: argmin of `expectedCost` over all floor+D19-qualifying pairs.
Label the row `STRATEGY: MINIMIZE SPEND` instead of `RECOMMENDED PAIR`
(keep the expected-$ price display). Keep the separation chip.

### Row 2 — "Planning step-up" lens

Question answered: *"What if planning quality is my bottleneck?"*

Definition (D20 guard included): the lowest-cost executor (execution-floor
candidate) paired with the **lowest-cost planner satisfying BOTH:**
- intelligence ≥ cheapest-qualifying-planner intelligence **+ 3.0 points**
  (the Δ=3 capability-step rule), AND
- a **different family** than the cheapest planner (family = vendor prefix,
  e.g. `z-ai`, `deepseek`, `anthropic`).

If multiple planners qualify, take the cheapest of them (this is the lens's
argmin objective: *minimize cost subject to a real planning upgrade*). The
executor is the same cheapest executor from Row 1 unless D19 blocks that
pairing (then the next cheapest qualifying executor). If NO planner satisfies
Δ+3/family rules with any executor → the lens **doesn't render** (honest
absence; never fake it with a smaller step — log absence in the report).

At current data, expect: executor deepseek-v4-flash ($0.1181) + planner
kimi-k3 (59.7, $9, Δ+2.2 from glm… ⚠ verify: Δ from cheapest *qualifying*
planner glm-5.3-flash 57.5 → kimi 59.7 is +2.2, which FAILS Δ≥3 → next
candidate sol 60.9 $6 Δ+3.4 PASSES, family differs ✓). So expect
`sol → deepseek-v4-flash` at ≈ $0.65·6 + $0.30·0.1181 = **$3.935/1M**.
Verify against live data; don't hardcode.

### Row 3 — "Execution step-up" lens

Question answered: *"What if execution quality is my bottleneck?"*

Definition: the cheapest qualifying planner (same as Row 1's planner) paired
with the **highest-intelligence executor whose cost ≤ 10× the cheapest
qualifying executor's cost** (the price-ceiling rule from D20 — prevents the
$30 opus-5-fast/fable-5 class from always winning when $4 class exists).
If multiple executors tie on intelligence, cheapest wins. D19 must pass
(hint: it will — big score gaps). Expect glm-5.3-flash + grok-4.6 (60.9,
$4): verify against live data.

### Row 4 — "Capability ceiling" reference (D21 — visually demoted, NOT a strategy)

Question answered: *"What does money buy? What am I giving up by not
spending it?"* This row is the counterfactual that makes the cost
optimization's value visible. It is **not** a recommendation — the product's
thesis (D3) remains expected-$ ranking. Render it visually distinct:
separated above/below the strategy rows, labeled `CEILING: MAXIMUM
CAPABILITY`, with a cost multiple vs the anchor (e.g. "133× the cheapest
pair").

Definition:
- **Planning** = argmax intelligence over floor-qualifying models; tie →
  cheapest. (At current data: claude-opus-5, 63.1, $15.)
- **Execution** = argmax intelligence over floor-qualifying models
  **excluding the planner itself AND its D15/D17 variant children** (any
  model with `inherit_from` = planner's id — without this exclusion the
  naive pick is opus-5-fast at $30, the SAME model as the planner at 2×
  price: one model playing both roles). Tie → cheapest. (At current data:
  claude-fable-5, 62.1, $30.)
- D19 still applies to this pair (it passes at current data via the price
  path: 2.0× ratio). If a future dataset's ceiling pair fails D19 (possible:
  two same-price same-score models at the top), **do not render an
  engineered near-ceiling substitute** — skip the row and log it. The
  ceiling must be the true argmax or nothing.
- Expected-$ still displayed (same formula), plus the vs-anchor multiple.
- Edge cases: if planning argmax picks the same model as any lens row's
  planner AND execution matches too, skip the row (repetition adds nothing).
  If all models have equal intelligence (degenerate), skip the row.

At current data, expect: **opus-5 → fable-5, ≈$18.75/1M, 133× the anchor**
(`0.65·15 + 0.30·30 = 9.75 + 9 = 18.75`). Verify against live data; never
hardcode.

### Layout & honesty rules

- Row 1 top, unchanged price display. Rows 2/3 below it, labeled
  `LENS: PLANNING STEP-UP` / `LENS: EXECUTION STEP-UP` (copy is yours — the
  *question each lens answers* must be visible as a one-liner under the row
  label, e.g. "if planning quality is the bottleneck"). Row 4 last,
  visually separated, labeled `CEILING: MAXIMUM CAPABILITY` with the
  vs-anchor multiple — demoted styling per D21.
- Each lens row shows its own expected-$ (computed with the current mix —
  same formula, so a user can compare rows directly).
- **Do not label lenses as "Runner-up"** — they are not rank positions.
- Add a collapsible **"Show ranking view"** toggle revealing true rank-2/3/
  4… qualifying pairs (the old runner-up list), so the pure ranking stays
  accessible. Default collapsed.
- Edge cases: if a lens's pair equals Row 1's pair, skip the lens (don't
  repeat). If both lenses fire but collapse to the same pair, render the
  first, skip the second. If Row 4's pair equals any other row's pair, skip
  Row 4. If Row 1 has no pair, render the honest no-qualifying state and
  skip everything else.

## Tests (`test/pair.test.js` + a new lens test file if cleaner)

Fixture-based, no network:

1. Lens 2: Δ+3 rule fires correctly (a fixture where +0.2-pt planner does
   NOT qualify, a +3.4-pt one does); family guard blocks same-family
   step-up (glm → glm-5.3 $2.9 is NOT the lens pick despite Δ+2.0).
2. Lens 2 falls back to next executor when D19 blocks the cheapest one.
3. Lens 2 absent (renders nothing) when no planner meets Δ+3 + family.
4. Lens 3: price ceiling respects the 10× rule (a $30 executor is excluded
   when a $4 executor ties its intelligence; included when the $4 one has
   lower intelligence).
5. Lens 3 skips when its pair equals Row 1.
6. All lenses still enforce floors + D19 per pair.
7. "Show ranking view" data = true ranked list (positions 2..N).
8. Existing B15 tests stay green unchanged.
9. Ceiling (D21): argmax planning with tie→cheapest; execution argmax
   EXCLUDES the planner's D17 children (`inherit_from`) — fixture with an
   opus-5/opus-5-fast pair where the fast variant must NOT be picked as
   execution even though it ties the max intelligence.
10. Ceiling: degenerate all-equal-intelligence fixture → row skipped, no
    crash, no fabricated pair.
11. Ceiling: pair failing D19 (same price, same score) → row skipped, not
    substituted with a near-ceiling pair.

## Verification (report in `docs/product/b16-report.md`)

1. Live-data lens table: Row 1 / lens 2 / lens 3 with models, intelligence,
   price, expected-$, chip values; confirm lens 2 landed on the
   Δ≥3+family-different model and NOT the +0.2-pt pseudo-alternative.
2. The one-note check: how many distinct (family, model) combos across the
   three strategy rows vs trial 2's card.
3. Ceiling row (D21): the argmax picks, the exclusion that was applied
   (confirm opus-5-fast was NOT picked as execution), expected-$ and the
   vs-anchor multiple (expect ≈133×, verify).
4. "Ranking view" toggle reveals the true rank-2/3
   (deepseek twin pairs
   allowed there — D19 has already ensured they're not mirror-pairs...
   verify: the two deepseek-V4-flash→-0731 cross pairs must NOT appear
   anywhere; the -0731-as-executor with a *different* planner may appear).
5. `npm test` count; live `npm run dev` screenshot-equivalent (DOM text
   extraction of the row labels + prices — 4 rows: cheapest, planning
   step-up, execution step-up, ceiling); zero console errors.
6. Spot-check protocol: hand-recompute each displayed expected-$ and each
   D19 chip from `public/models.json` in the report.

## Constraints

- Do not change: pair ranking math, floors, D19, band control behavior, mix
  controls, verification toggle, pipeline, allowlist.
- Pure logic in `src/lib/pair.js` (or a sibling pure module); UI wiring in
  `main.js`.
- No persistence for lens choice (match existing controls).
- D4 honesty: a lens that can't be computed honestly doesn't render.

## Out of scope

B5 (control hardening/persistence), any rule changes (would need a new
decision), AA Pro key question.