# B12 report: Artificial Analysis intelligence + catalog variant collapse

## 1. AA probe result

`npm run data` captured **624 models across four pages**, with **611** records carrying `artificial_analysis_intelligence_index`. The capture timestamp was `2026-08-30T17:06:09.001Z`; the reported intelligence-index version was `4.1`.

The first model is retained verbatim in `public/aa-raw.json` (shown here only formatted):

```json
{
  "id": "0081ab31-d10a-44a0-a10d-eee5533fec65",
  "name": "GLM-4.5V (Non-reasoning)",
  "slug": "glm-4-5v",
  "release_date": "2025-08-11",
  "model_creator": {
    "id": "67437eb6-7dc1-4e93-befd-22c8b8ec2065",
    "name": "Z AI"
  },
  "evaluations": {
    "artificial_analysis_intelligence_index": 6.8,
    "artificial_analysis_coding_index": null,
    "artificial_analysis_agentic_index": null
  },
  "artificial_analysis_intelligence_index_cost": null,
  "pricing": {
    "price_1m_input_tokens": 0.6,
    "price_1m_output_tokens": 1.8,
    "price_1m_cache_hit_tokens": null,
    "price_1m_cache_write_tokens": null
  },
  "performance": {
    "median_output_tokens_per_second": 79.14,
    "median_time_to_first_token_seconds": 1.82,
    "median_time_to_first_answer_token_seconds": 1.82,
    "median_end_to_end_response_time_seconds": 8.14
  }
}
```

## 2. Collapse audit

| Variant | Base | Trigger phrase |
|---|---|---|
| `openai/gpt-5.6-luna-pro` | `openai/gpt-5.6-luna` | `same underlying model as` |
| `openai/gpt-5.6-terra-pro` | `openai/gpt-5.6-terra` | `same underlying model as` |
| `openai/gpt-5.6-sol-pro` | `openai/gpt-5.6-sol` | `same underlying model as` |

All three merges appear in the build console and `models.json` audit. Legacy `o1-pro`, `gpt-5-pro`, `gpt-5.2-pro`, `gpt-5.4-pro`, and `gpt-5.5-pro`, plus `gpt-5.2-chat`, remain separate rows.

The three expected Claude Fast candidates were *not* merged. Each description confirms identical capabilities and links the sibling, but the current OpenRouter catalog reports a different `supported_parameters` set than the base. D4's material-difference guard therefore conservatively retained `claude-opus-5-fast`, `claude-opus-4.8-fast`, and `claude-opus-4.7-fast`; this is explicit in `audit.non_collapses`, not a silent omission.

## 3. Join coverage

The post-collapse catalog has **210** models. **125** have intelligence: **59.52%** coverage.

| Resolution | Count |
|---|---:|
| Exact normalized-base matches | 124 |
| Effort-median matches | 1 |
| Normalization collisions | 0 |
| Misses | 85 |

Misses by family:

