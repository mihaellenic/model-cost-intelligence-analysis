# B17 report: vendor-lens top-level card (D22)

Implements the `b17-task-brief.md` spec on top of B16 (already in the working
tree). Pure vendor selection lives in the new `src/lib/vendor.js`; `src/lib/lens.js`
is extended (additive — `computeLensCard` now also returns `vendors` and
`topRows`); `src/lib/pair.js` is **untouched**. Ranking math, floors, D19,
band/mix/verification controls, and the pipeline are unchanged.

## 1. Live top-level table (default 65/30/5, deterministic verification, band 8)

From `public/models.json` (2026-08-30, 210 tracked / 130 plottable, max 63.1,
planning floor 55.1, execution floor 33.05):

| # | Row | Planning | Intel | $/1M | Execution | Intel | $/1M | Expected $ | Chip |
|---|---|---|---|---|---|---|---|---|---|
| 1 | STRATEGY: MINIMIZE SPEND | z-ai/glm-5.3-flash | 57.5 | 0.1625 | deepseek/deepseek-v4-flash | 51.8 | 0.1181 | **$0.1411** | 5.7 pts |
| 2 | CONSTRAINT: ANTHROPIC ONLY | anthropic/claude-opus-5 | 63.1 | 15 | anthropic/claude-sonnet-5 | 55.3 | 6 | **$11.55** | 82× anchor |
| 3 | CONSTRAINT: OPENAI ONLY | openai/gpt-5.6-sol | 60.9 | 6 | openai/gpt-5.6-luna | 52.3 | 0.7 | **$4.11** | 29× anchor |

Hand-recomputed from `models.json`:

- Row 1: `0.65×0.1625 + 0.30×0.1181 = 0.105625 + 0.03543 = $0.141055 → $0.1411 ✓`
- Anthropic: `0.65×15 + 0.30×6 = 9.75 + 1.8 = $11.55 ✓`; multiple `11.55/0.1411 = 81.9 → 82× ✓`
- OpenAI: `0.65×6 + 0.30×0.7 = 3.9 + 0.21 = $4.11 ✓`; multiple `4.11/0.1411 = 29.1 → 29× ✓`

