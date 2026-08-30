# B11 OpenRouter Benchmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BenchLM ingestion with a fail-closed OpenRouter benchmark capture and exact-ID intelligence join.

**Architecture:** `scripts/fetch-openrouter-benchmarks.js` owns authenticated capture and writes either one complete raw benchmark snapshot or one explicit error envelope. A small pure helper module validates that capture and resolves benchmark records by `model_permaslug`, allowing `build-data.js` to produce model records without any name-based intelligence matching.

**Tech Stack:** Node.js 20+ ESM, native `fetch`, native `--env-file`, Node built-in test runner, Vite, Chart.js.

**Spec:** `docs/product/b11-task-brief.md`

## Global Constraints

- Do not read, log, print, hardcode, or commit `OPENROUTER_API_KEY`; it is provided only by `.env` through Node's native `--env-file`.
- Keep fetching build-time only; the browser reads only generated `models.json`.
- Use the live API's observed entry fields verbatim: `model_permaslug`, `intelligence_index`, `coding_index`, and `agentic_index` from the top-level `{ data, meta }` response.
- Scores are only verbatim OpenRouter values. Do not retain family, sub-family, fuzzy, normalized-name, or inferred intelligence matching.
- Exact `model_permaslug === model.id` is the default match. A single colon-suffix may inherit its canonical ID's non-null score; two or more colons are unmatched and a successful inheritance must use `intelligence_scope: "variant-inherited"`.
- If `benchmarks-raw.json` has any `error`, `build-data.js` exits non-zero rather than generating all-null intelligence records.
- Do not modify `scripts/family-allowlist.json`, `src/lib/pair.js`, or quadrant math.
- The repository was newly initialized without a baseline commit; do not create partial baseline commits during this task.

---

## File Structure

- Create: `scripts/fetch-openrouter-benchmarks.js` — direct CLI fetcher, error-envelope persistence, shrink guard, and non-zero runner failures.
- Create: `scripts/lib/benchmark-data.js` — pure capture validation, benchmark indexing, and exact/one-hop lookup.
- Create: `test/benchmarks.test.js` — controlled fetcher file-output tests and pure join tests.
- Modify: `scripts/build-data.js` — consume validated capture, build exact-ID fields, publish `benchmarks_fetched_at`, and remove BenchLM matching.
- Delete: `scripts/fetch-intelligence.js` — retired BenchLM scraper.
- Modify: `package.json` — native env-file data scripts and benchmark command.
- Modify: `src/charts/scatter.js`, `index.html` — OpenRouter benchmark provenance and inherited-variant tooltip copy.
- Modify: `README.md` — source, setup, integrity, caveat, and generated-file documentation.
- Create: `docs/product/b11-report.md` — probe, coverage, spot checks, removals, and known issues from the verified live run.

### Task 1: Benchmark capture and lookup primitives

**Files:**
- Create: `scripts/lib/benchmark-data.js`
- Create: `scripts/fetch-openrouter-benchmarks.js`
- Test: `test/benchmarks.test.js`

**Interfaces:**
- Produces `parseBenchmarkResponse(payload): object[]`, accepting only an object with an array at `data`.
- Produces `validateBenchmarkCapture(capture): object[]`, returning `capture.benchmarks` or throwing for an error envelope or invalid capture.
- Produces `resolveBenchmark(modelId, benchmarkById): { benchmark: object | null, intelligence_scope: string | null }`.
- Produces `fetchBenchmarks({ apiKey, fetchImpl, outPath, now }): Promise<{ ok: boolean, capture: object }>` for file-backed tests and CLI use.

- [ ] **Step 1: Write failing tests for capture output and lookup behavior**

```js
test('writes a missing_key error envelope without calling the API', async () => {
  const result = await fetchBenchmarks({ apiKey: '', fetchImpl: () => assert.fail('must not fetch'), outPath, now });
  assert.equal(result.ok, false);
  assert.deepEqual(JSON.parse(readFileSync(outPath, 'utf8')).error, 'missing_key');
});

test('resolves an exact model_permaslug and preserves index values', () => {
  const found = resolveBenchmark('vendor/model', new Map([['vendor/model', fixture]]));
  assert.equal(found.benchmark.intelligence_index, 63.1);
  assert.equal(found.intelligence_scope, null);
});

test('allows one variant suffix but rejects a double suffix', () => {
  assert.equal(resolveBenchmark('vendor/model:free', index).intelligence_scope, 'variant-inherited');
  assert.equal(resolveBenchmark('vendor/model:batch:free', index).benchmark, null);
});
```

