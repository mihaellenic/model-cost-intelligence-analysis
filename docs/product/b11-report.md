# B11 report: OpenRouter benchmark intelligence intake

## 1. Probe results

The authenticated `GET https://openrouter.ai/api/v1/benchmarks` probe returned a top-level object with `data` and `meta`. `data` contained 1,449 heterogeneous benchmark entries. The score-bearing entries use `model_permaslug` (the exact OpenRouter ID), `intelligence_index`, `coding_index`, `agentic_index`, and `pricing` without renaming.

The observed first entry, preserved verbatim apart from JSON formatting, was:

```json
{
  "source": "artificial-analysis",
  "model_permaslug": "anthropic/claude-opus-5-20260723",
  "display_name": "Claude Opus 5 (Adaptive Reasoning, Max Effort)",
  "intelligence_index": 63.1,
  "coding_index": 78,
  "agentic_index": 59.2,
  "pricing": {
    "prompt": "0.0000055",
    "completion": "0.0000275"
  }
}
```

The fetcher stored the complete `data` array in `public/benchmarks-raw.json` as `benchmarks`, logged `parsed 1449 benchmark entries, 115 with intelligence_index`, and recorded `benchmarks_fetched_at` in `models.json`.

The verified `npm run data` console output was (no key value is emitted):

```text
[fetch-pricing] GET https://openrouter.ai/api/v1/models
[fetch-pricing] extracted 396 priced models
[fetch-pricing] wrote /Users/miha/Projects/model-cost-intelligence-analysis/public/pricing-raw.json
[fetch-openrouter-benchmarks] GET https://openrouter.ai/api/v1/benchmarks
[fetch-openrouter-benchmarks] parsed 1449 benchmark entries, 115 with intelligence_index
[fetch-openrouter-benchmarks] wrote /Users/miha/Projects/model-cost-intelligence-analysis/public/benchmarks-raw.json
[build-data] wrote /Users/miha/Projects/model-cost-intelligence-analysis/public/models.json
[build-data] 213 models, 19 with intelligence, 213 with pricing
[build-data] intelligence source: openrouter-benchmarks
```

## 2. Coverage

The verified build captured 396 priced catalog records and tracked 213 paid, allowlisted canonical coding models. Of those, 19 have a non-null exact-ID intelligence score: **8.92%**.

This is below D12's 60% fallback trigger. The benchmark-source-only approach therefore does not meet the decision's coverage gate; no fallback has been implemented in this task.

| Family | Unscored tracked models |
|---|---:|
| claude | 17 |
| codestral | 1 |
| deepseek | 9 |
| gemini | 13 |
| gemma | 4 |
| glm | 10 |
| gpt | 50 |
| granite | 2 |
| grok | 5 |
| kat-coder | 3 |
| kimi | 7 |
| llama | 7 |
| minimax | 8 |
| mistral | 10 |
| morph | 2 |
| phi | 1 |
| poolside | 2 |
| qwen | 41 |
| relace | 1 |
| seed-code | 1 |

No generated record used `intelligence_scope: "variant-inherited"`. This is expected for the present pipeline because the pricing basis accepts only canonical, non-colon-suffixed catalog IDs.

## 3. Records changed

`models.json` now exposes a top-level `benchmarks_fetched_at` timestamp and each score-bearing record contains the native OpenRouter indexes. A generated record from the verified build was:

```json
{
  "id": "mistralai/mistral-small-2603",
  "name": "Mistral: Mistral Small 4",
  "family": "mistral",
  "intelligence": 19.7,
  "intelligence_source": "openrouter-benchmarks",
  "coding_index": 26.6,
  "agentic_index": 4.6,
  "cost_per_1m_avg": 0.375,
  "cheapest_provider": {
    "name": "mistralai/mistral-small-2603",
    "prompt_per_1m": 0.15,
    "completion_per_1m": 0.6
  },
  "providers": [
    {
      "name": "mistralai/mistral-small-2603",
      "prompt_per_1m": 0.15,
      "completion_per_1m": 0.6
    }
  ],
  "context_length": 262144
}
```

For an exact match, `intelligence` is the raw `intelligence_index` and both task-oriented indexes are raw pass-through values. Unmatched records contain `intelligence: null`, `intelligence_source: null`, `coding_index: null`, and `agentic_index: null`.

## 4. Removed

- Deleted `scripts/fetch-intelligence.js`.
- Removed `public/intelligence-raw.json` from the active pipeline and all builder reads.
- Removed `FAMILY_PATTERNS`, `TIER_NEGATIVE`, `SIZE_TOKEN`, `normalize`, `generationKey`, `findIntelligence`, all family/sub-family fallback logic, and `intelligence_ref` generation from `scripts/build-data.js`.
- Removed BenchLM scripts and provenance from `package.json`, tooltips, chart labels, the static footer, and README pipeline documentation.
- Added the native `--env-file=.env` pricing/benchmark command path and the fail-closed benchmark capture contract.

## 5. Spot checks

Each generated value below exactly equals the matching raw entry identified by `model_permaslug`; no score was transformed.

| Role | OpenRouter ID | Raw `intelligence_index` → output | Raw `coding_index` → output | Raw `agentic_index` → output |
|---|---|---|---|---|
| Frontier | `google/gemini-2.5-pro` | 25.9 → 25.9 | 33.3 → 33.3 | 7.2 → 7.2 |
| Mid | `mistralai/mistral-small-2603` | 19.7 → 19.7 | 26.6 → 26.6 | 4.6 → 4.6 |
| Obscure | `mistralai/ministral-3b-2512` | 7.1 → 7.1 | 4.8 → 4.8 | 1.6 → 1.6 |

The raw source for all three spot checks was `artificial-analysis` inside the OpenRouter response.

## 6. Known issues

- **Coverage gate fails:** 19/213 (8.92%) is substantially below D12's 60% fallback threshold. Exact matching is working as designed, but the current benchmark ID set has weak overlap with the paid, allowlisted catalog.
- **Duplicate raw IDs:** 187 `model_permaslug` values occur more than once because the endpoint combines heterogeneous sources. The builder indexes the first entry with a non-null `intelligence_index` for each exact ID and ignores later unscored entries, preventing an arena-only duplicate from erasing the source's index. This preserves a verbatim raw benchmark value, but source-selection policy should be revisited if multiple score-bearing entries ever disagree.
- **Indexes without priced catalog overlap:** 92 score-bearing benchmark entries were absent from the current priced catalog capture, including `anthropic/claude-opus-5-20260723`, `openai/gpt-5.6-sol-20260709`, and `x-ai/grok-4.6-20260810`.
- **No silent degradation:** benchmark capture errors intentionally halt the build. Whether a total-source outage should use stale data is a product decision and remains unimplemented.
