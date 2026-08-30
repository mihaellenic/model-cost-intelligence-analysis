# OpenRouter Model Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenRouter's paid canonical catalog the source of truth for coding-model discovery and produce a safe, UI-compatible `public/models.json`.

**Architecture:** An ordered JSON allowlist is the coding-relevance gate. A new dependency-free metadata module owns model selection, param extraction, and tier derivation; the builder composes that module with OpenRouter pricing and existing conservative BenchLM matching. The UI consumes the existing field names, with nullable parameter counts rendered explicitly.

**Tech Stack:** Node.js ESM, built-in `node:test`, Vite, Chart.js.

**Spec:** `docs/superpowers/specs/2026-08-29-openrouter-model-discovery-design.md`

## Global Constraints

- Data integrity over coverage: no guessed prices, parameter counts, model-family matches, or benchmark scores.
- The allowlist is the sole coding-relevance gate; exclude image, audio, vision-only, embedding, safety, routing, and free variants.
- Preserve existing generation-safe, exact-size-token, tier-negative intelligence matching behavior.
- Do not modify `src/lib/quadrants.js`.
- Keep output field names stable except remove `size_gb` and `ollama_available`.
- A `null` `params_b` means undisclosed; it must not be converted into a numeric proxy.

---

## File structure

- Create `scripts/family-allowlist.json`: ordered coding-family prefix rules and their exclusions.
- Create `scripts/lib/derive-metadata.js`: pure selection and metadata derivation functions.
- Create `test/derive-metadata.test.js`: node:test coverage of the new pure API.
- Modify `scripts/build-data.js`: OpenRouter direct pipeline and normalized intelligence patterns.
- Modify `package.json`: remove Ollama from data scripts and enable Node tests.
- Delete `scripts/fetch-ollama.js`: dead source removed by the pipeline migration.
- Modify `src/lib/filters.js`: normalized color map plus deterministic fallback and unknown-size filtering.
- Modify `src/charts/scatter.js`: closed-model bubble size and tooltip behavior.

### Task 1: Define and test the pure curation/metadata boundary

**Files:**
- Create: `scripts/family-allowlist.json`
- Create: `scripts/lib/derive-metadata.js`
- Create: `test/derive-metadata.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: an OpenRouter model `{ id, name, prompt_per_1m, completion_per_1m }` and allowlist records `{ prefix, family, exclude?: string[], ambiguous?: boolean }`.
- Produces: `matchAllowlist(model, rules)`, `deriveParamsB(model)`, `deriveTier(paramsB)`, `deriveMetadata(model, rule)`, and `isPaidCanonicalModel(model)`.

- [ ] **Step 1: Add a Node test command and write the failing pure-function tests.**

Add `"test": "node --test"` to `package.json`, then create these tests:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveParamsB, deriveTier, isPaidCanonicalModel, matchAllowlist,
} from '../scripts/lib/derive-metadata.js';

const rules = [
  { prefix: 'google/gemini-', family: 'gemini', exclude: ['image'] },
  { prefix: 'qwen/qwen', family: 'qwen', exclude: ['-vl-'] },
];

test('matches a coding family and rejects an excluded modality', () => {
  assert.equal(matchAllowlist({ id: 'google/gemini-2.5-pro' }, rules)?.family, 'gemini');
  assert.equal(matchAllowlist({ id: 'google/gemini-3-pro-image' }, rules), null);
  assert.equal(matchAllowlist({ id: 'google/gemini-2.5-pro:free' }, rules), null);
});

test('derives only explicit total parameter tokens', () => {
  assert.equal(deriveParamsB({ name: 'Qwen3 235B A22B', id: 'qwen/qwen3-235b-a22b' }), 235);
  assert.equal(deriveParamsB({ name: 'Claude Sonnet 4.5', id: 'anthropic/claude-sonnet-4.5' }), null);
});

test('assigns tiers including undisclosed cloud models', () => {
  assert.equal(deriveTier(3), 'tiny');
  assert.equal(deriveTier(35), 'large');
  assert.equal(deriveTier(null), 'cloud');
});

test('rejects provider variants and zero-cost records as price bases', () => {
  assert.equal(isPaidCanonicalModel({ id: 'qwen/qwen3-8b:free', prompt_per_1m: 0, completion_per_1m: 0 }), false);
  assert.equal(isPaidCanonicalModel({ id: 'qwen/qwen3-8b', prompt_per_1m: 0.1, completion_per_1m: 0.2 }), true);
});
```

- [ ] **Step 2: Run the test command and verify the expected module-not-found failure.**

Run: `npm test -- test/derive-metadata.test.js`

Expected: FAIL because `scripts/lib/derive-metadata.js` does not exist.

- [ ] **Step 3: Create the production API and initial allowlist.**

Write `scripts/lib/derive-metadata.js` with these exact exports:

```js
const PARAMS_B = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*b(?:\b|[-_])/i;

export function isPaidCanonicalModel(model) {
  if (model.id.includes(':')) return false;
  const average = (model.prompt_per_1m + model.completion_per_1m) / 2;
  return Number.isFinite(average) && average > 0;
}

export function matchAllowlist(model, rules) {
  const id = model.id.toLowerCase();
  if (id.includes(':')) return null;
  for (const rule of rules) {
    if (!id.startsWith(rule.prefix)) continue;
    if ((rule.exclude || []).some((pattern) => id.includes(pattern))) return null;
    return rule;
  }
  return null;
}

export function deriveParamsB({ name = '', id = '' }) {
  for (const value of [name, id]) {
    const match = value.match(PARAMS_B);
    if (match) return Number(match[1]);
  }
  return null;
}

export function deriveTier(paramsB) {
  if (paramsB == null) return 'cloud';
  if (paramsB <= 3) return 'tiny';
  if (paramsB <= 7) return 'small';
  if (paramsB <= 14) return 'medium';
  if (paramsB <= 35) return 'large';
  return 'xl';
}

export function deriveMetadata(model, rule) {
  const params_b = deriveParamsB(model);
  return { family: rule.family, params_b, tier: deriveTier(params_b) };
}
```

Add the 25 ordered rules from the approved design document. Place narrower rules before broad provider rules: `gpt-oss` before `gpt`, and dedicated Mistral coding rules before `mistral`.

- [ ] **Step 4: Run the focused tests and verify they pass.**

Run: `npm test -- test/derive-metadata.test.js`

Expected: four passing tests with no failures.

### Task 2: Replace the builder with direct OpenRouter discovery

**Files:**
- Modify: `scripts/build-data.js`
- Modify: `package.json`
- Delete: `scripts/fetch-ollama.js`

**Interfaces:**
- Consumes: `public/pricing-raw.json`, `public/intelligence-raw.json`, `scripts/family-allowlist.json`, and exports from `scripts/lib/derive-metadata.js`.
- Produces: `public/models.json` records with context length and no Ollama-only fields.

- [ ] **Step 1: Write a failing end-to-end fixture test for the builder selection contract.**

Extend `test/derive-metadata.test.js` to pass the fixture records below through the pure functions used by the builder:

```js
const free = { id: 'qwen/qwen3-8b:free', name: 'Qwen3 8B (free)', prompt_per_1m: 0, completion_per_1m: 0 };
const image = { id: 'google/gemini-3-pro-image', name: 'Gemini 3 Pro Image', prompt_per_1m: 2, completion_per_1m: 12 };
const paid = { id: 'qwen/qwen3-8b', name: 'Qwen3 8B', prompt_per_1m: 0.1, completion_per_1m: 0.4 };

assert.equal(isPaidCanonicalModel(free), false);
assert.equal(matchAllowlist(image, loadedRules), null);
assert.equal(deriveMetadata(paid, matchAllowlist(paid, loadedRules)).params_b, 8);
```

- [ ] **Step 2: Run the focused test and confirm it fails until the real allowlist is loaded.**

Run: `npm test -- test/derive-metadata.test.js`

Expected: FAIL because the test fixture has not yet loaded `family-allowlist.json`.

- [ ] **Step 3: Rewrite builder inputs and selection.**

Replace curated-list/Ollama reads with:

```js
import { deriveMetadata, isPaidCanonicalModel, matchAllowlist } from './lib/derive-metadata.js';

const ALLOWLIST = JSON.parse(readFileSync(resolve(ROOT, 'scripts/family-allowlist.json'), 'utf8'));
const INTEL = safeRead(resolve(ROOT, 'public/intelligence-raw.json'));
const PRICE = safeRead(resolve(ROOT, 'public/pricing-raw.json'));
const intelScores = INTEL?.scores || [];
const priceList = PRICE?.models || [];

const selected = priceList
  .filter(isPaidCanonicalModel)
  .map((model) => ({ model, rule: matchAllowlist(model, ALLOWLIST) }))
  .filter(({ rule }) => rule != null);
```

Remove `PricingMap`, `findPricing`, all Ollama code, and every curated-list reference. Build from each selected direct catalog model. Use `context: model.context ?? null` as `context_length`; the current price records already contain the model's prompt/completion pricing. Set `cheapest_provider` to the canonical record and `providers` to an array containing that same record. Round the direct average to four decimals.

Update `FAMILY_PATTERNS` for normalized families only and keep existing matching mechanics intact. Include normalized patterns for `claude`, `gpt`, `gemini`, `deepseek`, `qwen`, `codestral`, `devstral`, `mistral`, `llama`, `gemma`, `phi`, `granite`, `glm`, `kimi`, `minimax`, `seed-code`, `kat-coder`, `relace`, `morph`, `poolside`, and `grok`. Patterns must reject a different generation before family fallback; use the selected model name/ID generation token to establish the pattern when a family has several generations.

- [ ] **Step 4: Remove Ollama commands and script.**

Set package scripts to:

```json
"data": "node scripts/fetch-intelligence.js && node scripts/fetch-pricing.js && node scripts/build-data.js",
"data:intelligence": "node scripts/fetch-intelligence.js",
"data:pricing": "node scripts/fetch-pricing.js"
```

Delete `scripts/fetch-ollama.js`. Do not retain `data:ollama`.

- [ ] **Step 5: Run tests, generate data, and inspect integrity assertions.**

Run:

```bash
npm test
npm run data
node --input-type=module - <<'EOF'
import { readFileSync } from 'node:fs';
const { models } = JSON.parse(readFileSync('public/models.json', 'utf8'));
const blocked = /(?:image|audio|\bvl\b|embedding|safety|:free)/i;
console.log({
  models: models.length,
  badNames: models.filter((m) => blocked.test(`${m.id} ${m.name}`)).map((m) => m.id),
  invalidPrices: models.filter((m) => m.cost_per_1m_avg == null || m.cost_per_1m_avg <= 0).map((m) => m.id),
  plottable: models.filter((m) => m.intelligence != null && m.cost_per_1m_avg != null).length,
});
EOF
```

Expected: tests pass; zero blocked IDs and invalid price IDs; plottable count is at least 25 or the shortfall is reported with benchmark-coverage evidence.

### Task 3: Make the UI safe for undisclosed parameters and normalized families

**Files:**
- Modify: `src/lib/filters.js`
- Modify: `src/charts/scatter.js`

**Interfaces:**
- Consumes: nullable `model.params_b` and newly normalized `model.family` values.
- Produces: stable color assignment, no unknown-size filtering error, and readable scatter points/tooltips.

- [ ] **Step 1: Write failing focused tests for deterministic colors and nullable filtering.**

Create `test/filters.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, colorFor } from '../src/lib/filters.js';

test('uses a stable fallback color for an allowlisted future family', () => {
  assert.equal(colorFor('future-code-family'), colorFor('future-code-family'));
});

test('does not hide models with undisclosed parameters at a size limit', () => {
  const models = [{ family: 'claude', params_b: null }, { family: 'qwen', params_b: 32 }];
  assert.deepEqual(applyFilters(models, { families: new Set(), maxParamsB: 14, withIntel: false, withPrice: false }), [models[0]]);
});
```

- [ ] **Step 2: Run the filter tests and confirm failure.**

Run: `npm test -- test/filters.test.js`

Expected: the nullable filtering assertion fails because the existing numeric comparison includes the `null` record incorrectly.

- [ ] **Step 3: Add colors and nullable behavior.**

Replace the old generation-specific map with explicit colors for all initial normalized families. Update `colorFor` to calculate a deterministic HSL color from the family string when no explicit color exists:

```js
export function colorFor(family) {
  if (FAMILY_COLORS[family]) return FAMILY_COLORS[family];
  let hash = 0;
  for (const char of family) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return `hsl(${Math.abs(hash) % 360} 70% 62%)`;
}
```

Change the size condition to `if (maxParamsB && m.params_b != null && m.params_b > maxParamsB) return false;`.

In `scatter.js`, set `r: m.params_b == null ? 10 : Math.max(5, Math.min(22, Math.sqrt(m.params_b) * 1.3))` and render `Params: ${m.params_b == null ? 'undisclosed' : `${m.params_b}B`} · Family: ${m.family}`.

- [ ] **Step 4: Run all tests and the production build.**

Run:

```bash
npm test
npm run build
```

Expected: all Node tests pass and Vite produces `dist/` with exit code 0.

### Task 4: Verify generated coverage and browser rendering

**Files:**
- Verify only: `public/models.json`, `dist/`

**Interfaces:**
- Consumes: the generated output from Tasks 1–3.
- Produces: final B3 counts and a documented known-issues report.

- [ ] **Step 1: Compute all requested counts from fresh output.**

Run:

```bash
node --input-type=module - <<'EOF'
import { readFileSync } from 'node:fs';
const { models } = JSON.parse(readFileSync('public/models.json', 'utf8'));
const byFamily = Object.fromEntries([...new Set(models.map((m) => m.family))].sort().map((family) => [family, models.filter((m) => m.family === family).length]));
console.log(JSON.stringify({
  total: models.length,
  withIntelligence: models.filter((m) => m.intelligence != null).length,
  withPricing: models.filter((m) => m.cost_per_1m_avg != null).length,
  plottable: models.filter((m) => m.intelligence != null && m.cost_per_1m_avg != null).length,
  byFamily,
}, null, 2));
EOF
```

- [ ] **Step 2: Smoke-test the dev server.**

Run `npm run dev -- --host 127.0.0.1`, load the served page, and confirm the browser console has no errors and the scatter includes closed models with default-sized bubbles and undisclosed parameter tooltips.

- [ ] **Step 3: Report the final B3 handoff.**

Report the shipped allowlist with justifications, removed/added architecture, exact metadata rules and examples, fresh counts, family breakdown, B1 coverage assessment, B4 test surface, and known benchmark/derivation/UI gaps. State evidence only from the fresh commands above.