| Family | Unscored IDs |
|---|---|
| claude | `anthropic/claude-opus-5-fast`, `anthropic/claude-opus-4.8-fast`, `anthropic/claude-opus-4.7-fast`, `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-4.5`, `anthropic/claude-opus-4.1`, `anthropic/claude-opus-4`, `anthropic/claude-sonnet-4` |
| codestral | `mistralai/codestral-2508` |
| deepseek | `deepseek/deepseek-v3.2-exp`, `deepseek/deepseek-chat-v3.1`, `deepseek/deepseek-chat-v3-0324`, `deepseek/deepseek-chat` |
| gemini | `google/gemini-3.1-flash-lite`, `google/gemini-3.1-pro-preview-customtools`, `google/gemini-3-flash-preview`, `google/gemini-2.5-pro-preview`, `google/gemini-2.5-pro-preview-05-06` |
| gemma | `google/gemma-4-26b-a4b-it`, `google/gemma-4-31b-it`, `google/gemma-3-4b-it`, `google/gemma-3-12b-it`, `google/gemma-3-27b-it`, `google/gemma-2-27b-it` |
| gpt | `openai/gpt-chat-latest`, `openai/gpt-5.5-pro`, `openai/gpt-5.4-pro`, `openai/gpt-5.2-chat`, `openai/gpt-5.2-pro`, `openai/gpt-5.1-codex-max`, `openai/gpt-5-pro`, `openai/o4-mini-high`, `openai/gpt-4o-2024-11-20`, `openai/gpt-4o-mini-2024-07-18`, `openai/gpt-4-turbo-preview`, `openai/gpt-3.5-turbo-instruct`, `openai/gpt-3.5-turbo-16k` |
| granite | `ibm-granite/granite-4.0-h-micro` |
| grok | `x-ai/grok-4.20-multi-agent` |
| kat-coder | `kwaipilot/kat-coder-air-v2.5`, `kwaipilot/kat-coder-pro-v2.5` |
| llama | `meta-llama/llama-3.3-70b-instruct`, `meta-llama/llama-3.2-1b-instruct`, `meta-llama/llama-3.2-3b-instruct`, `meta-llama/llama-3.1-70b-instruct`, `meta-llama/llama-3.1-8b-instruct` |
| minimax | `minimax/minimax-m2-her`, `minimax/minimax-m1`, `minimax/minimax-01` |
| mistral | `mistralai/ministral-14b-2512`, `mistralai/ministral-8b-2512`, `mistralai/ministral-3b-2512`, `mistralai/mistral-small-3.2-24b-instruct`, `mistralai/mistral-small-3.1-24b-instruct`, `mistralai/mistral-small-24b-instruct-2501`, `mistralai/mistral-nemo`, `mistralai/mixtral-8x22b-instruct` |
| morph | `morph/morph-v3-large`, `morph/morph-v3-fast` |
| poolside | `poolside/laguna-s-2.1`, `poolside/laguna-xs-2.1` |
| qwen | `qwen/qwen3.8-flash`, `qwen/qwen3.7-flash`, `qwen/qwen3.5-plus-20260420`, `qwen/qwen3.6-flash`, `qwen/qwen3.6-max-preview`, `qwen/qwen3.5-flash-02-23`, `qwen/qwen3.5-plus-02-15`, `qwen/qwen3-coder-plus`, `qwen/qwen3-coder-flash`, `qwen/qwen3-next-80b-a3b-thinking`, `qwen/qwen-plus-2025-07-28`, `qwen/qwen3-30b-a3b-thinking-2507`, `qwen/qwen3-235b-a22b-thinking-2507`, `qwen/qwen3-coder`, `qwen/qwen3-235b-a22b-2507`, `qwen/qwen3-30b-a3b`, `qwen/qwen3-8b`, `qwen/qwen3-14b`, `qwen/qwen3-32b`, `qwen/qwen3-235b-a22b`, `qwen/qwen-plus`, `qwen/qwen-2.5-7b-instruct` |
| relace | `relace/relace-apply-3` |
| seed-code | `bytedance-seed/seed-2.0-code` |

## 4. Luna acceptance check

```text
openai/gpt-5.6-luna  intelligence = 52.3
openai/gpt-5.6-sol   intelligence = 60.9
openai/gpt-5.6-luna-pro present = false
```

Luna's generated record carries its own AA `coding_index` (71.4) and `agentic_index` (46.9), not Sol's values.

## 5. Effort ambiguity

| Model | Intelligence | Component scores |
|---|---:|---|
| `mistralai/devstral-2512` | 12.4 | `[12.4]` |

This row has `intelligence_scope: "effort-median"` and its tooltip visibly says “effort-variant median.” No generated record silently selects a maximum, minimum, or first effort score.

## 6. Verification

`npm test` covers the AA fetcher's four failure states and pagination, capture validation, verbatim values, catalog preservation, collapse/one-hop/unresolvable/protected checks, catalog-only date stripping, base-over-effort, effort median, and collision refusal. The final run reports **35 passing tests, 0 failures**.

`npm run build` completed successfully: it refreshed the full AA capture, rebuilt `models.json`, produced the Vite bundle, and the local app rendered 210 tracked models with visible Artificial Analysis attribution and no browser console warnings or errors.

## 7. Known issues

- **The 60% coverage gate does not pass:** 125/210 = **59.52%**. This is reported honestly rather than widened with fuzzy matching.
- The Claude Fast variants remain separate because their `supported_parameters` differ from their linked bases. Relaxing that guard would contradict the task's explicit material-difference requirement; it needs a new decision if product policy should treat those API-surface differences as speed-mode-only.
