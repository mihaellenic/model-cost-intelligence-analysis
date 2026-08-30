# B3 task: OpenRouter as source of truth — programmatic coding-model discovery

## Context

You are working on the "Model Cost Intelligence Analysis" project — a tool that
helps a solo developer using a coding agent pick a pair of models (planning +
execution) by intelligence vs cost. Read these before starting:
- `docs/product/vision.md` — what the product is (coding-only, cost optimization)
- `docs/product/b2-taxonomy.md` — the 3 task types and default mix
- `docs/product/decision-log.md` D4, D8, D9 — the constraints you operate under

## What changed and why

The pipeline is being restructured (decision D8). The current state:

- `scripts/curated-list.json` — a hand-maintained list of 39 models, each with
  id/name/family/params_b/size_gb/tier. **This is being replaced** by a
  family-allowlist (~25 prefixes) that filters OpenRouter's full catalog.
- `scripts/fetch-ollama.js` — fetches Ollama slugs. **Becomes dead code** —
  remove it and remove the `ollama_available` field from the output and UI.
- `scripts/build-data.js` `PricingMap` — hand-curated curated-id → OpenRouter-id
  mapping. **Becomes dead code** — every model's price comes straight from the
  OpenRouter API. This is the biggest win: the fragilest, most error-prone part
  of the pipeline (D4's biggest risk surface) is removed.
- `scripts/build-data.js` `FAMILY_PATTERNS` — **stays**, but the family names
  change from Ollama-style (`qwen2.5-coder`) to OpenRouter-derived (`claude`,
  `gpt`, `deepseek`, etc.), so the regexes need to match the new naming.
- `size_gb` field — **removed**. Ollama-only metadata, not derivable from
  OpenRouter. Not needed for the product (the cost axis is API pricing only,
  per vision §"What it is not").

## Your job

Rewrite the data pipeline so that **OpenRouter's `/api/v1/models` endpoint is
the source of truth for the model list**, filtered to coding-relevant models by
a family-allowlist, with metadata (`params_b`, `family`, `tier`) derived from
model names. The output (`public/models.json`) keeps the same shape the UI
consumes, minus the removed fields.

## Step 1 — design the family-allowlist

Create a new `scripts/family-allowlist.json` (or a section in build-data.js)
containing ~20-30 family prefixes that are coding-relevant. This is the new
curation boundary (D9). For each family, specify:
- `prefix` — the OpenRouter ID prefix to match (e.g. `anthropic/claude-`,
  `openai/gpt-`, `google/gemini-`, `deepseek/`, `qwen/`, `mistralai/`, etc.)
- `family` — the normalized family name for the output (e.g. `claude`, `gpt`,
  `gemini`, `deepseek`, `qwen`, `mistral`)
- `coding_only` — a flag or sub-list if only some variants in the prefix are
  coding-relevant (e.g. under `google/gemini-`, exclude `gemini-vision` if it
  exists; under `openai/gpt-`, include o-series but maybe not `gpt-image`).

**Examine the actual OpenRouter catalog first.** Run `node scripts/fetch-pricing.js`
(or read `public/pricing-raw.json` if it exists) and look at what's there. Don't
guess prefixes — match what OpenRouter actually serves. The existing
`fetch-pricing.js` already pulls the full catalog into `pricing-raw.json`;
inspect the `id` and `name` fields to design the allowlist.

**Coding-relevance is the integrity gate (D4).** A non-coding model that slips
into the plotted set contaminates the quadrant medians. Be conservative: if a
family is ambiguous (e.g. a general chat model that's sometimes used for code),
include it but flag it; if a family is clearly non-coding (image, audio,
embeddings, vision-only), exclude it.

The current curated list's families are the starting point:
qwen, deepseek, codellama, codestral, llama, gpt-oss, mistral, gemma, phi,
starcoder, granite-code, glm, kimi, minimax. **Add the missing ones:** claude,
gpt, gemini, deepseek-v3/r1, and any other coding-relevant families present on
OpenRouter.

## Step 2 — write the metadata derivation

OpenRouter provides `id`, `name`, `context_length`, and pricing — but NOT
`params_b`, `family` (normalized), or `tier`. Derive them:

- **`family`**: from the allowlist entry that matched the model's ID prefix.
  This is already determined in Step 1's matching — the family is the one
  associated with the matched prefix.
- **`params_b`**: parse from the model name or ID with regex. Look for patterns
  like `32b`, `7B`, `70b-instruct`, `-mini`, `-small`, `-large`. For models
  where params aren't in the name (e.g. Claude, GPT, Gemini — closed models
  that don't disclose param count), set `params_b` to `null`. **This is
  acceptable** — the scatter uses `params_b` for bubble size, and `null` can
  render as a default mid-size bubble. Don't fabricate numbers.
- **`tier`**: derive from `params_b` with thresholds (e.g. ≤3 = tiny, ≤7 =
  small, ≤14 = medium, ≤35 = large, >35 = xl, null = cloud/unknown). For
  closed models (null params), use `cloud` or `unknown`.

Write this as a **pure, testable function** in a new file
`scripts/lib/derive-metadata.js` (or inline in build-data.js if you prefer, but
keep it as isolated functions). B4 (the test harness) will need to test this.

## Step 3 — rewrite build-data.js

Restructure the pipeline:

1. **Input:** `public/pricing-raw.json` (from `fetch-pricing.js`, unchanged)
   + `public/intelligence-raw.json` (from `fetch-intelligence.js`, unchanged)
   + `scripts/family-allowlist.json` (new).
2. **Filter:** apply the family-allowlist to the OpenRouter model list. Each
   model either matches a prefix (→ included, with the family from the
   allowlist) or doesn't (→ excluded).
3. **Derive:** run the metadata derivation on each included model.
4. **Match intelligence:** keep `findIntelligence()` logic, but update
   `FAMILY_PATTERNS` to use the new family names (from the allowlist) matching
   against benchlm names. The generation-safe, size-token-exact, tier-negative
   rules stay (D4).
5. **Price:** comes straight from the OpenRouter data — no more `PricingMap`.
   Keep the `:free` variant exclusion (free variants are listed as providers
   but never used as the cost basis — a $0 free tier is not the model's price).
   This logic moves from `findPricing()` into the main pipeline since there's
   no more ID mapping.
6. **Output:** `public/models.json` with per model: id, name, family, params_b
  (nullable), tier, intelligence, intelligence_source, intelligence_scope,
  intelligence_ref, cost_per_1m_avg, cheapest_provider, providers, context_length.
  **Remove:** `size_gb`, `ollama_available`.
7. **Console output:** keep the summary line: `[build-data] N models, X with
  intelligence, Y with pricing`.

## Step 4 — update package.json scripts

`npm run data` currently runs `fetch-ollama && fetch-intelligence && fetch-pricing
&& build-data`. Change it to `fetch-intelligence && fetch-pricing && build-data`.
Remove `fetch-ollama` from the script and delete `scripts/fetch-ollama.js`.

## Step 5 — update the UI for removed/changed fields

- `src/lib/filters.js`: `FAMILY_COLORS` needs entries for the new families
  (claude, gpt, gemini, etc.). Generate a distinct color per family — either
  hand-pick or use a hash-based color function for families not in the explicit
  map.
- `src/charts/scatter.js` line 178: `r: Math.max(5, Math.min(22, Math.sqrt(m.params_b) * 1.3))`
  — handle `params_b === null` (closed models). Use a default bubble size (e.g.
  `r: 10`) when params_b is null.
- `src/charts/scatter.js` tooltip (line 54): `Params: ${m.params_b}B` — show
  "Params: —" or "Params: undisclosed" when null.
- Any reference to `ollama_available` or `size_gb` in the UI — remove.

## Step 6 — verify

Run `npm run data`. Check:
- Console shows the model/intelligence/pricing counts.
- `public/models.json` contains only coding-relevant models (spot-check: no
  image/audio/embedding models).
- Plottable count (models with both intelligence AND cost) is substantially
  higher than 13 — the target is a floor of 25, but with the full OpenRouter
  coding catalog, expect more.
- No model has a fabricated `params_b` (closed models should be null, not
  guessed).
- No `:free` variant is used as a cost basis (cost_per_1m_avg > 0 for all
  priced models).

Then run `npm run dev` and check the scatter renders without errors.

## What to return

### 1. Family allowlist
The contents of `scripts/family-allowlist.json` (or wherever you put it), with
a one-line justification per family for why it's coding-relevant.

### 2. Architecture changes
A summary of what was removed (fetch-ollama, PricingMap, size_gb,
ollama_available) and what was added (allowlist, derivation function, new
family patterns).

### 3. Metadata derivation rules
The exact regex/logic used to derive `params_b`, `family`, `tier` from model
names, with examples of 3-5 models showing input → derived output.

### 4. Final counts
From `npm run data`:
- Total models tracked (after allowlist filter)
- Models with intelligence
- Models with pricing
- **Plottable models (both)** — the success metric
- A breakdown by family (how many models per family)

### 5. Coverage note for B1
One paragraph: does the plottable set span the full intelligence × cost range?
Are there empty quadrants? Are planning-slot candidates (frontier: Claude, GPT,
Gemini, DeepSeek) and execution-slot candidates (budget/mid-range) both
well-represented? This feeds B1's pair recommendation.

### 6. Test surface report for B4
List the pure functions you created (derivation, allowlist matching, free-variant
filtering) that should be tested in B4. Name the file, function, and what
inputs/outputs the tests should cover. This is a handoff to B4, not tests you
write now — but identifying the surface now makes B4 faster.

### 7. Known issues
Anything you couldn't derive cleanly (e.g. a model family where params_b parsing
is unreliable), any benchlm matching gaps (families with no benchlm coverage),
any UI rendering issues with the larger model set.

## Constraints

- **D4 (data integrity over coverage) is non-negotiable.** No fabricated
  params_b. No guessed family matches. No `:free` as cost basis. A missing
  model is honest; a wrong number contaminates the quadrant math.
- **Don't change the intelligence-matching rules** (generation-safe,
  size-token-exact, tier-negative). Only update `FAMILY_PATTERNS` for the new
  family names.
- **Coding-only (vision §"What it is not").** The allowlist is the gate. If
  you're unsure whether a family is coding-relevant, exclude it and note it in
  your report — it's easier to add later than to remove a contaminant.
- **Don't touch the quadrant math or pick logic** (`src/lib/quadrants.js`). It
  operates on the output fields and doesn't need to know about the pipeline
  change.
- **Keep the output shape stable** for the UI. The fields the UI reads
  (id, name, family, params_b, tier, intelligence, cost_per_1m_avg,
  cheapest_provider, providers) keep the same names. Only `size_gb` and
  `ollama_available` are removed.