# B3 report: OpenRouter coding-model discovery

Generated on 2026-08-30 from a fresh `npm run data` run. The deliverable is
the working pipeline and its generated [`public/models.json`](../../public/models.json);
this report is the review handoff.

## 1. Family allowlist

[`scripts/family-allowlist.json`](../../scripts/family-allowlist.json) is an
ordered, 27-rule coding-relevance gate. A catalog model is included only when
its canonical OpenRouter ID matches one of these prefixes and does not match a
rule-specific exclusion. `ambiguous: true` identifies general-purpose model
families that are legitimate coding candidates but not code-only.

| Prefix | Output family | Coding relevance / exclusion |
|---|---|---|
| `anthropic/claude-` | `claude` | Frontier coding-agent family. |
| `openai/gpt-oss-` | `gpt-oss` | Open-weight coding family; excludes safeguard. |
| `openai/gpt-` | `gpt` | GPT coding candidates; excludes image and audio. |
| `openai/o1` | `gpt` | OpenAI reasoning model line. |
| `openai/o3` | `gpt` | OpenAI reasoning model line. |
| `openai/o4` | `gpt` | OpenAI reasoning model line. |
| `google/gemini-` | `gemini` | Frontier coding candidates; excludes image variants. |
| `deepseek/deepseek-` | `deepseek` | Coding/reasoning series; excludes vision. |
| `qwen/qwen` | `qwen` | Qwen and Qwen Coder; excludes VL. |
| `mistralai/codestral-` | `codestral` | Dedicated code model. |
| `mistralai/devstral-` | `devstral` | Dedicated coding-agent model. |
| `mistralai/mistral-` | `mistral` | General-purpose Mistral coding candidates. |
| `mistralai/ministral-` | `mistral` | Smaller Mistral instruction models. |
| `mistralai/mixtral-` | `mistral` | Open-weight Mistral coding candidates. |
| `meta-llama/llama-` | `llama` | Llama instruction models; excludes guard models. |
| `google/gemma-` | `gemma` | Open-weight instruction models. |
| `microsoft/phi-` | `phi` | Small coding-capable instruction models. |
| `ibm-granite/granite-` | `granite` | Granite instruction/code family. |
| `z-ai/glm-` | `glm` | GLM coding/reasoning family; excludes known vision IDs. |
| `moonshotai/kimi-` | `kimi` | Kimi code and reasoning candidates. |
| `minimax/minimax-` | `minimax` | MiniMax code and reasoning candidates. |
| `bytedance-seed/seed-2.0-code` | `seed-code` | Explicit code model only. |
| `kwaipilot/kat-coder-` | `kat-coder` | Explicit coding-model family. |
| `relace/relace-apply-` | `relace` | Dedicated code-editing model only. |
| `morph/morph-` | `morph` | Coding-agent editing models. |
| `poolside/laguna-` | `poolside` | Poolside coding-model family. |
| `x-ai/grok-` | `grok` | General-purpose coding candidates; excludes experimental Grok Build. |

The current live catalog did not contain separate CodeLlama or StarCoder
entries, so no speculative prefixes were added for them.

## 2. Architecture changes

Removed:

- `scripts/fetch-ollama.js`, `scripts/curated-list.json`, and the obsolete
  generated `public/ollama-raw.json`.
- Ollama collection and `ollama_available` from the pipeline/output/UI.
- `PricingMap` and `findPricing()` from `scripts/build-data.js`.
- `size_gb` from `public/models.json` and UI-facing records.

Added:

- `scripts/family-allowlist.json` as the human-audited coding boundary.
- `scripts/lib/derive-metadata.js` for pure selection and metadata derivation.
- A direct OpenRouter builder: canonical paid catalog entries supply ID, name,
  price, provider, and context length without a hand-maintained ID bridge.
- Normalized BenchLM family patterns plus a generation key check, retaining the
  existing exact-size, tier-negative, and family-fallback integrity rules.
- `node:test` coverage, normalized family colors, a deterministic future-family
  color fallback, and nullable-parameter scatter handling.

`npm run data` now runs only `fetch-intelligence`, `fetch-pricing`, and
`build-data`.

## 3. Metadata derivation rules

[`scripts/lib/derive-metadata.js`](../../scripts/lib/derive-metadata.js)
matches an allowlist rule by a lower-cased ID prefix, rejects every colon
variant before matching, and rejects a matched rule if its ID contains an
excluded modality token.

`params_b` scans the model name first and then its ID using:

```js
/(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*([bt])(?:\b|[-_])/i
```

`B` is returned directly; an explicit `T` total is multiplied by 1,000. The
leading non-alphanumeric boundary prevents an MoE active-parameter suffix such
as `A95B` from being mistaken for the total. Names such as `Mini`, `Pro`,
`Opus`, and `Flash` do not imply a count and return `null`.

