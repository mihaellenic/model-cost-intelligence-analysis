# B5 report: read-only parameters + per-row tooltips (D23)

Implements the `b5-task-brief.md` spec. Part A freezes mix + band as read-only
displayed parameters (D23); Part B adds per-row tooltips with
`coding_index`/`agentic_index` to every model chip. The decision layer
(`pair.js`/`lens.js`/`vendor.js`) is **untouched** — `git diff` on all three is
empty. `normalizeMix` in `pair.js` stays and is still applied to the constant.

## 1. Part A — frozen params (DOM-extracted, live `npm run dev`)

Params line (read-only text, no inputs):

```
PARAMS
mix 65.0% / 30.0% / 5.0%
frontier band 8.0
```

Floors line (unchanged, still shows the resolved values — D7/D18 visibility
principle preserved):

```
Planning floor: frontier band −8.0 → ≥55.1 (max 63.1) · execution ≥ median (33.0).
```

**Read-only check:** the only `<input>` elements remaining in the DOM are
`filter-with-intel`, `filter-with-price`, and `model-verification`. No
`#mix-planning` / `#mix-execution` / `#mix-verification` / `#band-width`
elements exist. The verification toggle is present, interactive, session-scoped,
and **default OFF**.

## 2. Part B — per-row tooltips

Every model chip (`<div class="pair__model" data-tip="…">`) carries a tooltip
rendered via a pure builder (`src/lib/tooltip.js`). Sample (Row 1 planning,
verbatim record values):

```
Intelligence: 57.50
Intelligence source: Artificial Analysis
Coding index: 71.5 · Agentic index: 58.2
Cost: $0.1625 / 1M (avg)
Cheapest: z-ai/glm-5.3-flash
Context: 1,310,720 tokens
```

- **Nulls render `—`, the line is never omitted** (live: a rank-2x row shows
  `Coding index: — · Agentic index: —`). 273 of 2166 rendered chips show `—`.
- **All rows covered:** top-level (6 chips), ceiling (2), lenses (4), all-vendor
  stacks (14), ranking view (2160). 2166/2166 chips carry the coding/agentic
  line.
- **`intelligence_scope` labels still render:** `variant-inherited` and
  `manual` confirmed in the live DOM; `effort-median` covered by unit test (the
  only effort-median model, `mistralai/devstral-2512`, is below the planning
  floor and never renders — the label is exercised at the pure layer).
- **Rounding:** indexes use `.toFixed(1)` (78 → `78.0`), intelligence
  `.toFixed(2)`, cost `.toFixed(4)` — identical to the chart tooltips. No
  formatting drift (D4).

## 3. Diff-check vs b17-report at defaults

All card numbers byte-identical to `b17-report.md` (toggle OFF, mix 65/30/5,
band 8):

| Item | b17-report | Live DOM |
|---|---|---|
| Row 1 | $0.1411 | $0.1411 ✓ |
| Anthropic | $11.5500 · 82× | $11.5500 · 82× ✓ |
| OpenAI | $4.1100 · 29× | $4.1100 · 29× ✓ |
| Ceiling | $18.75 · 133× | $18.75 · 133× ✓ |
| Lenses | $2.64 / $0.29 | $2.6354 / $0.2934 ✓ |
| Vendor stacks | 7 with qualifying pairs | 7 ✓ (google $1.8825 … anthropic $11.5500) |

## 4. Toggle still re-prices (not frozen)

Toggle ON: Row 1 $0.1411 → **$0.1470**, ceiling 133× → **138×** — exactly the
D23-recorded values. Toggle OFF restores $0.1411. Default OFF confirmed.

## 5. Mobile / console

- **390px viewport (emulated):** `scrollWidth === clientWidth` (390/390);
  pair card 366/340 — no horizontal overflow.
- **Zero console errors** (only vite connect debug messages).
- **Visual inspection (screenshot, 390px):** params line renders as calm
  read-only text with a clean wrap (`frontier band 8.0` on its own line);
  tooltip captured open above the Row-1 chip — correct content, correct
  position, no clipping by the card's `overflow: hidden`, no viewport
  overflow. Chips stack single-column. Two cosmetic notes: the tooltip
  overlays the row above while open (normal hover-tooltip behavior), and the
  vendor label wraps to 3 lines at 390px (pre-existing B17 markup, out of
  B5 scope).

## 6. Tests

`npm test`: **96 passing, 0 failures** (88 existing + 8 new in
`test/b5.test.js`). New tests:

1. Frozen constants: `DEFAULT_MIX` = 65/30/5, `DEFAULT_BAND` = 8.
2. Floors from constants == floors from explicit 65/30/5 + band 8.
3. `recommendPairs` with constants == explicit params (pairs + floors).
4. Tooltip: coding/agentic render with one decimal; line always present.
5. Tooltip: nulls render `—`, line never omitted.
6. Tooltip: integer indexes render `78.0` (no formatting drift).
7. Tooltip: all three `intelligence_scope` labels render.
8. Tooltip: null intelligence renders `—` and the per-type line still appears.

All existing pair/lens/vendor tests pass **untouched** — no pure-layer test
needed editing (the tripwire did not fire).

## 7. Dead wiring removed (found while removing input wiring)

- `index.html`: the four mix/band `<input>` elements + their labels
  (`#mix-planning`, `#mix-execution`, `#mix-verification`, `#band-width`).
- `src/main.js`: `els.mixPlanning/mixExecution/mixVerification/bandWidth`
  element lookups; the `input`-event loop in `attachFilterHandlers`;
  `currentMix()` / `currentBand()` functions.
- `src/styles.css`: `.pair__control` block (input-styled grid) and the
  `@media (max-width: 760px)` `.pair__controls` grid override — both dead
  once the inputs were gone. Replaced with `.pair__params` (calm text line)
  and `.pair__model[data-tip]::after` tooltip styling.

## Known issues / notes

- **Brief discrepancy (documented, not a defect):** the brief states the
  pair-card tooltip mechanism "exists" (rendering `effort-median` /
  `variant-inherited` labels). It does not — those labels only render in the
  Chart.js chart tooltips (`bar.js`/`scatter.js`). The pair card had no
  tooltip at all. Per the brief's "extend, don't rebuild" intent, the chart
  tooltip content pattern was extracted into a shared pure builder
  (`src/lib/tooltip.js`) and applied to the pair card's chips; the chart
  tooltips are unchanged.
- `Context` uses `toLocaleString()` (same as the scatter tooltip); grouping
  separators are locale-dependent (e.g. `1 310 720` in this Node/browser
  locale). Consistent with existing behavior, not a regression.
- Out of scope per brief: re-enabling editability (D23 reopen trigger),
  B7 refresh infra, B6 per-type fitness logic.
