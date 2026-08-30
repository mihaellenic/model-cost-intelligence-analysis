# B12 AA Intelligence and Variant Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default OpenRouter benchmark join with a fail-closed Artificial Analysis capture and auditable, deterministic catalog-to-score resolution.

**Architecture:** A new paginated fetcher owns AA capture validation and writes only full snapshots or explicit error envelopes. Pure helpers collapse only description-proven catalog variants and resolve normalized AA slugs, while `build-data.js` coordinates the catalog, creates output records, and exposes audit summaries. The UI remains data-driven and only changes provenance plus the effort-median disclosure.

**Tech Stack:** Node.js ESM, native `node:test`, Vite, Chart.js.

**Spec:** `docs/product/b12-task-brief.md`

## Global Constraints

- Scores are verbatim AA scores except for the explicitly labelled effort-variant median; no fuzzy matching, interpolation, max-picking, or AA-side date stripping.
- All four capture failures are explicit and cause the builder to fail; partial paginated captures are never written as valid data.
- Collapse occurs before the AA join, only follows a deterministic linked sibling once, retains unresolved variants, and logs every merge.
- Do not modify the pair algorithm, quadrant math, family allowlist, or remove `scripts/fetch-openrouter-benchmarks.js`.
- Attribution to Artificial Analysis is visible in both the README and UI footer.

---

### Task 1: AA capture contract

**Files:**
- Create: `scripts/fetch-aa-benchmarks.js`
- Create: `scripts/lib/aa-data.js`
- Test: `test/aa-benchmarks.test.js`

**Interfaces:**
- Produces `fetchAaBenchmarks({ apiKey, fetchImpl, outPath, now, logger })` returning `{ ok, capture }`.
- Produces `validateAaCapture(capture)` returning raw AA `models`; output capture uses `{ source, fetched_at, intelligence_index_version, models }`.

- [ ] **Step 1: Write the failing capture tests**

```js
assert.equal((await fetchAaBenchmarks({ apiKey: '', fetchImpl })).capture.error, 'missing_key');
assert.equal((await fetchAaBenchmarks({ apiKey: 'key', fetchImpl: failingFetch })).capture.error, 'fetch_failed');
assert.equal((await fetchAaBenchmarks({ apiKey: 'key', fetchImpl: malformedFetch })).capture.error, 'malformed_response');
assert.equal((await fetchAaBenchmarks({ apiKey: 'key', fetchImpl: shrinkFetch })).capture.error, 'capture_shrink');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test test/aa-benchmarks.test.js`
Expected: FAIL because the AA modules are absent.

- [ ] **Step 3: Implement full pagination and error envelopes**

```js
for (let page = 1; hasMore; page += 1) {
  const response = await fetchImpl(`${AA_URL}?page=${page}`, { headers: { 'x-api-key': apiKey } });
  // validate the complete `{ pagination, data }` page before appending.
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --test test/aa-benchmarks.test.js`
Expected: PASS with valid output, full pagination, and all four failure states covered.

### Task 2: Pure catalog collapse and AA resolution

**Files:**
- Modify: `scripts/lib/derive-metadata.js`
- Create: `scripts/lib/aa-resolution.js`
- Test: `test/aa-resolution.test.js`

**Interfaces:**
- Produces `collapseCatalogVariants(models)` returning `{ models, collapses, nonCollapses }`.
- Produces `normalizeCatalogSlug(id)`, `normalizeAaSlug(slug)`, and `resolveAaIntelligence(catalogId, aaModels)` returning `{ intelligence, coding_index, agentic_index, intelligence_scope, effort_scores, collision }`.

- [ ] **Step 1: Write fixture-based failing tests**

```js
assert.deepEqual(collapseCatalogVariants([base, linkedVariant]).collapses, [{ variant_id: linkedVariant.id, base_id: base.id, matched_phrase: 'same underlying model as' }]);
assert.equal(normalizeCatalogSlug('deepseek/deepseek-v4-pro-0813'), 'deepseekv4pro');
assert.equal(resolveAaIntelligence('openai/gpt-5.6-luna', [base, low, high]).intelligence, 52.3);
assert.equal(resolveAaIntelligence('openai/gpt-5.6-luna', [low, high]).intelligence_scope, 'effort-median');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test test/aa-resolution.test.js`
Expected: FAIL because collapse and AA resolution are absent.

- [ ] **Step 3: Implement deterministic extraction and resolution**

```js
// catalog IDs may remove a trailing YYYYMMDD/YYMMDD-like suffix; AA slugs never do.
// base result wins; effort-only scores use numeric median; unresolved collisions return null.
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `node --test test/aa-resolution.test.js`
Expected: PASS for collapse, non-collapse, normalization, median, collision, and verbatim pass-through cases.

### Task 3: Builder and default pipeline

**Files:**
- Modify: `scripts/build-data.js`
- Modify: `package.json`
- Modify: `test/aa-benchmarks.test.js`

**Interfaces:**
- `buildModelRecords({ allowlist, priceList, aaCapture, generatedAt, pricingSource })` returns `aa_fetched_at`, source metadata, models, and `audit` data for reporting.

- [ ] **Step 1: Write failing builder tests**

```js
assert.throws(() => buildModelRecords({ aaCapture: { error: 'fetch_failed' }, ...inputs }), /fetch_failed/);
assert.equal(output.models[0].intelligence_source, 'artificial-analysis');
assert.deepEqual(output.models[0].effort_scores, [40, 60]);
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `node --test test/aa-benchmarks.test.js test/aa-resolution.test.js`
Expected: FAIL because the builder still reads `benchmarks-raw.json`.

- [ ] **Step 3: Wire the post-collapse catalog to the AA resolver**

```js
const collapsed = collapseCatalogVariants(canonicalAllowlistedModels);
const resolved = resolveAaIntelligence(model.id, aaModels);
```

- [ ] **Step 4: Switch package scripts and verify targeted tests**

Run: `node --test test/aa-benchmarks.test.js test/aa-resolution.test.js`
Expected: PASS; `npm run data` now calls AA, not OpenRouter benchmarks.

### Task 4: Provenance, documentation, and report

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `README.md`
- Create: `docs/product/b12-report.md`

**Interfaces:**
- Tooltip-facing model records show `intelligence_scope: "effort-median"` as “effort-variant median.”
- Static footer visibly credits Artificial Analysis and OpenRouter pricing/catalog.

- [ ] **Step 1: Update presentation and README copy**

```html
Data: <a href="https://artificialanalysis.ai/">Artificial Analysis API</a> ·
<a href="https://openrouter.ai">OpenRouter catalog and pricing</a>.
```

- [ ] **Step 2: Run the build after a fresh data capture**

Run: `npm run data && npm run build`
Expected: AA paginated capture, a builder summary including collapsed and effort-median counts, and a static bundle with updated attribution.

- [ ] **Step 3: Record the evidence report**

```md
# B12 report

Include the raw AA record shape, page counts, collapse table, coverage decomposition, Luna check, effort medians, test output, and known issues.
```

- [ ] **Step 4: Run the full suite and inspect the app**

Run: `npm test && npm run build`
Expected: all tests and static build pass; visible provenance and effort-median labels are present in the generated app.
