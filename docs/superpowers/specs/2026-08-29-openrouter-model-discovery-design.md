# OpenRouter Model Discovery Design

## Goal

Make OpenRouter's model catalog the source of truth for coding-model discovery
while preserving the product's data-integrity rule: uncertain data is omitted,
never invented.

## Inputs and output

`fetch-pricing.js` remains the single OpenRouter fetcher and writes the priced
catalog to `public/pricing-raw.json`. `fetch-intelligence.js` remains
unchanged. `build-data.js` will read both files plus a new
`scripts/family-allowlist.json`, then write `public/models.json`.

Each output record will contain: `id`, `name`, `family`, `params_b`, `tier`,
`intelligence`, `intelligence_source`, `intelligence_scope`,
`intelligence_ref`, `cost_per_1m_avg`, `cheapest_provider`, `providers`, and
`context_length`. `params_b` may be `null`. `size_gb` and
`ollama_available` will not be written.

## Curation boundary

The allowlist is an ordered array of prefix rules. A rule declares a stable
provider/model prefix, the normalized family emitted to the UI, whether it is
an ambiguous general-purpose coding candidate, and case-insensitive exclusion
patterns. The first matching rule wins. Exclusions make a prefix rule reject a
model before it reaches the output. A model must be a non-variant canonical
OpenRouter ID and match an allowlist rule to be included.

The initial catalog-backed rules are:

| Prefix | Family | Rationale / exclusions |
|---|---|---|
| `anthropic/claude-` | `claude` | Frontier coding-agent family. |
| `openai/gpt-oss-` | `gpt-oss` | Open-weight coding-capable GPT family. |
| `openai/gpt-` | `gpt` | Frontier general/coding models; exclude image and audio variants. |
| `openai/o` | `gpt` | OpenAI reasoning series used for coding; match numeric o-series IDs only. |
| `google/gemini-` | `gemini` | Frontier coding family; exclude image-only variants. |
| `deepseek/deepseek-` | `deepseek` | V3/R1 and newer coding/reasoning families; exclude vision variants. |
| `qwen/qwen` | `qwen` | Qwen and Qwen Coder families; exclude VL variants. |
| `mistralai/codestral-` | `codestral` | Dedicated code model. |
| `mistralai/devstral-` | `devstral` | Dedicated agentic coding model. |
| `mistralai/mistral-` | `mistral` | Mistral general models used for coding. |
| `mistralai/ministral-` | `mistral` | Small Mistral coding-capable models. |
| `mistralai/mixtral-` | `mistral` | Open-weight Mistral coding-capable models. |
| `meta-llama/llama-` | `llama` | Llama instruct models; exclude guard/safety variants. |
| `google/gemma-` | `gemma` | Open-weight Google instruction models. |
| `microsoft/phi-` | `phi` | Microsoft Phi coding-capable small models. |
| `ibm-granite/granite-` | `granite` | IBM Granite instruction/code models. |
| `z-ai/glm-` | `glm` | GLM coding/reasoning family; exclude V/vision variants. |
| `moonshotai/kimi-` | `kimi` | Kimi coding/reasoning family. |
| `minimax/minimax-` | `minimax` | MiniMax coding/reasoning family. |
| `bytedance-seed/seed-2.0-code` | `seed-code` | Explicit code model only. |
| `kwaipilot/kat-coder-` | `kat-coder` | Dedicated coding model. |
| `relace/relace-apply-` | `relace` | Dedicated code-editing model; exclude search. |
| `morph/morph-` | `morph` | Coding-agent-oriented editing models. |
| `poolside/laguna-` | `poolside` | Coding model family. |
| `x-ai/grok-` | `grok` | Ambiguous general-purpose family included as a flagged coding candidate; exclude build-only experimental routing if it has no benchmark support. |

Rules deliberately omit routers, image/audio models, embeddings, translation,
search, safety, and vision-only families. Broad general-purpose coding
candidates are marked `ambiguous: true` in curation; this is retained as
allowlist documentation and does not alter the stable output schema.

## Pure metadata functions

`scripts/lib/derive-metadata.js` will export:

- `matchAllowlist(model, rules)`: returns the matching rule or `null`; rejects
  `:free`, `:batch`, and other provider variants before prefix matching and
  honours a rule's exclude patterns.
- `deriveParamsB({ id, name })`: returns a disclosed parameter count or
  `null`. It extracts an explicit number followed by `B` from the name first,
  then the ID. For mixture-of-experts labels (for example `235B-A22B`), it
  returns the first total-parameter token (`235`), never the active count.
  It never maps labels such as `mini`, `nano`, `small`, `large`, `opus`, or
  `pro` to a fabricated number.
- `deriveTier(paramsB)`: `tiny` for `<=3`, `small` for `<=7`, `medium` for
  `<=14`, `large` for `<=35`, `xl` above that, and `cloud` for `null`.
- `deriveMetadata(model, rule)`: produces `{ family, params_b, tier }`.
- `isPaidCanonicalModel(model)`: rejects every colon-suffixed variant and
  requires finite positive average prompt/completion pricing.

## Pipeline and pricing

The builder selects canonical paid catalog entries, matches them to the
allowlist, derives metadata, and takes price and context length directly from
that record. Therefore every priced output has a strictly positive cost and no
`:free` variant can establish `cheapest_provider`. The providers list contains
the canonical paid provider record only; there is no longer an ID bridge or a
cross-provider variant lookup.

Intelligence matching retains its existing generation-safe, exact-size-token,
tier-negative, and narrowly scoped family-fallback behavior. Its family
patterns will be expanded for the normalized families above. Unmatched or
ambiguous benchmark candidates still produce `null`, rather than a guessed
score.

## UI behavior

The parameter filter treats `null` as an unknown disclosed size and leaves
those models visible. Scatter bubbles use radius `10` when parameters are
unknown; tooltips show `Params: undisclosed`. Family colors add explicit colors
for the normalized families and compute a deterministic fallback color for any
future allowlisted family.

## Validation

Use `node:test` tests for each pure function before adding implementation.
Verify the red/green cycle for allowlist exclusions, canonical paid filtering,
known/unknown parameter parsing, and tier thresholds. End-to-end validation
runs `npm run data`, inspects the output for prohibited modalities and free
cost bases, reports counts by family plus plottable coverage, runs `npm run
build`, and loads the dev server for a scatter smoke check.

## Non-goals

This change does not modify quadrant math or recommendation logic. It does not
invent model parameter counts, benchmark scores, price mappings, or provider
aliases.
