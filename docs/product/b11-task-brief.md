# B11 task: intelligence comes from OpenRouter — remove benchlm from the pipeline

## Context

You are restructuring the intelligence intake for "Model Cost Intelligence
Analysis" per decision **D12** in `docs/product/decision-log.md`. Read D12,
D13, and D4 before starting. Also read `docs/product/b2-taxonomy.md` for where
the per-type score fields will eventually land (B6 — not built in this task).

**The decided architecture (D12):** OpenRouter becomes the sole primary source
for catalog, pricing, AND intelligence. The benchlm scraper is removed from
the pipeline entirely. The purpose is **join elimination**: every past data
integrity defect in this project (family-aggregate score fabrication, scrape
truncation, the old PricingMap) lived at a cross-source join. Same-source data
matched by exact OpenRouter ID eliminates the join class entirely.

## What you will build

### 1. `scripts/fetch-openrouter-benchmarks.js` (new)

Fetches `GET https://openrouter.ai/api/v1/benchmarks` (no `task_type` filter —
get everything in as few requests as possible; the limit is 500 req/day, we
need 1–2).

- **Auth:** requires an OpenRouter API key. The key lives in `.env` at the
  repo root as `OPENROUTER_API_KEY=...` (**already created by the user;
  `.env` is already gitignored — verify but do not modify `.gitignore`**).
  Node loads it via the built-in `--env-file` flag (Node ≥20.6; no dotenv
  dependency — do not add one). In the fetcher, read
  `process.env.OPENROUTER_API_KEY`. If missing or empty, fail loudly with a
  clear message ("OPENROUTER_API_KEY not set — see README") and write the
  error-flagged output file (see failure behavior below). Do NOT hardcode any
  key or commit any key.