Tiers are: `tiny` `<=3`, `small` `<=7`, `medium` `<=14`, `large` `<=35`,
`xl` `>35`, and `cloud` for `null`.

| OpenRouter model | Family | `params_b` | Tier |
|---|---:|---:|---|
| `qwen/qwen3-8b` | `qwen` | 8 | `medium` |
| `qwen/qwen3.8-2.4t-a95b` | `qwen` | 2400 | `xl` |
| `openai/gpt-5.4-mini` | `gpt` | `null` | `cloud` |
| `anthropic/claude-sonnet-4.6` | `claude` | `null` | `cloud` |

## 4. Final counts

Fresh `npm run data` output:

- Total tracked: **213**
- With intelligence: **94**
- With pricing: **213**
- Plottable (both): **94**

Family breakdown:

| Family | Models | Family | Models |
|---|---:|---|---:|
| claude | 17 | codestral | 1 |
| deepseek | 13 | devstral | 1 |
| gemini | 14 | gemma | 6 |
| glm | 11 | gpt | 50 |
| gpt-oss | 2 | granite | 2 |
| grok | 5 | kat-coder | 3 |
| kimi | 7 | llama | 7 |
| minimax | 8 | mistral | 16 |
| morph | 2 | phi | 1 |
| poolside | 2 | qwen | 43 |
| relace | 1 | seed-code | 1 |

Integrity checks over the fresh output found zero image/audio/VL/embedding/
safety/free IDs, zero nonpositive cost bases, and zero records containing
either removed field. The generator summary was:

```text
[build-data] 213 models, 94 with intelligence, 213 with pricing
```

## 5. B1 coverage note

The plottable set spans both dimensions: the median cost is **$1.55 / 1M** and
the median intelligence is **57.58**. All four quadrants contain candidates:
Sweet spot 16, Premium 31, Budget 32, and Avoid 15—there are no empty
quadrants. Planning candidates are well represented by Claude (17), GPT plus
GPT-OSS (52), Gemini (14), and DeepSeek (13); execution/budget candidates are
also broad, particularly Qwen (43), Mistral (16), GLM (11), MiniMax (8), and
smaller Gemma/Phi/Llama entries. This is materially broader than the B3 floor
of 25 plottable models and is sufficient input coverage for B1's pair
recommendation.

## 6. B4 test surface report

Pure functions in `scripts/lib/derive-metadata.js`:

| Function | Inputs to cover | Expected output/behavior |
|---|---|---|
| `matchAllowlist(model, rules)` | Matching ID, excluded modality, `:free`/`:batch`, unmatched prefix, rule order | Matched rule or `null`; never allow a provider variant. |
| `isPaidCanonicalModel(model)` | Paid canonical pricing, zero average, missing/invalid prices, colon variants | Boolean; only a finite positive-average canonical record passes. |
| `deriveParamsB(model)` | B totals, T totals, name-vs-ID fallback, MoE `A…B`, no disclosed count | Numeric total in billions or `null`; active MoE counts are ignored. |
| `deriveTier(paramsB)` | Every threshold boundary and `null` | The documented tier string. |
| `deriveMetadata(model, rule)` | A matched rule with disclosed/undisclosed sizes | `{ family, params_b, tier }`. |

Also test `build-data.js` generation matching with representative same-family
different-generation pairs, tie/fallback cases, and absent BenchLM coverage;
this protects D4's generation-safe intelligence rule. UI unit tests now cover
`colorFor`, `applyFilters`, `bubbleRadius`, and `formatParams`.

## 7. Known issues

- 119 tracked models have no safe BenchLM match. This is intentional missing
  coverage rather than a guessed intelligence score; sparse or unavailable
  benchmark families include several dedicated editor families.
- Parameter counts are `null` whenever OpenRouter's ID/name does not disclose
  an explicit total. Some open-weight models may therefore render as `cloud`;
  this is safer than inferring a size from marketing labels.
- The allowlist labels broad general-purpose families as `ambiguous` in source
  curation. That flag is not exposed in the stable output shape, so a future
  UX pass could surface it to users.
- The new nullable `params_b` correctly renders in filters and scatter, but
  existing `computePicks()` uses `m.params_b <= 7`; JavaScript treats `null <=
  7` as true, so the existing “Best small” pick can select a closed model. B3
  explicitly says not to change pick logic, so this is documented rather than
  changed in this task.
- `npm run dev -- --host 127.0.0.1` started a second server on port 5174
  because the earlier verified Vite server still occupied port 5173. The page
  at 5174 showed 213 tracked models, the scatter and family filters, and no
  browser console warnings or errors.

## Verification performed

- `npm test`: 9 passing tests, 0 failures.
- `npm run data`: fresh BenchLM and OpenRouter fetch followed by a 213-model
  generated output.
- `npm run dev -- --host 127.0.0.1`: local UI loaded successfully; scatter,
  normalized family filters, and console state were verified.