- [ ] **Step 2: Run the focused test file and verify it fails for missing exports**

Run: `node --test test/benchmarks.test.js`

Expected: FAIL because `fetchBenchmarks` and `resolveBenchmark` do not yet exist.

- [ ] **Step 3: Implement the smallest pure capture and lookup helpers**

```js
export function parseBenchmarkResponse(payload) {
  if (!payload || !Array.isArray(payload.data)) throw new Error('expected response.data to be an array');
  return payload.data;
}

export function resolveBenchmark(modelId, benchmarkById) {
  const exact = benchmarkById.get(modelId);
  if (exact) return { benchmark: exact, intelligence_scope: null };
  if ((modelId.match(/:/g) ?? []).length !== 1) return { benchmark: null, intelligence_scope: null };
  const canonical = modelId.slice(0, modelId.indexOf(':'));
  const inherited = benchmarkById.get(canonical);
  return inherited?.intelligence_index != null
    ? { benchmark: inherited, intelligence_scope: 'variant-inherited' }
    : { benchmark: null, intelligence_scope: null };
}
```

Implement `fetchBenchmarks` with `Authorization: Bearer ${apiKey}`, full response preservation under `benchmarks`, `parsed N benchmark entries, M with intelligence_index` logging, and exactly these envelopes: `missing_key`, `fetch_failed`, `malformed_response`, and `capture_shrink`. Cover both non-200 and rejected-network fetches as `fetch_failed`. For a >20% shrink, retain the prior valid `benchmarks` as `previous_benchmarks` only inside the new error envelope. Return `ok: false`; the direct CLI runner must set `process.exitCode = 1`. Guard the runner with `fileURLToPath(import.meta.url) === process.argv[1]` so imports do not perform a network request.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `node --test test/benchmarks.test.js`

Expected: PASS for missing key, HTTP failure, malformed response, capture shrink, valid raw capture, exact match, absent ID, one-hop inheritance, and double-suffix rejection.

### Task 2: Fail-closed model-data build

**Files:**
- Modify: `scripts/build-data.js`
- Modify: `test/benchmarks.test.js`
- Delete: `scripts/fetch-intelligence.js`

**Interfaces:**
- Consumes `validateBenchmarkCapture(capture)` and `resolveBenchmark(model.id, benchmarkById)` from `scripts/lib/benchmark-data.js`.
- Produces `models.json` with top-level `benchmarks_fetched_at` and per-model `intelligence`, `intelligence_source`, `coding_index`, `agentic_index`, and `intelligence_scope`.

- [ ] **Step 1: Add failing build-data contract tests**

```js
test('refuses an error-flagged benchmark capture', () => {
  assert.throws(() => buildModelRecords({ priceList, allowlist, benchmarkCapture: { error: 'fetch_failed' } }), /fetch_failed/);
});

test('writes native benchmark values and fetch timestamp for exact IDs', () => {
  const output = buildModelRecords({ priceList, allowlist, benchmarkCapture: validCapture });
  assert.equal(output.models[0].intelligence, 63.1);
  assert.equal(output.models[0].intelligence_source, 'openrouter-benchmarks');
  assert.equal(output.models[0].coding_index, 78);
  assert.equal(output.models[0].agentic_index, 59.2);
  assert.equal(output.benchmarks_fetched_at, validCapture.fetched_at);
});
```

- [ ] **Step 2: Run focused tests and verify the build-record contract fails**

Run: `node --test test/benchmarks.test.js`

Expected: FAIL because `buildModelRecords` has not been exported and the old builder still reads `intelligence-raw.json`.

- [ ] **Step 3: Extract and implement a pure `buildModelRecords` function**

```js
export function buildModelRecords({ allowlist, priceList, benchmarkCapture, generatedAt }) {
  const benchmarks = validateBenchmarkCapture(benchmarkCapture);
  const benchmarkById = new Map(benchmarks.map((entry) => [entry.model_permaslug, entry]));
  const models = priceList
    .filter(isPaidCanonicalModel)
    .map((model) => ({ model, rule: matchAllowlist(model, allowlist) }))
    .filter(({ rule }) => rule != null)
    .map(({ model, rule }) => makeModelRecord(model, rule, benchmarkById));
  return { generated_at: generatedAt, benchmarks_fetched_at: benchmarkCapture.fetched_at, models };
}
```

