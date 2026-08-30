# B14 task: hardcode-audit residual intelligence gaps + D17 variant-inherited scores

## Context

You are implementing decisions **D16** and **D17** for "Model Cost Intelligence
Analysis". Read in `docs/product/decision-log.md`: **D4** (data integrity over
coverage — the absolute rule), **D14** (effort-variant policy: base wins,
median-flagged fallback, never max/min/first), **D15** (collapse rule — leave
it intact, you are NOT changing it), **D16** (the 59.52% coverage acceptance),
**D17** (variant-inherited intelligence for non-collapsed mode variants).
Also read `docs/product/b12-report.md` for the state you are modifying.

B12 landed the AA pipeline: 210 tracked models, 125 with intelligence
(59.52%). Coverage misses are concentrated in specific families. The user has
a standing mandate: *"if automatic matching is not possible, hardcode it if
needed"* — bounded, cited hardcodes are sanctioned product policy, not a hack.
This task closes the gap in two independent parts. **The parts are
independent; land them as separate commits** so the report can show each
part's contribution to coverage.

## Part 1 — D17: variant-inherited intelligence (implement FIRST — no new data needed)

Currently three rows are stuck at `intelligence: null` despite vendor-asserted
capability identity, because D15's material-difference guard kept them as
separate rows. D17 (user decision 2026-08-30: *"the intelligence is the same,
the 'fast' is on the operational side — higher prio on the server → faster
thinking/response"*) says: separate rows, inherited intelligence.

### Rule (verbatim policy)

A variant retained as a separate row (audit `non_collapses` with reason
`material_difference`) inherits its linked base's intelligence **only when
ALL of**:

1. `extractSiblingReference(variant.description)` resolves a sibling (reuse
   `catalog-collapse.js` — do not duplicate the parser);
2. the description affirmatively states capability identity (this is already
   implied by the extractor match — no separate check needed);
3. the base exists in the post-collapse catalog **and** has a non-null AA
   score;
4. the field delta is **subtract-only or price/speed-tier-only**. Concretely:
   for each watched field (`context`, `per_request_limits`,
   `supported_parameters`, `architecture`), the variant's value must be a
   **subset** of the base's (`stableJson`-comparable), never a superset or
   orthogonal value. `supported_parameters` losing
   `max_completion_tokens`/`temperature` qualifies; *gaining* any parameter
   does not.

Excluded: protected variants (`isProtectedVariant` — legacy pros, `-chat`,
`-instant`) never inherit. One hop only: a variant whose base is itself an
inheritor does not inherit.

### Implementation

- **New pure module** `scripts/lib/variant-inherit.js`:
  `resolveVariantInheritance(nonCollapse, variant, base)` →
  `{ intelligence, coding_index, agentic_index, intelligence_scope,
  inherit_from }` or `{ skip: reason }`. Pure, no I/O — mirroring the
  `aa-resolution.js` result shape so `build-data.js` composition stays
  trivial.
- **Wire into `build-data.js`**: run inheritance resolution AFTER
  `collapseCatalogVariants` (you need its `non_collapses` audit) and in the
  same pass as `resolveAaIntelligence`. Post-collapse rows that non-collapsed
  due to `material_difference` attempt inheritance; all other rows go through
  the normal AA join unchanged.
- **Labels:** inherited rows carry `intelligence_scope: "variant-inherited"`,
  `inherit_from: <base_id>`, and the base's `coding_index`/`agentic_index`
  pass through **only if** those are also non-null on the base; otherwise
  stay null. `intelligence_source` stays `"artificial-analysis"` (the score's
  origin is still AA).
- **Audit trail (D4):** add `audit.inheritances: [{variant_id, base_id,
  matched_phrase, fields_inherited}]` + one console line per inheritance, in
  the established `[build-data]` format, plus a count in the summary line.
  Also log skipped inheritances with their reasons (at least in the report).
- **Expected live result** (verify, don't assume): `claude-opus-5-fast` /
  `claude-opus-4.8-fast` / `claude-opus-4.7-fast` inherit their bases' scores
  **only if** AA scores those bases — check `public/aa-raw.json` for the base
  slugs (`claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, …) before
  predicting. An unscored base leaves the variant unscored — that is correct
  behavior; record the skip in the report.
- **Do not** touch `catalog-collapse.js` collapse logic, the pair algorithm,
  quadrant math, or the allowlist.

### Tests (new `test/variant-inherit.test.js`, fixture-based, no network)

1. All conditions met → inherits with correct labels
   (`variant-inherited` + `inherit_from`).
2. Base unscored → skip with reason, no fields set.
3. Additive delta (variant supports a param the base lacks) → skip.
4. Protected variant (`o1-pro`) → skip.
5. One-hop enforcement: base itself inheriting → skip.
6. `coding_index`/`agentic_index` pass-through only when the base has them.
7. Verbatim-value rule: inherited score equals the base's score exactly.

## Part 2 — Hardcode pass (implement SECOND)

### Scope and prioritization

85 unscored models (see `b12-report.md` §3 for the full miss list). **Do NOT
hardcode all of them.** Cap at **≤10 models**, chosen by pair-card relevance:

1. **Planning-slot candidates first** — frontier models from major coding
   families (claude, gemini, qwen3-coder/max-tier, deepseek, gpt-5 line).
2. **Execution-slot candidates second** — cheap high-volume families
   (qwen flash tier, gemma-3, ministral).
3. **Out of scope:** legacy/old-generation models (gpt-3.5/4 series, gemma-2,
   mixtral) — the pair card will never pick them; adding them inflates
   coverage cosmetically, and D4 says cosmetic coverage is not the goal.

### The hardcode contract (D4-strict)

Every hardcode MUST have all of:

- **A primary-source citation**, one of:
  - the AA **web page** for the model
    (`https://artificialanalysis.ai/models/<slug>`): fetch/check that the
    score is published there. NOTE: the web page shows the **latest
    intelligence-index version** — if it differs from the capture's 4.1,
    record BOTH values in the citation and use the web value, with
    `intelligence_index_note` stating the version mismatch;
  - vendor leaderboard / official docs (e.g. Anthropic, Google DeepMind,
    Qwen model cards) — only when AA has no page;
  - a score already present in a prior capture
    (`public/aa-raw.json` history) that the current feed dropped — cite the
    dropped capture.
  Blog posts, third-party leaderboards, and "it's about the same as X"
  reasoning are **not** citations. A model with no citable primary source
  stays unscored — missing beats wrong, and missing beats invented.
- **Verbatim value:** no rounding, no unit conversion, no interpolation
  between versions.
- **Data shape:** an offline overrides map,
  `scripts/intelligence-overrides.json`:
  `[ { "model_id": "anthropic/claude-sonnet-4.5", "intelligence": 62.1,
  "coding_index": null, "agentic_index": null, "source_url":
  "https://artificialanalysis.ai/models/claude-sonnet-4-5",
  "source_type": "aa-web" | "vendor-docs" | "prior-capture",
  "captured_at": "2026-08-30", "note": "…" } ]` — applied in `build-data.js`
  ONLY when the automatic AA join returns null for that ID (overrides never
  overwrite a live score). Each override lands in the record as
  `intelligence_source: "manual"`, `intelligence_scope: null`, plus
  `intelligence_citation: <source_url>`.
- **Audit:** `audit.manual_overrides` in models.json mirroring the collapse
  audit's shape; console line per override; count in the summary line.

### Suggested candidate list (VERIFY each against live data before committing)

Check the AA web page or slugs in `aa-raw.json` — availability changes:

- `anthropic/claude-sonnet-4.5`, `anthropic/claude-opus-4.1`,
  `anthropic/claude-haiku-4.5` (execution + planning candidates)
- `google/gemini-3.1-flash-lite` (cheap execution tier)
- `deepseek/deepseek-chat-v3.1`, `deepseek/deepseek-v3.2-exp`
- `qwen/qwen3-coder-plus`, `qwen/qwen3-coder-flash`
- `mistralai/codestral-2508` (execution)
- `openai/gpt-5.1-codex-max` (planning/execution)

Replace any model you cannot cite with the next candidate from
`b12-report.md` §3's miss table.

### Tests (extend or add `test/overrides.test.js`)

1. Override applies only when AA join returned null (live score wins).
2. Override fields land verbatim (`intelligence` unchanged to the digit).
3. Record gets `intelligence_source: "manual"` + citation fields.
4. Malformed override entry (missing `source_url` or non-numeric
   `intelligence`) → build FAILS loudly, never silently skips.
5. `audit.manual_overrides` populated.

## Verification (report against these)

- **Part 1:** inheritance audit table (variant → base → inherited score +
  fields, or skip reason); `claude-opus-*-fast` outcomes vs. their bases'
  AA scores.
- **Part 2:** override table (model → score → source type + URL →
  captured_at); explicit list of candidates REJECTED for missing citations.
- **Coverage:** final scored/total, decomposed: AA-join exact /
  effort-median / variant-inherited / manual overrides. Report the honest
  number either way. (No gate is attached to this number anymore — D16
  amended it — but the decomposition is required so future-you can audit.)
- **Pair card sanity:** the pair card renders with zero console errors; the
  `variant-inherited` and manual rows appear on the scatter with their
  `intelligence_scope` visible in tooltips (same mechanism as
  `effort-median`).
- `npm test` green (count stated); `npm run data` full-run logs included.
- **Spot-check protocol:** after `npm run data`, re-verify 3 sampled records
  against `public/aa-raw.json` verbatim (unchanged) and the 3 `-fast`
  rows against `models.json` (labels + values as claimed).

## Deliverable

Write `docs/product/b12-followup-report.md` (do not overwrite B12's report;
the parts land under a follow-up report keyed to B14 + D17).

## Constraints

- D4 absolute: missing beats wrong, wrong beats invented-for-coverage.
- No fuzzy matching anywhere. Every derived score carries a visible label
  and an audit line.
- Do not modify: `catalog-collapse.js` collapse logic, `aa-resolution.js`
  join policy, pair algorithm, quadrant math, allowlist, `.env` handling.
- Part 1 and Part 2 are separate commits.