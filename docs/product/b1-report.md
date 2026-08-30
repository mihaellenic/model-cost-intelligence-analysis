# B1 report: parameter removal and workflow pair recommendation

Fresh data run: `2026-08-30T14:51:34.846Z` (`npm run data`). The run produced 213 catalog models, of which 78 are plottable (both a finite intelligence score and a positive average cost).

## Pair algorithm

`src/lib/pair.js` uses only the plottable population. It computes quality floors with the same linear-interpolation percentile method used elsewhere in the product:

- Planning model: intelligence at or above the 75th percentile.
- Execution model: intelligence at or above the median.
- The two roles must have distinct model IDs.

The three visible raw task-mix inputs are normalized to shares summing to 1. For every valid ordered planning/execution assignment, the expected cost is:

```
planning_share × planning_cost
+ execution_share × execution_cost
+ verification_share × (model_based_verification ? execution_cost : 0)
```

Pairs sort by ascending expected cost, then descending combined intelligence, then planning and execution model names to keep otherwise identical results deterministic. If the input mix totals zero, the card asks for a mix above 0%. If filters leave no valid pair, it returns an honest empty state with the relevant planning/execution floor or the distinct-model constraint; it never relaxes a floor.

### Worked live example

With the default 65/30/5 mix and deterministic verification, the top pair is OpenAI: GPT-5.6 Luna for planning ($0.7000/1M) and Z.ai: GLM 5.3 Flash for execution ($0.1625/1M):

```
0.65 × 0.7000 + 0.30 × 0.1625 + 0.05 × 0 = $0.50375 / 1M workflow tokens
```

Switching on model-based verification adds `0.05 × $0.1625 = $0.008125`, for $0.511875/1M.

## Parameter removal

Removed:

- `deriveParamsB`, `deriveTier`, and `params_b`/`tier` output from `scripts/lib/derive-metadata.js` and the generated records.
- Parameter metadata from `scripts/build-data.js` output; `findIntelligence` was not modified.
- The max-size filter, variable scatter radius, scatter/bar parameter tooltip lines, and the Best small selection.
- The four single-model decision-pick cards; the pair card is now the primary output above the charts.
- Parameter-specific metadata/filter/scatter tests.
- README references to parameter counts, model tiers, local inference, variable marker size, and the former single-model picks. It now describes the OpenRouter source of truth, family allowlist, and pair recommendation.

`grep -rn "params_b\|size_gb\|ollama" src/ scripts/ public/models.json` returned no matches (exit 1, as expected for no matches).

The broader lowercase `tier` scan has two harmless substring matches in the unmodified allowlist rationales (`frontier`); they are not tier fields. The intentionally retained uppercase `TIER_NEGATIVE` benchmark-name safeguard is in `scripts/build-data.js:55` and used at line 104; it is intelligence-matching logic, not product metadata.

## Test coverage

`npm test` passes 9 tests. The new `test/pair.test.js` covers:

- p75 planning and median execution floor computation;
- distinct planning/execution model constraint;
- mix normalization and a mix-driven reranking;
- deterministic versus model-based verification cost;
- a hand-computed expected-cost value ($7.10 / $7.20);
- honest distinctness empty state without a relaxed floor.

## Current recommended pair

Default 65/30/5 mix, deterministic verification, current floors: planning p75 **71.43**, execution median **59.42**.

| Rank | Planning model | Execution model | Expected $/1M workflow tokens |
|---|---|---|---:|
| Recommended | OpenAI: GPT-5.6 Luna — gpt, 82.20 intelligence, $0.7000/1M | Z.ai: GLM 5.3 Flash — glm, 62.84 intelligence, $0.1625/1M | $0.50375 |
| Runner-up 1 | OpenAI: GPT-5.6 Luna Pro — gpt, 82.20 intelligence, $0.7000/1M | Z.ai: GLM 5.3 Flash — glm, 62.84 intelligence, $0.1625/1M | $0.50375 |
| Runner-up 2 | OpenAI: GPT-5.4 Nano — gpt, 73.56 intelligence, $0.7250/1M | Z.ai: GLM 5.3 Flash — glm, 62.84 intelligence, $0.1625/1M | $0.52000 |

Browser verification confirmed the card renders above the charts with the default mix. Changing the mix to 0/100/0 re-ranked planning to Anthropic: Claude Fable 5 while keeping Z.ai: GLM 5.3 Flash for execution; model-based verification changed the default card cost from $0.5037 to $0.5119 (the card displays four decimal places). Browser console contained no warnings or errors. The temporary Vite server was stopped after inspection.

## Known issues

- The first two live pairs are economically tied because GPT-5.6 Luna and GPT-5.6 Luna Pro are separate catalog models with the same current intelligence score and average cost. They remain separate results because the distinct-model rule operates on model identity, and the specified tie-break is deterministic rather than silently deduplicating model variants.
- Aggressive filters can leave no qualifying pair. The card names the binding quality floor where applicable; when the only qualifying models collide in both roles, it names the distinct-model constraint together with the floor values instead of relaxing either threshold.
