# B5 task: read-only parameters + per-row tooltips (D23, re-scoped)

## Context

You are implementing the **re-scoped B5** per decision **D23** (read it — it
supersedes the *adjustable* part of D7/D18 while preserving their visibility
principles). Read `docs/product/b17-report.md` for the current card state.

**Why the re-scope:** across usability trials 1–3, the sole persona never
adjusted the mix or the band. Editable-but-never-edited is speculative
flexibility. D23 freezes mix + band as **read-only displayed parameters**;
the verification toggle stays live. The decision layer is untouched — this
is a UI task plus a tooltip enhancement.

## Part A — freeze mix + band (UI only)

- Replace the mix inputs (planning/execution/verification %) and the
  frontier-band input with **read-only displays** of the active values.
  Suggested treatment: the floors line already shows the resolved values;
  render the params as static text adjacent to it, e.g.
  `Params: mix 65/30/5 · frontier band 8 → planning floor ≥55.1 (max 63.1) ·
  execution ≥ median (33.05)`. One line, visually calm (not input-styled).
- **Remove** the now-dead input elements, their event wiring, and any
  normalization-on-input logic in `main.js` (the pure `normalizeMix` in
  `pair.js` stays — it's still applied to the constant).
- **Verification toggle stays interactive** (D23) — session-scoped, no
  persistence, default OFF as today.
- No persistence of anything (nothing to persist — params are constants).

## Part B — per-row tooltips with per-type indexes

Every row's model chip (planning/execution) tooltip gains, below the
existing intelligence line:

```
Intelligence: 63.1 (AA index 4.1)
Coding index: 78.0 · Agentic index: 59.2      ← new lines
Cost: $15.00/1M avg · Context: 200k
```

- Values are the record's `coding_index` / `agentic_index` pass-throughs
  (present since B12; may be null — render `—` when null, never omit the
  line: a missing line reads as "not measured" ambiguity, a `—` reads as
  "measured, unavailable"... choose `—`; label the pair of lines
  "per-type" if space allows).
- Apply to **all card rows** (top-level + collapsed sections' rows when
  expanded). The mechanism exists (tooltips render `effort-median` /
  `variant-inherited` / manual-override labels today — extend, don't
  rebuild).
- `intelligence_scope` labels continue to render when present.

## Tests

1. UI: with frozen params, the card computes from the constant mix 65/30/5
   and band 8 — assert the displayed floors line matches the pure layer's
   `computeQualityFloors(models, 8)`.
2. Read-only check: the params render as text (no `<input>` elements for
   mix/band remain in the DOM).
3. Verification toggle: still re-prices every row (existing behavior —
   keep its tests passing; it must NOT have been frozen).
4. Tooltips: fixture models with coding/agentic values render them; nulls
   render `—`; `intelligence_scope` labels still appear (all three kinds).
5. All existing pair/lens/vendor tests stay green untouched (the pure layer
   must not change — if any test needs editing for Part A, that's a signal
   you're editing the wrong layer).

## Verification (report in `docs/product/b5-report.md`)

1. DOM extraction: params line (read-only), verification toggle present and
   functional, one expanded row's tooltip content (with coding/agentic).
2. Diff-check: all card numbers identical to `b17-report.md` at defaults
   (nothing moved: $0.1411 / $11.55 / $4.11 / $18.75·133×).
3. Zero console errors; no horizontal overflow at 390px.
4. `npm test` count.
5. A note on anything you found dead while removing input wiring (dead
   handlers, unused CSS) — list what was removed.

## Constraints

- **Do not touch** `src/lib/pair.js`, `src/lib/lens.js`, `src/lib/vendor.js`
  logic (they already take mix/band as parameters — correct as-is).
- Do not touch pipeline, allowlist, ranking math, D19.
- No new dependencies. No persistence layer.
- D4: tooltips must show verbatim record values (no formatting drift —
  same rounding as elsewhere).

## Out of scope

Re-enabling editability (D23 reopen trigger — UI-only work if ever needed),
B7 (refresh infra), B6 (per-type fitness logic — this task only displays
the indexes, it does not compute fitness from them).