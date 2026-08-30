# B12 task: AA intelligence source + catalog variant collapse

## Context

You are implementing decisions **D14** and **D15** for "Model Cost Intelligence
Analysis". Read in `docs/product/decision-log.md`: D4 (data integrity over
coverage — the absolute rule), D12 (prior intelligence pipeline, whose
fetcher/failure contract you inherit), D14 (AA free API as the sole
intelligence source, effort-variant policy), D15 (variant collapse rule).
Also read `docs/product/b11-report.md` for the current pipeline state you are
modifying.

Two independent lines of evidence motivate this task — both verified against
primary sources and recorded in the decision log:

1. **OpenRouter's benchmark feed keys by dated `model_permaslug`**
   (`openai/gpt-5.6-sol-20260709`) while its catalog keys by undated ID —
   exact matching produced only 8.9% coverage (19/213). The cross-source-join
   defect class D12 aimed to kill reappeared *inside one vendor*.
2. **AA's free API** (`https://artificialanalysis.ai/api/v2/language/models/free`)
   was probed and verified: 624 models across 4 pages (`?page=N`), 611 with
   `intelligence_index` (v4.1), plus `coding_index` (72) / `agentic_index`
   (54) — and **per-variant scores** (Luna 52.3 vs Sol 60.9: the original
   Luna-wearing-Sol's-score defect is structurally impossible here).

Additionally, **D15's finding**: several "-pro"/"-fast" catalog variants are
NOT distinct models — OpenRouter descriptions state they're "the same
underlying model" served in a different reasoning/speed mode (verified for
GPT-5.6 family Pro variants and Claude `-fast` variants). These must collapse
into their base model before any join. Legacy Pros (`o1-pro`, `gpt-5-pro`,
`gpt-5.4/5.5/5.2-pro`) are genuinely different products and stay separate.

## Architecture after this task

```
fetch-pricing (OpenRouter /models) ──┐
                                     ├─→ build-data ──→ models.json
fetch-aa-benchmarks (AA free API) ───┘
```

The OpenRouter benchmarks fetcher is RETAINED as an auxiliary script (D14's
documented fallback) but REMOVED from the default `npm run data` pipeline.

## Part A — `scripts/fetch-aa-benchmarks.js` (new)

Fetch ALL pages of `https://artificialanalysis.ai/api/v2/language/models/free`
(page 1, then follow `pagination.has_more` / `total_pages` — verified 4 pages,
200/page max). Pass `?page=N` for subsequent pages.

- **Auth:** `x-api-key` header from `process.env.AA_API_KEY` (key is already
  in `.env`; the npm script wires it via `--env-file`, same pattern as B11).
  Missing/empty key → fail loudly + error-flagged output file. No hardcoded keys.
- **Host detail (probed):** the endpoint lives on `artificialanalysis.ai` —
  NOT `api.artificialanalysis.ai` (that subdomain 404s everything).
- **Response shape (probed):** top-level `{tier, intelligence_index_version,
  pagination, data}`; each model carries `slug`, `name`, `release_date`,
  `model_creator.name`, `evaluations.artificial_analysis_intelligence_index`
  (+ `artificial_analysis_coding_index`, `..._agentic_index`), `pricing`,
  `performance`. **Trust the actual response over this brief** — probe and
  adapt if fields differ.
- **Output:** `public/aa-raw.json` = `{source, fetched_at,
  intelligence_index_version, models: [...]}` verbatim (no field renaming).
- **Failure contract (inherit from B11, four named states):**
  `missing_key` / `fetch_failed` / `malformed_response` / `capture_shrink`
  (>20% smaller model count than the previous valid capture → preserve prior
  valid data under a sibling key/file; `build-data.js` must then FAIL, never
  consume stale data). Log `parsed N models across P pages, M with
  intelligence_index`. Never a partial file; never silent degradation.
- **Page-loop honesty:** if ANY page fails mid-loop, the whole capture is
  error-flagged (a partial catalog looks like a complete one).

## Part B — variant collapse (D15), BEFORE any join

