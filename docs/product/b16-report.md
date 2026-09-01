# B16 report: lens card — three purpose-labeled strategies + capability ceiling (D20+D21)

Implements the `b16-task-brief.md` spec on top of B15 (already in the working
tree). Pure selection logic lives in the new `src/lib/lens.js`; `src/lib/pair.js`
is unchanged except exporting `plottableModels` (additive). Ranking math, floors,
D19, band/mix/verification controls, and the pipeline are untouched.

## 1. Live-data lens table (default 65/30/5, deterministic verification, band 8)

From `public/models.json` (2026-08-30, 210 tracked / 130 scored, max 63.1,
planning floor 55.1, execution floor 33.05):

| Row | Label | Planning | Intel | $/1M | Execution | Intel | $/1M | Expected $ | D19 chip |
|---|---|---|---|---|---|---|---|---|---|
| 1 | STRATEGY: MINIMIZE SPEND | z-ai/glm-5.3-flash | 57.5 | 0.1625 | deepseek/deepseek-v4-flash | 51.8 | 0.1181 | **$0.1411** | 5.7 pts |
| 2 | LENS: PLANNING STEP-UP | x-ai/grok-4.6 | 60.9 | 4 | deepseek/deepseek-v4-flash | 51.8 | 0.1181 | **$2.6354** | 33.9× price · 9.1 pts |
| 3 | LENS: EXECUTION STEP-UP | z-ai/glm-5.3-flash | 57.5 | 0.1625 | deepseek/deepseek-v4-pro | 53.2 | 0.6259 | **$0.2934** | 3.9× price · 4.3 pts |
| 4 | CEILING: MAXIMUM CAPABILITY | anthropic/claude-opus-5 | 63.1 | 15 | anthropic/claude-fable-5 | 62.1 | 30 | **$18.75** | 2.0× price |

Lens 2 landed on the Δ≥3 + family-different model (grok-4.6, Δ+3.4, family
`grok`), NOT the +0.2-pt pseudo-alternative (qwen3.8-2.4t-a95b 57.7, Δ+0.2,
same family) and NOT kimi-k3 (Δ+2.2, fails the step).

### Divergence from the brief's written predictions (both user-confirmed)

- **Lens 2**: the brief predicted `gpt-5.6-sol` ($6). The rule's own argmin
  ("take the cheapest qualifying planner") picks **grok-4.6 at $4** — it ties
  sol at 60.9 for 2/3 the price. The brief's "expect sol" overlooked the tie.
  User decision: follow the rule (grok-4.6).
- **Lens 3**: the brief predicted `grok-4.6` as the step-up executor. A strict
  `≤10× the cheapest executor` ceiling = 10 × $0.1181 = **$1.181** excludes
  grok-4.6 ($4 = 34×) — the brief's own arithmetic. The live pick is
  **deepseek-v4-pro** ($0.6259, 5.3×). User decision: strict 10× rule.

## 2. One-note check

Distinct (family, model) combos across the three strategy rows:

- Trial 2's card: **3 combos** — glm-5.3-flash × 3 DeepSeek executors
  (one-note: three answers to "minimize spend").
- B16 card: **5 combos** — glm-5.3-flash, deepseek-v4-flash, grok-4.6,
  deepseek-v4-pro, plus the ceiling's opus-5/fable-5. The three strategy rows
  alone give 4 distinct combos (glm-flash→deepseek-flash, grok-4.6→deepseek-flash,
  glm-flash→deepseek-pro). Each row answers a different question.

## 3. Ceiling row (D21)

- Planning = argmax intelligence, tie→cheapest: **claude-opus-5** (63.1, $15).
- Execution = argmax intelligence **excluding the planner and its D17 variant
  children** (`inherit_from === 'anthropic/claude-opus-5'`): the naive pick
  `claude-opus-5-fast` (63.1, $30) is excluded by the `inherit_from` rule;
  the pick is **claude-fable-5** (62.1, $30). Confirmed: opus-5-fast is NOT
  the ceiling executor.
- Expected $ = 0.65×15 + 0.30×30 = 9.75 + 9 = **$18.75/1M**.
- vs-anchor multiple = 18.75 / 0.1411 = **132.9 → 133×** the cheapest pair.
- D19 passes via the price path (2.0× ratio). Rendered visually demoted
  (separated, `CEILING: MAXIMUM CAPABILITY`, amber styling, multiple chip).

