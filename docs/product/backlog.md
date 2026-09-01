# Backlog

Prioritized by RICE (Reach × Impact × Confidence ÷ Effort). Reach is the % of the primary persona's sessions the outcome touches; Impact is 0.25/0.5/1/2/3; Confidence in 0–1; Effort in person-days.

## Now

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B7 | Weekly automated refresh with fail-closed deploys (D24, amended): public GitHub repo + **GitHub Pages** hosting (single vendor: Actions runs deploy AND canary, one secrets store, one failure-email path); deploy workflow chains data → test → build → deploy-pages so the existing failure contract gates deploys — source error means failed run + stale-but-honest site + email, never a bad ship; weekly Actions canary re-exercises sources + tests; Vite base set to the repo sub-path (silent-404 gotcha); footer freshness timestamp + ⚠stale marker. | Solo agent user | Site live at https://<user>.github.io/<repo>/; data ≤7 days old on every visit, age visible on-page (<5s); a deliberately-broken key run proves deploy-block + failure email + old site still live; a clean run ships a fresh card; `npm test` green in CI. | 100×1×0.9÷1 = 90 | **Ready** — brief at `docs/product/b7-task-brief.md` + D24 (amended to Pages) | B5 (done); repo exists (B5 uncommitted work committed as step 1) |

## Next

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B8 | Add eslint. | Engineering | Lint passes on CI. | 10×0.5×1÷1 = 5 | Ready | — |

## Later

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B6 | Add a "task-type fit" signal per model — split fitness by PLANNING (long-context reasoning) vs EXECUTION (edit-precision) vs VERIFICATION (defect detection). Requires sourcing benchmark splits per type; blocked on sparse `coding_index`/`agentic_index` in AA's free tier (72/54 of 624). | Solo agent user | Each plotted model has a per-type fitness score, not just general intelligence. | 60×3×0.45÷10 = 8.1 | Not ready — research (data-blocked) | AA tier upgrade or external benchmark source |

## Done

| ID | Outcome | Status |
|---|---|---|
| B5 | Re-scoped per D23: freeze mix + band as read-only displayed parameters (visibility preserved — the floors line shows active values); verification toggle stays live; per-row tooltips gain coding/agentic indexes (trial-3 micro-fix). Decision layer untouched. | Solo agent user | Params render read-only with resolved floors; all card numbers identical to b17-report at defaults; tooltips show coding/agentic (— when null); toggle still re-prices every row; `npm test` green. | 100×1.5×0.9÷0.5 = 270 | **Done 2026-08-30 (impl + verified)** — params read-only (0 mix/band inputs left), toggle live ($0.1411->$0.1470 / 138x), tooltips on all 2166 chips w/ coding/agentic + em-dash for nulls; card numbers byte-identical to b17; 96 tests; pure layer untouched. Brief discrepancy (pair-card tooltip did not pre-exist) resolved via shared tooltip.js. See b5-report.md. |
| B17 | Vendor-lens top-level card (D22). | **Done 2026-08-30 (impl + verified)** — top-level: minimize-spend + anthropic $11.55/82× + openai $4.11/29× via rule (depth tie-break beat x-ai 14:4); 7 vendor stacks in expanded list; 88 tests; all math independently recomputed. See `b17-report.md`. |
| B1 | Pair recommendation as primary output (D2/D3/D7); params removed (D10). | **Done 2026-08-30** — trial 3 PASS after the trial-1 → B15 (D18/D19) → B16 (D20/D21) arc; ceiling-execution question settled by data (opus-5 out-performs fable-5 on all three AA dimensions at half price). |
| B16 | Lens card per D20+D21 (trial 2: "feels one-note"). | **Done 2026-08-30 (impl + verified)** — 4-row card, 3→5 combos / 4 families; 77 tests; all math independently recomputed. Demoted to collapsed sections by B17/D22 (post-trial polish). See `b16-report.md`. |
| B15 | B1 fix batch: D18 frontier-band floor + D19 separation. | **Done 2026-08-30 (verified)** — floor 55.1, pool 17; twin regression named; 61 tests. See `b15-report.md`. |
| B14 | D17 variant-inherited intelligence + cited hardcodes (D16). | **Done 2026-08-30 (verified)** — +3 inheritances, +2 cited overrides; 130/210 = 61.90%. See `b12-followup-report.md`. |
| B12 | AA intelligence source (D14) + collapse (D15). | **Done 2026-08-30 (verified)** — 125/210 = 59.52%; Luna check passes. See `b12-report.md`. |
| B11 | OpenRouter benchmarks intelligence source (D12). | **Done 2026-08-30** — 19/213 = 8.9% coverage; D12 fallback fired → B12. See `b11-report.md`. |
| B3 | OpenRouter as source of truth (D8/D9). | **Done 2026-08-30** — 213 tracked, 94 plottable, 9 tests green. See `b3-report.md`. |
| B2 | 3-type task taxonomy + 65/30/5 mix. | **Done 2026-08-29** — see `b2-taxonomy.md`. |
| B13 | Benchlm pagination probe + scraper hardening. | **Superseded by D12** — benchlm exited the pipeline. |
| B10 | Dedupe economically-identical recommendations. | **Superseded by D15** — variant collapse dissolves twins by construction. |

## Explicitly deferred / out of scope

- **Build-vs-buy / TCO for teams** — persona is out of scope per vision.
- **Self-host cost axis** — meaningful only for local inference; out of scope per vision.
- **General (non-coding) LLM leaderboard** — out of scope per vision.