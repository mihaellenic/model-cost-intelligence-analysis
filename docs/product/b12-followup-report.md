# B14 follow-up report: residual intelligence gaps (D17 + hardcode pass)

Follow-up to `b12-report.md`. Implements **D16**'s bounded hardcode-audit
mandate and **D17** (variant-inherited intelligence). Two independent parts,
landed as separate commits:

- `cea81c5` — Part 1: D17 variant-inherited intelligence
- `7d2bae9` — Part 2: cited manual intelligence overrides

## Part 1 — D17: variant-inherited intelligence

### Inheritance audit

| Variant | Base | Inherited score | Fields inherited | Trigger phrase |
|---|---|---|---|---|
| `anthropic/claude-opus-5-fast` | `anthropic/claude-opus-5` | 63.1 | `supported_parameters` | `identical capabilities` |
| `anthropic/claude-opus-4.8-fast` | `anthropic/claude-opus-4.8` | 57.3 | `supported_parameters` | `identical capabilities` |
| `anthropic/claude-opus-4.7-fast` | `anthropic/claude-opus-4.7` | 55 | `supported_parameters` | `identical capabilities` |

All three bases were AA-scored in `public/aa-raw.json` (verified before
predicting, per the brief). Each variant's `supported_parameters` is a strict
subset of its base's (loses `max_completion_tokens`/`temperature`); `context`,
`per_request_limits`, and `architecture` are identical. The subtract-only
delta rule (D17 condition 4) is satisfied for all three.

Labels on the generated rows: `intelligence_scope: "variant-inherited"`,
`inherit_from: <base_id>`, `intelligence_source: "artificial-analysis"`.
`coding_index`/`agentic_index` pass through from the base (all three bases
carry them). Scores are verbatim base values (63.1 / 57.3 / 55).

Skipped inheritances: none in the live catalog — `morph/morph-v3-fast` is a
different family with no sibling link and was never a `material_difference`
non-collapse. `audit.inheritance_skips` is empty; the skip machinery is
covered by tests.

### Implementation notes

- New pure module `scripts/lib/variant-inherit.js`:
  `resolveVariantInheritance(nonCollapse, variant, base)` → inherited fields
  or `{ skip: reason }`. Reuses `extractSiblingReference` and
  `isProtectedVariant`/`stableJson` from `catalog-collapse.js` (no parser
  duplication). One-hop enforcement via `inherit_from` on the base.
- Wired into `build-data.js` after `collapseCatalogVariants`, in the same
  pass as `resolveAaIntelligence`. `audit.inheritances` +
  `audit.inheritance_skips` added; one `[build-data] inheritance` console line
  per row; count in the summary line.
- `catalog-collapse.js` collapse logic, pair algorithm, quadrant math, and
  allowlist untouched.

## Part 2 — hardcode pass

### Citation reality check (verified against live sources)

The brief's suggested candidate list was checked against primary sources on
2026-08-30. **All ten suggested slugs 404 on AA's web pages**, and the AA
detail API (`/api/v2/language/models/{slug}`) returns `403` for our Free-tier
key (verified; Pro+ only). The Free-tier list endpoint — the only citable AA
data we can fetch — contains none of the ten candidates.

Every miss-table model (b12-report §3) was then checked against AA web pages
for a citable score with **confirmed identity** (same model, not a
near-named sibling). Result: only two miss-table models are citable AND above
the pair-card execution floor (median 32.1 at build time):

| Model | Score | Source type | URL | captured_at |
|---|---|---|---|---|
| `qwen/qwen3.6-max-preview` | 41.1 | aa-web | `https://artificialanalysis.ai/models/qwen3-6-max` | 2026-08-30 |
| `google/gemini-3-flash-preview` | 38.7 | aa-web | `https://artificialanalysis.ai/models/gemini-3-flash-reasoning` | 2026-08-30 |

Identity evidence: OpenRouter's own names/descriptions match the AA page
titles verbatim ("Qwen3.6 Max Preview", "Gemini 3 Flash Preview (Reasoning)").
Both pages publish the score under the **latest index version (4.1.1)**; the
capture's version is 4.1 — recorded in each override's `note` per the brief's
version-mismatch rule. Web values used verbatim.

### Candidates REJECTED for missing citations