The vendor rule (D22) reproduces the user's instinct exactly: Anthropic's
best-planner + cheapest-qualifying-executor is opus-5 → sonnet-5 ($11.55), and
the same rule overrules the OpenAI prior (sol → luna $4.11, not sol → terra
$10.00 — terra is 10× luna's price for +4.3 pts). No hardcoded brand lists.

## 2. Vendor-rank table (tie-break firing)

Vendors ranked by best floor-qualifying planner's intelligence; ties broken by
**execution depth** (count of the vendor's models ≥ execution floor 33.05):

| Rank | Vendor | Best planner | Intel | Depth (exec floor) | Depth (plan floor) | Legal pair? |
|---|---|---|---|---|---|---|
| 1 | anthropic | claude-opus-5 | 63.1 | 11 | 6 | opus-5 → sonnet-5, $11.55 |
| 2 | **openai** | gpt-5.6-sol | 60.9 | **14** | 3 | sol → luna, $4.11 |
| 3 | **x-ai** | grok-4.6 | 60.9 | **4** | 2 | grok-4.6 → grok-4.3, $3.16 |
| 4 | moonshotai | kimi-k3 | 59.7 | 5 | 1 | kimi-k3 → kimi-k2-thinking, $6.32 |
| 5 | z-ai | glm-5.3 | 59.5 | 7 | 2 | glm-5.3 → glm-5.3-flash, $1.93 |
| 6 | qwen | qwen3.8-max | 58.1 | 10 | 2 | qwen3.8-max → qwen3.7-plus, $2.84 |
| 7 | google | gemini-3.7-flash | 56.0 | 6 | 1 | gemini-3.7-flash → gemini-3.5-flash-lite, $1.88 |

**The tie-break fires:** openai and x-ai both field a 60.9 best planner.
OpenAI's execution depth (14 floor-qualifying models) beats x-ai's (4), so
OpenAI takes the second top-level slot. x-ai *can* field a legal pair
(grok-4.6 → grok-4.3, $3.1625) but loses the tie on depth — it appears in the
expanded all-vendor stacks list, ordered by expected-$.

> **Probe correction (documented, not hardcoded):** the brief's probe named
> x-ai's executor "grok-4.5". The rule's cheapest-legal-executor picks
> **grok-4.3** ($1.875) — grok-4.5 ($4) also passes D19 (score gap 5.1 pts)
> but is pricier. The $3.1625 expected-$ matches grok-4.3. The brief's depth
> figures ("4–5 vs 2") were also partial; actual counts are openai 14 / x-ai 4.
> The tie-break fires either way.

## 3. Collapsed chrome + expanded sections (live `npm run dev` DOM)

Top-level rows (DOM-extracted, default controls):

```
STRATEGY: MINIMIZE SPEND        $0.1411 /1M workflow tokens
CONSTRAINT: ANTHROPIC ONLY      $11.5500 /1M workflow tokens · 82× the cheapest pair
CONSTRAINT: OPENAI ONLY         $4.1100 /1M workflow tokens · 29× the cheapest pair
```

Collapsed-chrome headlines (visible in the collapsed `<summary>` chrome):

```
▸ Capability ceiling — $18.75/1M · 133× the cheapest pair
▸ Bottleneck lenses — planning step-up $2.64 · execution step-up $0.29
▸ All vendor stacks — 7 with qualifying pairs
▸ Show ranking view
```

The anchor↔ceiling contrast survives in the primary view: **$0.1411 · 133×**.

Expanded sections' row lists (DOM-extracted):

- **Capability ceiling:** CEILING: MAXIMUM CAPABILITY — opus-5 (63.1, $15) →
  fable-5 (62.1, $30), $18.75, 133×. opus-5-fast is NOT the executor.
- **Bottleneck lenses:** LENS: PLANNING STEP-UP — grok-4.6 → deepseek-v4-flash,
  $2.6354; LENS: EXECUTION STEP-UP — glm-5.3-flash → deepseek-v4-pro, $0.2934.
- **All vendor stacks** (expected-$ ascending): google $1.8825, z-ai $1.9338,
  qwen $2.8400, x-ai $3.1625, openai $4.1100, moonshotai $6.3150,
  anthropic $11.5500. Every vendor that can field a legal pair is listed;
  pairless vendors are absent (honest absence — no fabricated rows).
- **Show ranking view:** true ranked list from position 2 (1071 pairs).

## 4. Regression checklist

- **Twin cross-pairs nowhere:** the two deepseek-v4-flash ↔ -0731 cross-pairs
  appear in none of the 1073 rendered pairs (top-level + collapsed + ranking).
  D19 kills them; the vendor module adds no new pair.
- **Ceiling exclusion:** opus-5-fast never executes for opus-5 in the top-level
  rows or the ceiling row (verified in the DOM: 0 matches). The ranking view's
  opus-5 → opus-5-fast pairs are legitimate true-rank positions (D19 passes via
  the 2.0× price path) — unchanged from B16.
- **Lens numbers diff-identical to B16:** planning step-up $2.6354, execution
  step-up $0.2934, ceiling $18.75 / 132.9→133×, Row 1 $0.1411 — recomputed
  identical. The rows moved into collapsed sections; nothing changed.
- **Controls re-rank:** mix 0/100/0 → opus-5 → deepseek-v4-flash, $0.1181;
  band 0 → opus-5 → deepseek-v4-flash, $9.7854; verification toggle re-prices
  every row (Row 1 $0.1470, ceiling $20.25 / 138×). All match B16's report.
- **Mobile/narrow viewport:** no horizontal overflow (scrollWidth ===
  clientWidth at 390px); `.pair__models` collapses to one column as before.
- **Vendor rows are constraint views:** labeled `CONSTRAINT: <VENDOR> ONLY`
  with the question "One vendor, one bill — what does consolidating cost?";
  never labeled "recommended". The recommended answer remains Row 1.

## 5. Tests

`npm test`: **88 passing, 0 failures** (77 B15/B16 + 11 new in
`test/vendor.test.js`). New tests cover the brief's 7 cases:

1. **Vendor ranking + tie-break by depth** — two vendors tie on best-planner
   intelligence; the deeper bench wins the top-2 slot.
2. **Depth counts only floor-qualifying models** — a vendor with many
   below-floor models does not inflate depth (would wrongly win otherwise).
3. **Vendor pair construction** — argmax planner + cheapest legal executor;
   D19 fallback to the next executor; honest absence when nothing qualifies
   (no planner, or only the planner + its D17 child).
4. **No-brand-lock property** — fixture where a "new" vendor (`acme/acme-omni`,
   64.2) tops the frontier: it gets a top-level row with no allowlist change.
   Test name: `no-brand-lock: a "new" vendor topping the frontier gets a top row
   with no allowlist change`.
5. **Collapsed-chrome headline data** — ceiling multiple + lens prices present
   in the card return regardless of collapsed state.
6. **Layout contract** — top-level is exactly [Row 1, vendor × N]; lenses,
   ceiling, and ranking present with true rank order intact; vendor rows are
   constraint views, never "recommended".
7. **All existing B15/B16 tests stay green** — the lens rows keep passing their
   own tests (they're demoted, not deleted).

Plus: vendor pair excludes the planner's D17 variant children (inherit_from);
fewer than 2 legal-pair vendors renders fewer top-level rows (honest count);
a pairless vendor is absent from top rows and listed honestly; all-vendors
list orders by expected-$ ascending.

## 6. UI verification (live `npm run dev`)

- Zero console errors or warnings (only vite connect debug messages).
- Top-level 3-row table, collapsed-chrome headlines, and expanded section row
  lists all extracted from the live DOM (see §1 and §3).
- The no-brand-lock property is demonstrated by the fixture test named in §5 —
  no code change is needed for a new vendor to win a row.

## Known issues

- The brief's probe named x-ai's executor "grok-4.5" and partial depth counts;
  live data says grok-4.3 and openai 14 / x-ai 4. The rule, not the probe, is
  the contract; both divergences are documented in §2.
- Out of scope per brief: B5 (persistence, per-row tooltips incl. coding/
  agentic indexes), cross-lens diversity rules (D20 revisit trigger), AA Pro
  key question, pipeline changes.
