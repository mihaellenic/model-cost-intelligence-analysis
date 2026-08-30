# Backlog

Prioritized by RICE (Reach × Impact × Confidence ÷ Effort). Reach is the % of the primary persona's sessions the outcome touches; Impact is 0.25/0.5/1/2/3 (stopgap / low / medium / high / massive); Confidence in 0–1; Effort in person-days.

## Now

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B1 | Replace single-model picks with a **recommended pair** (planning model + execution model) as the primary output, ranked by expected $ across the default task mix (~65/30/5), with the mix exposed as a visible adjustable parameter from v1. **Params-free data model per D10**: remove `params_b`/`tier` fields, derivation functions, bubble-size encoding, max-params filter, and "Best small" pick (which supersedes B9's null-handling bug by deleting the logic). | Solo agent user | Pair recommendation renders on the page; user can complete a "pick my pair" task in <60s in a usability check (≥5 of 5 internal trials); expected-$ math uses the B2 taxonomy; zero `params_b` references remain in output or UI. | 100×3×0.8÷8 = 30 | **Ready** — brief at `docs/product/b1-task-brief.md` | ~~B2~~, ~~B3~~ (done) |

## Now

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B11 | Switch the intelligence source entirely to OpenRouter `/api/v1/benchmarks` (D12): fetch via API key, join by exact OpenRouter ID, delete all benchlm scraping/matching code (`fetch-intelligence.js`, `FAMILY_PATTERNS`, `findIntelligence`). Capture `coding_index`/`agentic_index` pass-through for B6. | Solo agent user | Coverage ≥60% of tracked models with `intelligence_index` (D12 fallback trigger below that); every score verbatim from the API (spot-checked); `npm test` green; zero benchlm references in pipeline or UI. | 100×3×0.8÷3 = 80 | **Ready** — brief at `docs/product/b11-task-brief.md` | B13 (supersedes its benchlm scope; reuse its guard patterns) |
| B12 | Switch intelligence to AA free API (D14) + collapse same-model variants (D15): fetch-aa-benchmarks.js (paginated, failure contract), description-based variant collapse before join, normalized-slug join with effort-variant policy (base-wins, median-flagged fallback), OpenRouter benchmarks out of default pipeline. | Solo agent user | Coverage ≥60% tracked models with intelligence (report honest number); Luna acceptance check passes (luna=52.3≠sol=60.9, luna-pro collapsed); zero silent variant picks; `npm test` green; attribution visible. | 100×3×0.8÷4 = 60 | **Done 2026-08-30** — 59.52% coverage (125/210), gate amended by D16; all claims independently verified (counts, verbatim AA scores, collapse audit, 38 tests green). Claude -fast rows retained by material-difference guard (see pending D15 amendment, user deliberating). See `b12-report.md`. | B11 (done) |
| B14 | Close the residual intelligence-coverage gap by **hardcoding verified scores** (per the standing mandate "if automatic matching is not possible, hardcode it if needed") for high-value unscored models — prioritized by pair-card relevance (planning-slot candidates first), every hardcode sourced from a primary citation (AA web page, vendor leaderboard, or vendor docs) and stored with `intelligence_source: "manual"` + the citation. NOT a bulk effort: cap at ~10 models per pass, only where a verifiable score exists. Also implements **D17** (variant-inherited intelligence for non-collapsed mode variants, e.g. Claude `-fast`). | Solo agent user | Each hardcode has a citation in the audit trail; D17 inheritance audit shows exactly which variants inherited and why; planning-slot candidate pool has zero unscored frontier models; coverage decomposition reported (AA-join / effort-median / variant-inherited / manual). | 80×2×0.7÷2 = 56 | **Ready** — brief at `docs/product/b14-task-brief.md` (Part 1 = D17, Part 2 = hardcodes; separate commits) | B12 (done) |
| B10 | ~~Deduplicate economically-identical recommendations in the pair card~~ **Superseded by D15** — the Luna/Luna-Pro fake-runner-up case dissolves by construction: same-model variants collapse into their base before the join, so the pair card can never see them as distinct candidates. If economically-identical *distinct* models still produce duplicate-looking recommendations after B12, reopen with that narrower scope. | Solo agent user | — | — | Superseded — re-verify after B12 | B12 |
| B13 | ~~Benchlm pagination probe + scraper hardening~~ **Superseded by D12** — the live probe proved the scraper's filter dropped zero scored models (all 128 dropped entries had no score; the truncation was the HTML embed itself), and benchlm is exiting the pipeline entirely. If the dispatched agent already landed guard patterns (capture-summary logging, >20%-shrink guard, error-flagged outputs), they carry forward into B11 verbatim. | Engineering | — | — | Superseded | — |

## Next

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B5 | Harden the task-mix control (shipped in B1 v1 as a basic 3-input control): slider UX, share validation, persistence across reloads, and full test coverage of live re-ranking. | Solo agent user | The pair re-ranks within one render frame on mix change; the re-rank matches a recomputed expected-$ in tests; the mix persists across a page reload. | 80×2×0.8÷2 = 64 | Scope reduced — core control ships in B1 v1; B5 is polish + tests | B1 |
| B4 | Expand the `node:test` harness to cover the intelligence-matching logic (generation-safe regex + size-token-exact) in `build-data.js`, which is still untested. B3 already added 9 tests for the derivation functions and UI helpers. | Engineering | Tests green covering `findIntelligence` edge cases: same-family different-generation, tie/fallback, absent BenchLM coverage. | 10×2×0.9÷2 = 9 | Ready | B3 (done) |

## Later

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B6 | Add a "task-type fit" signal per model — split fitness by PLANNING (long-context reasoning) vs EXECUTION (edit-precision) vs VERIFICATION (defect detection). Requires sourcing benchmark splits per type. | Solo agent user | Each plotted model has a per-type fitness score, not just general intelligence. | 60×3×0.45÷10 = 8.1 | Not ready — research | External benchmark source(s); Code Review Agent Benchmark is a candidate for verification (per online research) |
| B7 | Weekly automated refresh + redeploy (the README §Refresh-schedule example, promoted to actual infra). | Solo agent user | Data is ≤7 days old on every visit, verified by a timestamp on the page. | 100×1×0.9÷2 = 45 | Ready | — |
| B8 | Add eslint. | Engineering | Lint passes on CI. | 10×0.5×1÷1 = 5 | Ready | — |

## Done

| ID | Outcome | Audience | Success metric | RICE | Status | Dependencies |
|---|---|---|---|---|---|---|
| B2 | Define a coding-agent task taxonomy with default task-mix weights. | Solo agent user (via product) | Documented taxonomy with ≥2 types and default weights; usable as B1's cost-math input. | 100×3×0.6÷3 = 60 | **Done 2026-08-29** — 3 types (PLANNING/EXECUTION/VERIFICATION), default mix ~65/30/5, see `b2-taxonomy.md` | — |
| B3 | Restructure the pipeline so OpenRouter is the source of truth. | Solo agent user | Plottable ≥25; zero non-coding contamination; zero fabricated params_b; scatter renders. | 100×3×0.8÷7 = 34 | **Done 2026-08-30** — 213 tracked, 94 plottable, zero D4 violations, 9 tests green. See `b3-report.md`. | — |
| B1 | Replace single-model picks with a **recommended pair** as the primary output; params removed per D10. | Solo agent user | Pair renders on the page; "pick my pair" in <60s (≥5/5 internal trials); zero `params_b` references. | 100×3×0.8÷8 = 30 | **Implementation done 2026-08-30, pending usability check** — pipeline verified (pair math, floors, mix re-ranking all reproduce from fresh data; 9 tests green; zero stray params references). The <60s usability check is the remaining part of the success metric and cannot be agent-verified. See `b1-report.md`. | — |

## Explicitly deferred / out of scope

- **Build-vs-buy / TCO for teams** — persona is out of scope per vision. Revisit if a second persona is ever admitted.
- **Self-host cost axis** — README §Caveats and vision §"What it is not." The cost axis is meaningless for local inference; not adding GPU depreciation / electricity modeling.
- **General (non-coding) LLM leaderboard** — out of scope per vision.