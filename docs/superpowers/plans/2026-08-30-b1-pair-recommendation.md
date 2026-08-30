# B1 Pair Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove parameter-count product behavior and make a workflow-cost-ranked planning/execution model pair the primary recommendation.

**Architecture:** Keep the existing OpenRouter-derived model records and quadrant substrate. Add a self-contained `src/lib/pair.js` that accepts the current plottable models and raw mix values, derives floors and ranked pairs, and reports why no pair qualifies. `src/main.js` will render that result and re-run it whenever filters, mix inputs, or verification mode change.

**Tech Stack:** Vite, vanilla browser JavaScript, Chart.js, Node built-in `node:test`.

**Spec:** `docs/product/b1-task-brief.md`

## Global Constraints

- Complete parameter removal before the pair recommendation and run `npm test` after each part.
- Do not modify `findIntelligence`, `scripts/family-allowlist.json`, or quadrant math other than removing the small-model pick.
- Preserve output JSON shape except for removing `params_b` and `tier`.
- Default mix is planning/execution/verification `65/30/5`; verification is deterministic ($0) unless model-based verification is enabled.
- Never relax a quality floor: report no qualifying pair with its binding floor/constraint.
- Do not run git commands or create commits.

---

### Task 1: Remove parameter-count data and presentation behavior

**Files:**
- Modify: `scripts/lib/derive-metadata.js`, `scripts/build-data.js`, `src/lib/filters.js`, `src/lib/quadrants.js`, `src/charts/scatter.js`, `src/main.js`, `index.html`, `src/styles.css`, `README.md`
- Modify/remove tests: `test/derive-metadata.test.js`, `test/filters.test.js`, `test/scatter-metadata.test.js`

**Interfaces:**
- `deriveMetadata(model, rule)` produces `{ family }` only.
- `applyFilters(models, { families, withIntel, withPrice })` has no size option.
- `computePicks()` has no `small` result.


- [ ] **Step 1: Write the failing metadata contract test**

Replace the existing size/tier assertions with `deriveMetadata({ name: 'Qwen3 8B', id: 'qwen/qwen3-8b' }, { family: 'qwen' })` and hand-written expected value `{ family: 'qwen' }`. This catches any accidental retention of product parameter metadata.

- [ ] **Step 2: Run the metadata test to establish the expected red state**

Run: `npm test -- test/derive-metadata.test.js`

Expected: FAIL because the current metadata object still includes `params_b` and `tier`.

- [ ] **Step 3: Remove data-model and filter fields**

Delete `PARAMS_SIZE`, `deriveParamsB`, and `deriveTier`; return `{ family: rule.family }` from `deriveMetadata`. In the data builder, call the untouched `findIntelligence(model, metadata.family)` and do not output parameter/tier fields. Remove `maxParamsB` from filter inputs and its branch.

- [ ] **Step 4: Remove visual encoding and old UI controls**

Use `r: 8` for every scatter data point; replace the tooltip parameter line with `Context: <value> tokens · Family: <family>`. Remove the max-size control and all related DOM/state wiring. Remove the small pick only from quadrant selection and remove all rendered single-model pick cards, leaving quadrants as the explanatory substrate.

- [ ] **Step 5: Rewrite README descriptions of the current product**

Describe OpenRouter as the catalog source of truth, the family allowlist as the inclusion gate, fixed scatter markers, and the workflow-pair recommendation. Remove Ollama/parameter/tier/size references from records, UI descriptions, and caveats.


- [ ] **Step 5: Remove obsolete tests after their replacement is red**

Keep allowlist/canonical-model tests in `test/derive-metadata.test.js`; remove explicit-size and tier tests. Keep color tests in `test/filters.test.js`; remove the max-parameter filtering test. Delete `test/scatter-metadata.test.js` because its only behavior is parameter-size rendering.

- [ ] **Step 6: Run the full suite for Part 1**

Run: `npm test`

Expected: all remaining tests pass.

### Task 2: Add pure, tested pairing logic

**Files:**
- Create: `src/lib/pair.js`, `test/pair.test.js`