## 4. Ranking view toggle

Collapsible "Show ranking view" (default collapsed) reveals the true ranked
list from position 2. Verified in the DOM: 1070 ranked rows; rank 2 =
glm-5.3-flash → deepseek-v4-flash-0731 (twin as executor with a *different*
planner — allowed). The two deepseek-v4-flash ↔ -0731 **cross-pairs appear
nowhere** — neither in the four rows nor in the ranking view (D19 already
kills them; the lens card adds no new pair).

## 5. Tests

`npm test`: **77 passing, 0 failures** (61 B15 + 16 new in
`test/lens.test.js`). New tests cover the brief's 11 cases, including the two
named regressions:

- **"+0.2-pt planner does NOT qualify lens 2; a +3.4-pt different-family
  planner does"** — the pseudo-alternative is rejected, the real step-up wins.
- **"ceiling execution EXCLUDES the planner's D17/D15 variant children
  (inherit_from)"** — opus-5-fast is never picked as opus-5's ceiling executor.

Plus: family guard blocks same-family step-up; lens-2 D19 executor fallback;
lens-2 honest absence; lens-3 10× ceiling (exclude/include both directions);
lens-3 skip-when-equals-Row-1; floors+D19 on every row; ranking-view data =
true ranks 2..N; twin cross-pairs nowhere; ceiling degenerate all-equal-intel
skip; ceiling D19-failure skip (no near-ceiling substitute); ceiling
vs-anchor + repeat-skip; no-qualifying-pair state; grok-4.6-over-sol argmin.

## 6. UI verification (live `npm run dev`)

DOM-extracted row labels and prices (default controls):

```
STRATEGY: MINIMIZE SPEND        $0.1411 /1M workflow tokens
LENS: PLANNING STEP-UP          $2.6354 /1M workflow tokens
LENS: EXECUTION STEP-UP         $0.2934 /1M workflow tokens
CEILING: MAXIMUM CAPABILITY     $18.75 /1M workflow tokens · 133× the cheapest pair
```

- Zero console errors or warnings.
- Mix control re-ranks (0/100/0 → opus-5 → deepseek-v4-flash, $0.1181).
- Band control re-ranks (band 0 → opus-5 → deepseek-v4-flash, $9.7854; the
  planning lens honestly disappears — no planner can reach Δ+3 above 63.1 —
  and the execution lens is correctly labeled, not mislabeled as planning).
- Verification toggle re-prices every row (Row 1 $0.1470, ceiling $20.25).
- Lenses are never labeled "Runner-up"; the ranking view owns the rank labels.

## 7. Spot-check protocol (hand-computed from `public/models.json`)

Row 1: `0.65×0.1625 + 0.30×0.1181 = 0.105625 + 0.03543 = $0.141055 → $0.1411 ✓`
D19: score gap 57.5−51.8 = 5.7 pts ✓ (price ratio 1.38 < 1.5, score path only).

Lens 2: `0.65×4 + 0.30×0.1181 = 2.6 + 0.03543 = $2.63543 → $2.6354 ✓`
D19: 4/0.1181 = 33.9× price ✓; gap 9.1 pts ✓.

Lens 3: `0.65×0.1625 + 0.30×0.6259 = 0.105625 + 0.18777 = $0.293395 → $0.2934 ✓`
D19: 0.6259/0.1625 = 3.85× price ✓; gap 4.3 pts ✓.

Ceiling: `0.65×15 + 0.30×30 = 9.75 + 9 = $18.75 ✓`; multiple 18.75/0.1411 =
132.9 → 133× ✓. D19: 30/15 = 2.0× price ✓.

## Known issues

- The brief's two written predictions (sol for lens 2, grok-4.6 for lens 3)
  were wrong against live data; both divergences were user-confirmed and are
  documented in §1. The rules, not the predictions, are the contract.
- Lens 3's strict 10× ceiling means the "$4 grok class" is out of budget at
  the current $0.1181 anchor; if the cheapest executor were ~$0.40+ the grok
  class would enter. This is the intended D20 behavior, not a defect.
- Out of scope per brief: B5 control hardening/persistence, rule changes,
  AA Pro key question.