`makeModelRecord` must use `resolveBenchmark`; pass `intelligence_index`, `coding_index`, and `agentic_index` through unchanged (or `null` when no matching entry). Only a non-null intelligence score receives `intelligence_source: 'openrouter-benchmarks'`; retain `intelligence_scope` only for `variant-inherited`. Replace the old BenchLM source with the benchmark endpoint in `sources`, delete `FAMILY_PATTERNS`, `TIER_NEGATIVE`, `SIZE_TOKEN`, `normalize`, `generationKey`, `findIntelligence`, and all `intelligence_ref` logic. Move the file I/O and logging into exported `main()` and guard its call with `fileURLToPath(import.meta.url) === process.argv[1]`, allowing the focused tests to import `buildModelRecords` without writing to `public/`. The direct builder runner must propagate validation exceptions, so error envelopes exit non-zero.

- [ ] **Step 4: Run focused tests and the existing suite**

Run: `node --test test/benchmarks.test.js && npm test`

Expected: all benchmark, metadata, filter, and pair tests pass.

### Task 3: Wire scripts and update UI/documentation provenance

**Files:**
- Modify: `package.json`
- Modify: `src/charts/scatter.js`
- Modify: `index.html`
- Modify: `README.md`

**Interfaces:**
- `npm run data` runs pricing, benchmarks, then the data builder, stopping after a benchmark-capture failure.
- The browser remains a static consumer of `/models.json` and displays only OpenRouter benchmark provenance.

- [ ] **Step 1: Update package scripts and source-facing copy**

```json
"data": "node --env-file=.env scripts/fetch-pricing.js && node --env-file=.env scripts/fetch-openrouter-benchmarks.js && node scripts/build-data.js",
"data:pricing": "node --env-file=.env scripts/fetch-pricing.js",
"data:benchmarks": "node --env-file=.env scripts/fetch-openrouter-benchmarks.js"
```

Remove `data:intelligence`. Replace all UI-facing BenchLM labels with “OpenRouter benchmarks”; remove `intelligence_ref`; show a provenance line for scored entries and a clear inherited-variant qualifier only when `intelligence_scope === 'variant-inherited'`.

- [ ] **Step 2: Update README source, setup, and integrity sections**

Document the benchmark endpoint, native `.env` loading, 500 request/day limit, free-tier key setup, CC BY 4.0 attribution, `benchmarks-raw.json`, exact `model_permaslug` matching, fail-closed benchmark errors, model-gray/pair-exclusion behavior, canonical-price handling, and updated example record with `coding_index`, `agentic_index`, and `benchmarks_fetched_at`.

- [ ] **Step 3: Build the static app and scan UI sources for retired wording**

Run: `npm run build && rg -n -i 'benchlm|intelligence_ref|family-aggregate|sub-family' src index.html`

Expected: build succeeds; the final command reports no matches in UI sources.

### Task 4: Live verification and B11 report

**Files:**
- Create: `docs/product/b11-report.md`
- Modify: `public/benchmarks-raw.json`, `public/pricing-raw.json`, `public/models.json` (generated, gitignored)

**Interfaces:**
- Consumes the real benchmark capture and generated model records.
- Produces an evidence-backed B11 report without API-key values.

- [ ] **Step 1: Run the full data pipeline and capture redacted console output**

Run: `npm run data`

Expected: pricing capture, one benchmark request, parse-count log, build summary, and `intelligence source: openrouter-benchmarks`; no secret appears.

- [ ] **Step 2: Compute coverage and audit details from generated JSON**

Run a Node one-off that reads `public/models.json` and `public/benchmarks-raw.json` to calculate tracked/scored counts and percentage, group unscored models by family, list `variant-inherited` IDs, identify duplicate `model_permaslug` entries, and select frontier/mid/obscure scored records. Compare the selected records' three index fields directly against the raw entries.

- [ ] **Step 3: Write the report from observed evidence**

Include the actual `{ data, meta }` shape and a verbatim non-secret sample entry; coverage and family breakdown; one exact generated record; removal inventory; three raw-record spot checks; inherited IDs; and known source/data issues. State whether coverage is below D12's 60% fallback trigger.

- [ ] **Step 4: Run final verification**

Run: `npm test && npm run build`

Expected: all tests pass and Vite produces `dist/`; then run the app with `npm run dev`, verify the scatter and pair card render without browser console errors, and verify UI sources contain no BenchLM wording.