| Candidate | Reason |
|---|---|
| `anthropic/claude-sonnet-4.5`, `claude-opus-4.1`, `claude-haiku-4.5` | No AA page (404); no AA capture row; no vendor-published intelligence index found |
| `google/gemini-3.1-flash-lite` | No AA page for the GA slug; only `gemini-3-1-flash-lite-preview` (25.6) exists — a different (preview) model, not citable for the GA row |
| `deepseek/deepseek-chat-v3.1`, `deepseek/deepseek-v3.2-exp` | No AA page for these slugs; `deepseek-v3-1`/`deepseek-v3-2` pages exist but are the non-reasoning open-weight variants — different models |
| `qwen/qwen3-coder-plus`, `qwen/qwen3-coder-flash` | No AA page; `qwen3-coder-480b-a35b-instruct` (18.2) is the open-weight base, not the proprietary Plus/Flash |
| `mistralai/codestral-2508` | No AA page (404) |
| `openai/gpt-5.1-codex-max` | No AA page; `gpt-5-1-codex` (35.6) is a different model |
| `openai/gpt-5.5-pro`, `gpt-5.4-pro` | AA pages exist but publish **Intelligence N/A** (unscored) — not citable |
| `google/gemini-2.5-pro-preview(-05-06)` | AA page exists (23) but the model is below the execution floor and legacy — cosmetic coverage, rejected per D4 |
| `qwen/qwen3.8-flash` | `qwen3-8-flash-next` (55.8) is a different model (Flash-Next ≠ Flash) |
| `qwen/qwen3-coder`, `qwen/qwen3-235b-a22b*`, `qwen3-30b-a3b*`, `qwen3-8b/14b/32b`, gemma-3/4, llama-3.x, ministral, mistral-small, mixtral, gpt-4o/4-turbo/3.5, o4-mini-high, gpt-chat-latest, grok-4.20, morph, kat-coder, minimax, granite, relace, seed-code, poolside | AA pages exist for some but all score **below the execution floor (32.1)** or are legacy/out-of-scope generations — adding them inflates coverage cosmetically, which D4 forbids |

**Cap respected:** 2 overrides landed (≤10 cap). The honest number is 2, not
10 — missing beats invented, and every rejected candidate has a recorded
reason above.

### Override contract

- `scripts/intelligence-overrides.json` — offline map, applied in
  `build-data.js` **only when the AA join returns null** (live scores always
  win; `audit.override_skips_live` empty this run).
- Records carry `intelligence_source: "manual"`, `intelligence_scope: null`,
  `intelligence_citation: <source_url>`.
- Malformed entries (missing `source_url`, non-numeric `intelligence`, bad
  `source_type`, missing `model_id`/`captured_at`) **fail the build loudly** —
  never silently skipped (tested).
- `audit.manual_overrides` mirrors the collapse audit shape; one
  `[build-data] manual override` console line per entry.

## Coverage

| Resolution | Count |
|---|---:|
| Total tracked | 210 |
| AA-join exact | 124 |
| Effort-median | 1 |
| Variant-inherited (D17) | 3 |
| Manual overrides | 2 |
| **Scored** | **130 (61.90%)** |
| Unscored | 80 |

B12 baseline was 125/210 (59.52%). Part 1 added +3 (60.95%), Part 2 added +2
(61.90%). No gate is attached to this number anymore (D16 amended it); the
decomposition is recorded so future-you can audit.

## Verification

- `npm test`: **51 passing, 0 failures** (46 pre-B14 + 8 variant-inherit +
  5 overrides).
- `npm run data` full-run logs: 624 AA models / 4 pages / 611 scored; 3
  collapses; 3 inheritances; 2 manual overrides (included above).
- `npm run build` completes; Vite bundle builds clean.
- Pair card renders with zero console errors; recommended pair present.
- Spot-check protocol (after `npm run data`):
  - 3 sampled records verbatim vs `aa-raw.json`: `gpt-5.6-luna` 52.3,
    `claude-opus-5` 63.1, `deepseek-v4-flash` 51.8 — all MATCH.
  - 3 `-fast` rows vs `models.json`: inherited values equal base values
    (63.1 / 57.3 / 55), labels `variant-inherited` + `inherit_from` — all
    MATCH.
- Tooltips: `variant-inherited` rows show "Intelligence: inherited from
  <base>"; `manual` rows show "Intelligence: manual override (cited)" — same
  mechanism as `effort-median`.

## Known issues

- The hardcode pass landed **2 of a possible 10** because the suggested
  candidates are not citable at the Free tier. A Pro AA key would unlock the
  detail endpoint and likely make several planning-slot candidates (e.g.
  `claude-sonnet-4.5`, `gpt-5.1-codex-max`) citable — revisit if a Pro key
  becomes available.
- `qwen/qwen3.6-max-preview` and `google/gemini-3-flash-preview` are
  execution-slot candidates (41.1 / 38.7 vs median 32.1); neither reaches the
  planning floor (p75 45.3). No planning-slot miss was citable.
- AA web pages publish index **4.1.1** while the capture reports **4.1**; the
  two overrides use the web (4.1.1) values with the mismatch recorded in
  `note`. If the capture's version catches up, the overrides become
  redundant and should be re-verified.