**Interfaces:**
- `normalizeMix(mix)` converts non-negative planning/execution/verification input amounts into shares totalling 1, or returns `null` for a zero total.
- `computeQualityFloors(models)` returns median execution and p75 planning intelligence over finite plottable intelligence values.
- `expectedCost(planning, execution, mix, modelBasedVerification)` returns `P*c_p + E*c_e + V*(modelBasedVerification ? c_e : 0)`.
- `recommendPairs(models, mix, modelBasedVerification)` returns floors, normalized mix, ranked pairs, and an honest `reason` when no pair qualifies.

- [ ] **Step 1: Write a failing floor-and-distinctness test**

Use four literal models with intelligence `10, 20, 30, 40` and valid costs. Assert p75 is `32.5`, median is `25`, and every returned pair has different planning/execution IDs.

- [ ] **Step 2: Run the new test to verify red**

Run: `npm test -- test/pair.test.js`

Expected: FAIL because `src/lib/pair.js` does not exist.

- [ ] **Step 3: Implement the minimal pure candidate and ranking path**

Filter to finite intelligence and positive finite average cost. Calculate interpolated percentiles, generate ordered role assignments constrained by distinct IDs and floors, then sort by ascending expected cost, descending combined intelligence, planning name, and execution name.

- [ ] **Step 4: Add failing cost/mix/verification tests**

Assert a literal hand calculation such as `0.65*10 + 0.30*2 = 7.1` when verification is deterministic, then `7.2` when `0.05*2` is added. Use a fixture where a planning-heavy mix chooses one pair and an execution-heavy mix chooses another.

- [ ] **Step 5: Implement normalization and verification behavior**

Normalize raw inputs on each call; zero/invalid mixes return no recommendation with an explicit invalid-mix reason. Incorporate verification cost only when the boolean toggle is enabled.

- [ ] **Step 6: Add no-qualifying-pair coverage and run all pairing tests**

Test a one-model/high-floor fixture and assert the result does not silently return a fallback and includes the binding planning floor or the distinctness constraint. Run: `npm test -- test/pair.test.js`.

### Task 3: Wire and present the pair card

**Files:**
- Modify: `index.html`, `src/main.js`, `src/styles.css`

**Interfaces:**
- UI calls `recommendPairs(plottable, currentMix, verificationToggle)` on every render.
- Pair card shows result floors, live-normalized mix, recommended pair, two runners-up, and no-pair reason.

- [ ] **Step 1: Add the card structure and controls**

Place a `#pair-card` section above the charts with numeric planning, execution, verification inputs defaulted to `65`, `30`, `5`, and a model-based-verification checkbox defaulted off. Provide containers for the current floor/mix explanation and ranked result.

- [ ] **Step 2: Wire reactive state**

Read the three inputs as raw non-negative amounts and call `normalizeMix` at render time. Attach `input` listeners to all shares and a `change` listener to the verification toggle so the card recomputes without changing filters or charts.

- [ ] **Step 3: Render explainable recommendations**

For the top pair and at most two runners-up, show slot, name, family, intelligence, cost/$1M, current quadrant label, and pair expected $/1M. Show displayed floors and normalized shares. If empty, render the exact reason returned by `recommendPairs`, including floor values, rather than choosing a fallback.

- [ ] **Step 4: Style responsive primary/recommendation and runner-up cards**

Use the existing color variables, grid cards, subdued runner-up treatment, and legible controls. Do not add dependencies.

- [ ] **Step 5: Run tests and build-level syntax verification**

Run: `npm test && npm run build`

Expected: tests pass and Vite emits `dist/` successfully.

### Task 4: Fresh-data verification and report

**Files:**
- Create: `docs/product/b1-report.md`

- [ ] **Step 1: Refresh source data**

Run: `npm run data` and retain the generated model data for actual values.

- [ ] **Step 2: Verify field removal**

Run: `grep -rn "params_b\\|size_gb\\|tier\\|ollama" src/ scripts/ public/models.json` and classify every remaining hit. Only intelligence-matching `TIER_NEGATIVE` is allowed.

- [ ] **Step 3: Verify the UI in a stopped-after-use dev server**

Run `npm run dev`, inspect the page at `http://localhost:5173`, verify default 65/30/5 ranking, mix reranking, verification-cost change, and browser console. Stop the server after inspection.

- [ ] **Step 4: Write the report with live values**

Document the implemented formula/floors/tie-breaks, a hand-worked live pair, deleted parameter behavior, test coverage, the live recommended pair and runners-up, grep result, and any no-pair or degeneracy behavior.