Extend the existing `derive-metadata.js` (or a sibling pure module) with:

1. **Sibling extraction:** parse the OpenRouter catalog
   `description` (already in `pricing-raw.json` — verify) for the phrases
   "same underlying model as [SIBLING]" or "identical capabilities", where
   SIBLING is the markdown link target. Extract the sibling slug.
2. **Collapse rules:**
   - If a catalog model's description matches → it collapses into the sibling:
     the sibling becomes the model's row (sibling ID, name, price basis,
     context); the variant is logged and dropped as a separate row.
   - Only ONE hop: the sibling itself must not also collapse (if it does,
     drop the variant entirely and log it — a collapse chain is suspicious
     data and must not be silently followed).
   - The sibling must exist in the paid canonical catalog; otherwise leave
     the variant as its own row (conservative: an unresolvable variant stays
     an honest separate row rather than being dropped by guesswork).
   - `per_request_limits`, `supported_parameters`, or any *additional* field
     that materially differs between variant and sibling (beyond speed/price
     tier) → treat as distinct; log in report. (Defensive check: "same model,
     different mode" should never differ in modality/context.)
3. **Never collapse** on: `-chat` / Instant aliases, legacy `-pro` IDs
   (`o1-pro`, `gpt-5-pro`, `gpt-5.2/5.4/5.5-pro`), `:free`/`:batch` (already
   handled by the paid-canonical pricing filter — do not double-handle), or
   any model where the sibling link can't be extracted deterministically.
4. **Audit trail:** every collapse is logged with
   `{variant_id, base_id, matched_phrase}` in `build-data.js` console output
   AND in the B12 report. This list is the D4 evidence that no silent merges
   happened.

Expected collapses (from the D15 probe; verify against live data):
`gpt-5.6-{luna,terra,sol}-pro` → their bases; `claude-opus-5-fast`,
`claude-opus-4.8-fast`, `claude-opus-4.7-fast` → their bases.

## Part C — AA join in `build-data.js`

Replace the OpenRouter-benchmarks join. Order of operations:

1. Build the (post-collapse) catalog from pricing-raw + allowlist.
2. Load `aa-raw.json`. Index scored AA models by **normalized slug**.
3. **Normalization rule (deterministic, test-fixed):** normalize separators —
   lowercase, strip all non-alphanumerics. `gpt-5.6-luna` ↔ `gpt-5-6-luna`
   match. Catalog tail = ID after the vendor prefix. Catalog-side date
   stripping allowed: strip trailing `[-.]?(20\d{2})?(\d{2})(\d{2})` patterns
   (e.g. `deepseek-v4-pro-0813` → `deepseek-v4-pro`) — **catalog side only;
   NEVER date-strip AA slugs** (vendors date the same generation differently;
   D14 forbids AA-side date reasoning).
4. **Effort-variant policy (D14, decided):** AA often scores effort variants
   (`-low/-medium/-high/-xhigh`) of the same base with real score spreads
   (probe found 100 bases with disagreeing variants; spreads up to 20+).
   Resolution order:
   a. Plain un-suffixed base with a score → use it (this is AA's headline
      number), `intelligence_scope: null` (it's model-exact).
   b. Only effort variants → **median of their scores**,
      `intelligence_scope: "effort-median"`, and store the component scores in
      a non-UI field `effort_scores` for auditability. NEVER take max/min/
      first — the median is the only choice that isn't a silent judgment call.
   c. If BOTH the base and effort variants exist, rule (a) wins — the base
      IS the model's score; effort variants describe request modes.
5. Match catalog → AA: exact normalized slug match only. Post-normalization
   collisions (two AA models normalizing to one catalog ID with DIFFERENT
   scores and no base-variant relationship) → catalog model gets
   `intelligence: null` + a report listing the collision. A wrong score is
   worse than a missing one.
6. Populate per record: `intelligence` (verbatim
   `artificial_analysis_intelligence_index`), `intelligence_source: "artificial-analysis"`,
   `coding_index`, `agentic_index` (pass-through, may be null),
   `intelligence_scope` (null | `"effort-median"`).
   `benchmarks_fetched_at` from the AA capture. Retire the OpenRouter
   benchmarks read from the default build (keep the fetcher file as an
   auxiliary, out of `npm run data`).
7. Console summary: the B11 format plus a collapse line and an effort-median
   count: `[build-data] N models, X with intelligence, Y with pricing, Z
   variants collapsed, E effort-median scores`.

## Part D — UI + README

- Update any "OpenRouter benchmarks" provenance strings to "Artificial
  Analysis" (tooltips, footer, axis labels — grep "openrouter-benchmarks").
- Add attribution: "Intelligence data via Artificial Analysis API — required
  by AA's terms on ALL tiers. Must be visible: README + UI footer." Also
  credit OpenRouter for catalog/pricing as already done.
- `intelligence_scope: "effort-median"` renders on the tooltip like the old
  family-aggregate label did ("effort-variant median"), so the flag is
  visible, not buried.
- README: pipeline table gains the AA row (endpoint, key, attribution);
  documents the collapse rule and the effort-variant policy in one paragraph
  each; remove OpenRouter-benchmarks from the default-pipeline description.

## Part E — tests

Fixture-based (no live network), covering:

1. Collapse: variant → sibling extraction from description text; one-hop
   enforcement; unresolvable-sibling fallback (row stays); legacy-pro and
   -chat NOT collapsed.
2. Slug normalization: `gpt-5.6-luna` ↔ `gpt-5-6-luna`; catalog date-stripping
   (`deepseek-v4-pro-0813` → `deepseek-v4-pro`); AA-side dates NOT stripped
   (`deepseek-v4-pro-0424` must NOT match `deepseek-v4-pro`).
3. Effort policy: base-present wins over variants; effort-only → median +
   scope label; single-variant → that score + scope label.
4. Collision → null + collision list.
5. Failure contract: all four error states + build-data fail-on-error.
6. The verbatim-value rule: an AA score passes through untransformed.

## Verification (report against these)

- `npm run data` — capture logs show pages/models/scored counts.
- **Coverage %:** scored models / 213 tracked. D14's gate is 60%; report the
  honest number either way. Pre-implementation estimate: 54.9% exact +
  ~3% from date-stripping ≈ 58%; **the collapse (Part B) may push it over
  60%** — collapsed variants inherit their base's score legitimately.
- **The Luna acceptance check (from the original defect):**
  `gpt-5.6-luna` carries ITS OWN measured score (~52.3 from AA), distinct
  from Sol (~60.9) — and `gpt-5.6-luna-pro` no longer exists as a separate
  row (collapsed into luna).
- **The no-fabrication checks:** zero effort-variant picks that silently
  chose max/min; the effort-median count + scope labels appear; the
  collision list is empty or reported.
- `npm test` green; `npm run dev` renders without console errors; pair card
  works; footers/attribution visible.

## What to return (write to `docs/product/b12-report.md`)

1. Probe result: AA response shape verbatim (one record), pages fetched.
2. **Collapse audit table**: variant → base (every row), with the description
   phrase that triggered each. Confirm legacy-pro/-chat were NOT collapsed.
3. **Join coverage:** catalog size, covered, %, AND the decomposition:
   exact-base matches / effort-median matches / collisions / misses (list
   the misses by family).
4. The Luna acceptance check output.
5. Effort-ambiguity report: models resolved via median, with their variant
   score sets.
6. Test list + `npm test` output.
7. Known issues (incl. whether the 60% gate passed).

## Constraints

- **D4 absolute:** verbatim scores only. No interpolation, no fuzzy matches,
  no max-picking. Every derived match (median, collapse) carries a visible
  label + a report line.
- **AA-side date stripping is forbidden.**
- Do not modify the pair algorithm, quadrant math, or allowlist.
- Do not remove `scripts/fetch-openrouter-benchmarks.js` — it stays as an
  auxiliary/fallback script, just out of the default pipeline.
- Keep `.env` handling exactly as B11 built it (no new env vars beyond
  `AA_API_KEY`, which is already present).
