# B17 task: vendor-lens top-level card (D22)

## Context

You are implementing **B17** for "Model Cost Intelligence Analysis" — the
card re-architecture from user decision **D22** (read it: it pins the layout,
the vendor rule, the tie-break, and the honesty guardrails). Also read
`docs/product/b16-report.md` for the current 4-row card state, and
`docs/product/d16-task-brief.md` only if you need the D19/floors formal
specs — they are unchanged and shipped (`src/lib/pair.js`, `src/lib/lens.js`).

**Why:** trial 3 validated the lens mechanics; the user's verdict is that for
the D1 persona, the single-vendor constraint (one bill, one API key) is more
decision-critical than the exploratory bottleneck lenses. New top-level: the
cheapest pair + two vendor-lens rows. Everything else stays accessible but
collapsed, with headline numbers visible in the collapsed chrome.

## Target card architecture

**Top-level (3 rows):**
1. `STRATEGY: MINIMIZE SPEND` — unchanged Row 1 from B16.
2. `CONSTRAINT: ANTHROPIC ONLY` (label copy yours; keep the word
   "constraint") — today: opus-5 → sonnet-5, $11.55, 82× anchor.
3. `CONSTRAINT: OPENAI ONLY` — today: sol → luna, $4.11, 29× anchor.

**Collapsed sections (default collapsed, headline number visible in chrome):**
- `▸ Capability ceiling — $18.75/1M · 133× the cheapest pair` (the D21 row,
  moved; expanded shows today's opus-5 → fable-5 row in full)
- `▸ Bottleneck lenses — planning step-up $2.64 · execution step-up $0.29`
  (the two D20 lens rows, moved)
- `▸ Show ranking view` (unchanged from B16)

Expected values above are from my live-data probe — **verify against
`models.json`, never hardcode.**

## Vendor-lens rule (D22, deterministic — implement exactly)

A **vendor** = OpenRouter ID prefix (everything before `/`). Rule:

1. Compute each vendor's **best planner**: highest-intelligence model with
   non-null intelligence ≥ the frontier-band planning floor (band-adjustable
   floor, same as Row 1 — reuse the computation).
2. Rank vendors by best-planner intelligence, descending.
3. **Tie-break (D22 option ii):** count of floor-qualifying models the
   vendor can field ("execution depth") — more wins. (Today this makes
   OpenAI [sol 60.9 + terra 56.6 + luna 52.3 + gpt-5.5 56.3, all ≥33.05
   floor = 4–5 depth] win its tie with x-ai [2 depth].)
4. The top **2** vendors that can field a **legal pair** get top-level rows.
   Legal pair per vendor: planner = argmax intelligence (tie → cheapest);
   execution = cheapest vendor model that (a) ≥ execution floor, (b) is not
   the planner and not its D17 children (`inherit_from`), (c) passes D19
   against the planner. If the argmax planner's best legal executor fails,
   try the next executor (same fallback pattern as lens 2 in `lens.js`).
5. A top-2 vendor that *cannot* field a legal pair is skipped and the next
   vendor takes the slot; if fewer than 2 vendors can field pairs, render
   fewer rows (the number of vendor rows is whatever is honest).
6. Expected-$ per vendor row uses the same formula/mix as all other rows,
   plus the vs-anchor multiple chip.

**Live-data expectations to verify (my probe, not a contract):** vendor
ranking anthropic 63.1 / x-ai 60.9 / openai 60.9 / moonshotai 59.7 / z-ai
59.5; top-2 after tie-break = **anthropic ($11.55) + openai ($4.11)**; x-ai
*can* field a legal pair (grok-4.6 → grok-4.5, $3.16 — I previously claimed
otherwise; that was wrong) but loses the tie-break on depth. It appears in
the expanded vendor list (below).

**Expanded vendor list:** below the two top-level rows (or inside a fourth
collapsed section `▸ All vendor stacks`), list every vendor that can field a
legal pair with its stack + expected-$ — this is where x-ai's $3.16 row and
honest `no qualifying pair` entries for pairless vendors live. Ordering:
expected-$ ascending.

## Honesty rules (D22 guardrails — verbatim requirements)

- Vendor rows are labeled **constraint views**; their one-liner must say
  what question they answer ("one vendor, one bill — what does consolidating
  cost?"). The recommended answer remains Row 1; never render vendor rows as
  "recommended" anything.
- No hardcoded brand/family lists anywhere in the rule — vendor selection
  derives from data. When a z-ai model becomes the world's best planner, the
  card must update itself without code changes (**test this property with a
  fixture where a non-obvious vendor wins**).
- Collapsed chrome shows headline numbers (ceiling $18.75 · 133×; lenses'
  prices) — the anchor↔ceiling contrast must survive in the primary view.
- No fabricated substitutes: a pairless vendor renders "no qualifying pair"
  (expanded) or is absent (collapsed chrome counts only real stacks).
- Floors, D19, band/mix/verification controls, ranking, pipeline: untouched.
  `pair.js` unchanged. New logic in `src/lib/lens.js` (extend) or a sibling
  pure module — same purity contract as B16 (no DOM/no storage in logic).

## Tests (fixture-based, no network; extend `test/lens.test.js` or new file)

1. Vendor rule: ranking by best planner; **tie-break by depth** (fixture
   where two vendors tie on best-planner intelligence and the deeper bench
   wins the top-2 slot).
2. Depth counting: only floor-qualifying models count (a vendor with many
   below-floor models doesn't inflate depth).
3. Vendor pair construction: argmax planner + cheapest legal executor;
   fallback when D19 blocks; honest absence when nothing qualifies.
4. **No-brand-lock property:** a fixture where a "new" vendor tops the
   frontier → it gets a vendor row without any allowlist change.
5. Collapsed-chrome headline data: ceiling multiple + lens prices present
   regardless of collapsed state.
6. Layout contract: exactly [Row 1, vendor × N] top-level; lenses/ceiling/
   ranking present in collapsed sections with true rank order intact in the
   ranking view.
7. All existing B15/B16 tests stay green ( lens rows must keep passing their
   own tests — they're demoted, not deleted).

## Verification (report in `docs/product/b17-report.md`)

1. Live top-level table: 3 rows with models, intelligence, price, expected-$,
   chips, multiples — hand-recomputed from `models.json`.
2. Vendor-rank table: all vendors with best-planner intelligence and depth
   counts; show the tie-break firing (x-ai vs openai).
3. Collapsed chrome text extraction (headline numbers) + expanded sections'
   row lists, from live `npm run dev` DOM.
4. Regression checklist: twin cross-pairs nowhere; ceiling exclusion
   (opus-5-fast never executes for opus-5); lenses' numbers unchanged from
   B16's report (they moved, not changed — recompute and diff).
5. `npm test` count; zero console errors.
6. The no-brand-lock property demonstrated with the mutated fixture test
   named in the report.

## Constraints

- D4: an honest absence beats a fabricated row. Bounded: if the vendor
  module can't compute a legal pair for ANY vendor, top-level shows just
  Row 1 — never placeholder rows.
- Do not change: `pair.js`, pipeline, allowlist, controls' behavior,
  ranking math. B5 (persistence/tooltips) stays its own item.
- Mobile/narrow viewport: the collapsed-chrome approach must not create
  horizontal overflow (4 top-level rows → 3 helps; keep row markup
  consistent with B16's).

## Out of scope

B5 (persistence, per-row tooltips incl. coding/agentic indexes), cross-lens
diversity rules (D20 revisit trigger), AA Pro key question, pipeline changes.