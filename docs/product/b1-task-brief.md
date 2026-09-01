# B1 task: pair recommendation — the product's primary output

## Context

You are implementing the core product change for "Model Cost Intelligence
Analysis": replacing the four single-model picks with a **recommended pair**
(planning model + execution model), ranked by expected cost across a task mix.
Read these before starting:

- `docs/product/vision.md` — the product, the persona, what it is not
- `docs/product/b2-taxonomy.md` — the 3 task types, the default mix, and the
  expected-$ formula (§"How this feeds B1")
- `docs/product/decision-log.md` — D2 (pair output), D3 (expected-$ ranking),
  D6 (3 task types), D7 (default mix is visible + adjustable), D10
  (params removed entirely)

## Two changes in this task

### Change 1 — remove params entirely (D10, supersedes the B9 bug)

`params_b` is a vestige of the Ollama era and is being deleted, not fixed.
Remove all of it:

- `scripts/lib/derive-metadata.js`: delete `deriveParamsB()` and `deriveTier()`
  and stop returning `params_b`/`tier` from `deriveMetadata()`.
- `scripts/build-data.js`: drop `params_b` and `tier` from the output records.
- `src/lib/filters.js`: remove the `maxParamsB` option and its filter branch;
  delete its test.
- `src/charts/scatter.js`: replace the param-scaled radius with a fixed bubble
  size (e.g. `r: 8`); the tooltip's Params line is deleted (context_length can
  replace it in the tooltip — that field exists on every record).
- `src/lib/quadrants.js`: delete the "Best small" pick from `computePicks()`.
  This supersedes backlog item B9 (a `null <= 7` bug) by removing the logic.
- Remove the now-orphaned tests for `deriveParamsB`/`deriveTier`/`deriveMetadata`
  size behavior, and any UI test referencing param filtering or bubble sizing.
- Update the stale README: remove Ollama-era sections (curated list, ollama
  fetcher, size_gb/params in the record example, "Best small" pick), and
  describe the new pipeline (OpenRouter source of truth + family allowlist +
  pair recommendation). Keep it terse.

Verify after removal: `grep -rn "params_b\|size_gb\|tier\|ollama" src/ scripts/ public/models.json`
returns only legitimate hits (tier-negation regexes in intelligence matching
are legitimate — `TIER_NEGATIVE` stays; it's about benchlm name filtering, not
the removed field).

### Change 2 — the pair recommendation (the product)

Add a **pair card** as the primary output above the scatter. It recommends two
distinct models and the expected cost of the workflow across the default task
mix.

## The pairing algorithm (product logic — implement as specified)

Given the plottable set (both intelligence and cost), with mix shares
`P` (planning), `E` (execution), `V` (verification) defaulting to **65/30/5**:

1. **Verification cost** is $0 by default (deterministic gates: tests, lint,
   CI — per `b2-taxonomy.md`). A toggle "model-based verification" switches V's
   cost to the execution model's cost. Default: OFF.
2. **Quality floors (AMENDED by D18, 2026-08-30 — supersedes the percentile
    floors below):**
    - Planning model: intelligence ≥ **(max scored intelligence − 8)**, i.e. a
      frontier band, NOT a percentile of the whole catalog. The max is taken
      over models with non-null intelligence at render time. The band width
      (default 8 points) is **user-visible and adjustable** (a "frontier
      band" control next to the mix inputs, D7 visibility principle).
    - Execution model: intelligence ≥ median, unchanged.
    - *Rationale (trial 1 failure):* p75-of-catalog measured "above the
      catalog middle", admitting rank-24/125 models (DeepSeek V4 Flash 51.8)
      into the planning slot ~11 points below the frontier. Percentile floors
      were written for the 19-scored-model era; the relative band survives
      AA index re-basing.
3. **Candidate pairs**: all combinations of distinct plottable models
   (planning ≠ execution) where the planning model's intelligence ≥ the
   planning floor and the execution model's intelligence ≥ the execution floor,
   **and the pair satisfies the D19 separation rule: members must differ by
   ≥1.5× in `cost_per_1m_avg` (either direction) OR ≥2.0 intelligence points.**
   This kills economically-identical mirror-pairs (the DeepSeek V4 Flash
   0423/0731 twin case from trial 1) by construction. Both orderings are not
   needed — the slot assignment is fixed.
4. **Rank by expected workflow cost:**

   ```
   expected_cost(m_p, m_e) = P · c_p + E · c_e + V · v_cost
   ```

   where `c_p`, `c_e` are each model's `cost_per_1m_avg` and `v_cost` is 0 or
   `c_e` per the toggle. Pairs are sorted ascending by expected cost; ties
   break by higher combined intelligence.
5. **Display the top pair**, plus runners-up (next 2 pairs) so the user sees
   the tradeoff neighborhood. For the recommended pair show: each model's name,
   family, intelligence, cost per 1M, and the expected workflow cost computed
   with the current mix.
6. **The mix is user-visible and adjustable from v1 (D7)** — a simple 3-input
   control (planning/execution/verification %, live-normalized to 100). The
   pair re-ranks on change. This is the v1 version of B5; B5's remaining scope
   is test coverage and polish of this control, not building it twice.

Also keep the four-quadrant scatter as the reasoning layer underneath (D5) —
the pair card cites the quadrants ("both picks sit in the sweet spot /
premium") so the recommendation is explainable.

## Implementation notes

- The pair math is pure logic — put it in `src/lib/pair.js` (new) next to
  `quadrants.js`, exported and testable. `main.js` wires it to the UI.
- Percentile floors are computed over the plottable population at render time;
  they shift as filters change. That's intended — the recommendation always
  reflects the current filtered view.
- No `params_b` anywhere in the new logic (D10).

## Verify

- `npm test` — existing tests pass; new tests for the pair math.
- `npm run data && npm run dev` — pair card renders above the scatter with the
  65/30/5 default; moving the mix inputs re-ranks the pair; the verification
  toggle changes the expected cost; the "Best small" pick and max-params filter
  are gone; no console errors.

## What to return (write to `docs/product/b1-report.md`)

1. **Pair algorithm** — the implemented formula, floors, and tie-breaks as
   built, with one worked example (a real pair from the current data with
   numbers).
2. **Params removal** — confirmation of what was deleted (files, functions,
   tests, README sections) and the grep result proving no stray references.
3. **Test coverage** — list of new tests for `pair.js` (floor computation,
   distinctness constraint, mix re-ranking, verification toggle, expected-cost
   math against a hand-computed value).
4. **The current recommended pair** — with the default mix, from fresh data:
   planning model, execution model, expected $/1M, and the runners-up.
5. **Known issues** — anything where the algorithm produces a surprising or
   degenerate result (e.g. the same model dominating both slots under some
   mixes; floors emptied by aggressive filters and what you did when no pair
   qualifies — **decide this: if no pair satisfies the floors, the card must
   say so honestly, naming which floor is binding**).

## Constraints

- **D4** still governs: no fabricated data anywhere; the card shows "no
  qualifying pair" rather than relaxing a floor silently.
- **Don't touch** `scripts/build-data.js` intelligence matching,
  `scripts/family-allowlist.json`, or the quadrant math beyond removing the
  small-model pick.
- **Keep the output JSON shape stable** apart from removing `params_b`/`tier`
  (already specified above).
- The mix control and floors are displayed with their current values — no
  hidden constants (D7).