- **Output:** `public/benchmarks-raw.json` with shape
  `{ source, fetched_at, benchmarks: [...] }` — preserve the endpoint's own
  response fields verbatim inside `benchmarks` (do not rename or normalize
  score fields; downstream code adapts to the API's naming, not vice versa).
- Probe the response shape first with a curl/node one-off and record the actual
  field names in your report (the docs suggest `intelligence_index`,
  `coding_index`, `agentic_index`, and per-benchmark task entries — trust what
  the API returns over the docs).
- **Capture honesty (pattern from D13):** log `parsed N benchmark entries, M
  with intelligence_index`. If the fetch errors or returns malformed JSON,
  write `{ source, fetched_at, error, error_detail }` — never a silently-partial
  file. **Failure taxonomy, explicit (the file is always one of exactly two
  states):**
  - missing/empty key → `{ ..., error: "missing_key" }`
  - HTTP failure (non-200, network) → `{ ..., error: "fetch_failed", error_detail: "<status or message>" }`
  - malformed/unexpected JSON shape → `{ ..., error: "malformed_response", error_detail: "<what was expected vs found>" }`
  - capture >20% smaller than the last *valid* capture → `{ ..., error: "capture_shrink", error_detail: "prior N, current N" }` — and in this case only, prefer **keeping the previous valid file's data intact under a sibling key** (`previous_benchmarks`, or write `benchmarks-raw.prev.json`) rather than overwriting good data with an error envelope; `build-data.js` must then refuse to proceed (fail the run) rather than silently consume stale data.
  - Rule for all four: **never a partial merge of old + new data**; the file is either fully valid new data or a fully-flagged error state.
- **Downstream behavior on error states (load-bearing):** if `benchmarks-raw.json`
  is in any error state, `build-data.js` must **fail the run with a clear
  message** (non-zero exit) — NOT proceed to build `models.json` with all-null
  intelligence. A cost tool silently rendering every model unscored is a worse
  failure mode than a broken build (D4). Exception: total-source-outage
  degradation is a product decision, not an engineering one — log it as a
  known issue in the report; do not implement silent degradation.
- **Stability guard:** before overwriting, read the previous
  `benchmarks-raw.json`; if the new capture is >20% smaller, write the error
  flag and warn. (Same guard pattern as the scraper fix you may have already
  implemented in B13 — reuse the pattern.)

### 2. `scripts/build-data.js` — join by exact ID

- Read `public/benchmarks-raw.json`.
- **Precondition: validate the error state first.** If the file carries an
  `error` field (any of the four states above), fail the run with a clear
  message and non-zero exit — never consume stale or error-flagged data as if
  valid. If a `previous_benchmarks` recovery structure exists (capture-shrink
  case), still fail: stale-but-good data is a human decision to make, not an
  automatic one (`npm run data` should be re-run fresh instead).
- **Freshness surfacing:** read `fetched_at` and propagate it into the output
  (`models.json` gains a top-level `benchmarks_fetched_at`). No staleness
  enforcement yet (B7's concern) — but the age of the intelligence data must
  be visible in the output rather than invisible.
- For each catalog model (already sourced, priced, and filtered by the
  `scripts/family-allowlist.json` pipeline from B3), look up its benchmark data
  by **exact OpenRouter ID match** — `benchmarks-raw.json` entries are keyed by
  the same IDs as `pricing-raw.json`. No normalization, no fuzzy matching, no
  name-parsing. If the ID is absent from the benchmarks response →
  `intelligence: null`.
- Populate per model:
  - `intelligence` ← `intelligence_index` (or the API's equivalent field —
    use what the probe found)
  - `intelligence_source`: `"openrouter-benchmarks"` on every scored record
  - `coding_index` and `agentic_index` fields: **capture them in the output
    records now** (pass-through), even though the UI doesn't use them yet —
    B6 will. Cost: two fields. Don't compute anything from them yet.
- **Variant IDs (`:free`/`:batch`/any suffix) — the one sanctioned non-exact
  match (decided, this is the design answer):** benchmark entries are keyed by
  canonical OpenRouter IDs; catalog variants may not be. A variant inherits
  its canonical model's benchmark data by stripping everything after the
  FIRST `:` in its ID, only if ALL of: (1) the stripped canonical ID exists
  in the benchmarks response with a non-null `intelligence_index`; (2) the
  inheritance is one hop only (`foo/bar:something:free` → treat as unmatched,
  never double-strip); (3) the record is marked
  `intelligence_scope: "variant-inherited"` — a NEW label replacing the dying
  family/sub-family semantics — so the inheritance is visible, never silent.
  The `:free`-as-cost-basis exclusion is unchanged and independent (pricing
  logic — a variant inheriting a score must never combine with a $0 cost to
  re-enter the pair recommendation as a cheaper identical scorer; the
  existing paid-only cost filter already prevents this — keep it). If the
  canonical ID has no benchmark entry either → variant is `intelligence: null`,
  same as any unmatched model. List the IDs resolved via inheritance in the
  report so the D4 audit trail exists.
- **Delete the benchlm apparatus entirely:**
  - `scripts/fetch-intelligence.js`
  - `FAMILY_PATTERNS`, `findIntelligence()`, `TIER_NEGATIVE`,
    `SIZE_TOKEN`, and all intelligence-matching helper logic in build-data.js
  - `public/intelligence-raw.json` references in the pipeline
  - `npm run data` becomes: `fetch-pricing → fetch-openrouter-benchmarks → build-data`
- Keep the existing console summary format:
  `[build-data] N models, X with intelligence, Y with pricing` — and add
  `[build-data] intelligence source: openrouter-benchmarks`.

### 2.5 `package.json` — wire the env file into the pipeline scripts

Use Node's native `--env-file` (no dotenv dependency):

```json
"data": "node --env-file=.env scripts/fetch-pricing.js && node --env-file=.env scripts/fetch-openrouter-benchmarks.js && node scripts/build-data.js",
"data:pricing": "node --env-file=.env scripts/fetch-pricing.js",
"data:benchmarks": "node --env-file=.env scripts/fetch-openrouter-benchmarks.js"
```

Also update/remove the stale `data:intelligence` script (it points at the
deleted benchlm fetcher). Note: `--env-file` errors if `.env` is absent —
that is intended fail-loud behavior (a missing key should stop the pipeline,
not silently produce unscored output). The `build-data.js` step does not need
the env flag (it only reads local files).

### 3. UI — minimal, honest changes

- The intelligence axis label and tooltips should stop saying "benchlm" and
  say "OpenRouter benchmarks" (check `src/charts/*.js`, `src/main.js`,
  `index.html` for the "benchlm" string).
- Tooltip already shows `intelligence_ref` — that field goes away; remove it
  from tooltips and any UI code that reads it. Replace with nothing, or with
  the `intelligence_source` string where a provenance label existed.
- `intelligence_scope` ("family"/"sub-family" labels in tooltips) is now
  meaningless — every score is model-exact. Remove the scope label logic.

### 4. README

- Update the data pipeline table: benchlm row removed, OpenRouter benchmarks
  row added (endpoint, key requirement, 500 req/day note, CC BY 4.0 —
  attribution line: "Benchmark indexes via OpenRouter Data API (CC BY 4.0),
  aggregating sources including Artificial Analysis").
- Update the "Data integrity rules" section: matching is now by exact
  OpenRouter ID; there is no family-aggregate fallback, no fuzzy matching.
  State the D4 corollary: models without benchmark data render gray and are
  excluded from the pair recommendation.
- Document `OPENROUTER_API_KEY` setup: create `.env` at the repo root with
  `OPENROUTER_API_KEY=sk-or-v1-...`; it is loaded automatically by the npm
  scripts via Node's `--env-file` (no dotenv needed); `.env` is gitignored
  and must never be committed; where to get a key (openrouter.ai, free tier,
  500 data-API requests/day — the pipeline uses 1–2). Include the CC BY 4.0
  attribution line: "Benchmark indexes via OpenRouter Data API (CC BY 4.0),
  aggregating sources including Artificial Analysis."

### 5. Tests

- Update/remove `findIntelligence`-adjacent tests if any exist (B4's scope —
  if intelligence-matching tests exist, they die with the logic; note it).
- New tests for the join: exact-ID match populates fields; absent ID yields
  `intelligence: null` with `intelligence_source: null`; `:free`/`:batch`
  catalog variants inherit the canonical model's benchmark data IF the
  benchmarks response keys them to the canonical ID (verify actual behavior
  from the probe and match reality, whichever way it goes).
- Match the agent's design note: tests cover the exact-ID join and null
  behavior **independently of live network data** (fixture `benchmarks-raw.json`
  fixtures, not fetched data), PLUS: all four error-state behaviors (missing
  key, fetch failure, malformed response, capture shrink ≥20%), the
  `build-data.js` fail-on-error-state precondition, the one-hop variant
  inheritance rule (including the double-strip rejection and the
  `variant-inherited` scope label), and `benchmarks_fetched_at` propagation.
- Keep all existing pair/metadata tests green.

## Verification

- **Key hygiene check (do this first):** confirm `git check-ignore .env`
  returns `.env` (it is gitignored) and `git status` shows no `.env` staged
  or untracked-and-unignored. If either fails, STOP and report before any
  fetch.
- `npm run data` end-to-end with the `.env` key: report the exact console
  output (with the key value redacted).
- **The coverage number (decision-critical):** how many of the tracked models
  have `intelligence != null`? Report it AND the percentage. D12 has a
  fallback trigger if this is <60%.
- Spot-check three models against the raw benchmarks response by hand
  (pick one frontier, one mid, one obscure) — the record values must equal
  the raw values verbatim.
- `npm test` green; `npm run dev` — scatter renders, pair card renders, no
  console errors, no "benchlm" strings anywhere in the UI.

## What to return (write to `docs/product/b11-report.md`)

1. **Probe results:** actual response shape/field names of
   `/api/v1/benchmarks`, with one sample entry verbatim.
2. **Coverage:** models tracked / with intelligence / the percentage. The
   per-family breakdown of unscored models (which families lack indexes?).
3. **Records changed:** the exact new per-model record shape (one example).
4. **Removed:** the list of deleted files/functions/regexes (this is the
   join-elimination inventory — make it explicit).
5. **Spot-check results:** the three verbatim verifications.
6. **Known issues:** anything weird (models with indexes but no price, price
   but no index, duplicate benchmark entries, etc.).

## Constraints

- **D4 absolute:** no inferred, interpolated, or family-stamped scores. The
  only intelligence values in the output are verbatim `intelligence_index`
  values keyed by exact OpenRouter ID. Null stays null.
- **No benchlm code remains in the pipeline.** The old scraper file is
  deleted, not commented out. (benchlm's static data API stays documented in
  the decision log as the designated fallback — in docs, not in code.)
- **Don't touch:** `scripts/family-allowlist.json` (the coding-relevance gate),
  the pair algorithm in `src/lib/pair.js`, the quadrant math, the README
  sections unrelated to data sources.
- The key handling is already in place: `.env` exists (user-created),
  `.gitignore` covers it, scripts use `--env-file`. **Do not print, log, or
  commit the key value anywhere** — including in the report.
- If you already implemented pagination/hardening for the benchlm scrape
  (task B13, possibly in flight), that work is superseded for benchlm — but
  reuse its guard/logging patterns here (capture summary, >20% shrink guard,
  error-flagged output files).