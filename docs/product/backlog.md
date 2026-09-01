# Backlog

Prioritized by RICE (Reach × Impact × Confidence ÷ Effort). Reach is the % of the primary persona's sessions the outcome touches; Impact is 0.25/0.5/1/2/3; Confidence in 0–1; Effort in person-days.

## Now

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B17 | Re-architect the pair card per D22: top-level = minimize-spend + 2 vendor-lens rows (rule-based vendor selection: best frontier-band planner per vendor, depth tie-break, no brand lists); capability ceiling + bottleneck lenses + ranking view move to collapsed sections with headline numbers visible in collapsed chrome. Lenses/ceiling logic unchanged (demoted, not edited). | Solo agent user | Top-level = 3 rows (at current data: anthropic $11.55/82×, openai $4.11/29× — via RULE, verified not hardcoded); depth tie-break fires correctly on the x-ai/openai 60.9 tie; collapsed chrome carries ceiling 133× + lens prices; no-brand-lock fixture test passes; twin cross-pairs and opus-5-fast ceiling exclusions unchanged; `npm test` green. | 100×2×0.9÷2 = 90 | **Ready** — brief at `docs/product/b17-task-brief.md` + D22 | B16 (done) |

## Next

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B5 | Harden the task-mix control (shipped in B1 v1 as a basic 3-input control): slider UX, share validation, persistence across reloads, per-row tooltips adding coding/agentic indexes (trial-3 micro-fix: makes "why is opus planning" inspectable in one hover), and full test coverage of live re-ranking. Now also covers the frontier-band control (added in B15). | Solo agent user | The pair re-ranks within one render frame on mix/band change and matches recomputed expected-$ in tests; mix + band persist across reload; tooltips show coding/agentic; zero console errors. | 80×2×0.8÷2 = 64 | Ready | B17 |
| B7 | Weekly automated refresh + redeploy (README §Refresh-schedule promoted to infra). | Solo agent user | Data is ≤7 days old on every visit, timestamp visible on the page. | 100×1×0.9÷2 = 45 | Ready | — |
| B8 | Add eslint. | Engineering | Lint passes on CI. | 10×0.5×1÷1 = 5 | Ready | — |

## Later

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B6 | Add a "task-type fit" signal per model — split fitness by PLANNING (long-context reasoning) vs EXECUTION (edit-precision) vs VERIFICATION (defect detection). Requires sourcing benchmark splits per type; blocked on sparse `coding_index`/`agentic_index` in AA's free tier (72/54 of 624). | Solo agent user | Each plotted model has a per-type fitness score, not just general intelligence. | 60×3×0.45÷10 = 8.1 | Not ready — research (data-blocked) | AA tier upgrade or external benchmark source |

## Done

| ID | Outcome | Status |
|---|---|---|
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