# B15 report: trustworthy pair recommendations (D18 frontier-band floor + D19 separation rule)

Fix batch after B1's usability trial 1 failed. Implements the amended
`b1-task-brief.md` §Quality floors and §Candidate pairs (2026-08-30) per D18
and D19. Decision log untouched (both decisions already recorded).

## 1. DeepSeek-twin regression test — named and passing

`test/pair.test.js` has a named test **"DeepSeek-twin regression: same-score
near-price twins form no pair in either ordering"**. It feeds the trial-1
fixture (deepseek-v4-flash 51.8 / $0.1181 and deepseek-v4-flash-0731 51.8 /
$0.1225, plus a frontier model) and asserts no pair ever has both members in
the twin set — in either slot ordering. The trial-1 case cannot recur.

## 2. Frontier band at live data (band = 8)

Fresh `npm run data` (2026-08-30): 210 tracked / 130 scored.

- max scored intelligence = **63.1** (claude-opus-5)
- planning floor = 63.1 − 8 = **55.1**
- planning pool = **17 models** (63.1 down to sonnet-5 55.3):

| Model | Intel | $/1M |
|---|---|---:|
| claude-opus-5 / claude-opus-5-fast | 63.1 | 15 / 30 |
| claude-fable-5 | 62.1 | 30 |
| grok-4.6 / gpt-5.6-sol | 60.9 | 4 / 6 |
| kimi-k3 | 59.7 | 9 |
| glm-5.3 | 59.5 | 2.9 |
| qwen3.8-max / qwen3.8-2.4t-a95b | 58.1 / 57.7 | 4 / 4 |
| glm-5.3-flash | 57.5 | 0.1625 |
| claude-opus-4.8 / -fast | 57.3 | 15 / 30 |
| gpt-5.6-terra | 56.6 | 7 |
| gpt-5.5 | 56.3 | 17.5 |
| gemini-3.7-flash | 56 | 2.25 |
| grok-4.5 | 55.8 | 4 |
| claude-sonnet-5 | 55.3 | 6 |

The floors line renders: `Planning floor: frontier band −8.0 → ≥55.1 (max
63.1) · execution ≥ median (33.0).`

## 3. Separation-rule examples from live data

Default 65/30/5 mix, deterministic verification, band 8.

**Admitted via the price path** (also score path): `glm-5.3-flash` (57.5,
$0.1625) → `deepseek-v4-pro` (53.2, $0.6259). Price ratio 0.6259/0.1625 =
**3.85×**; score gap 4.3 pts. Chip: `separation: 3.9× price · 4.3 pts`.

**Admitted via the score path only** (price ratio 1.38 < 1.5): `glm-5.3-flash`
(57.5, $0.1625) → `deepseek-v4-flash` (51.8, $0.1181). Score gap **5.7 pts**.
Chip: `separation: 5.7 pts`. This is the recommended pair.

**Rejected — the trial-1 recommendation**: `deepseek-v4-flash` ↔
`deepseek-v4-flash-0731` (51.8 = 51.8, $0.1181 vs $0.1225). Price ratio 1.04,
score gap 0.0 → neither path → **no pair formed**. Both twins still appear as
legitimate execution models paired with distinct planners (they are different
generations, correctly not collapsed by D15/D17), but never as a mirror-pair.

## 4. UI verification

- Floors line shows the band rule and the resolved threshold (see §2).
- Band control (`#band-width`, default 8, next to the mix inputs) re-ranks
  live: band 0 → floor ≥63.1, planning pool = claude-opus-5 only; band 8 →
  pool of 17. No persistence added (the mix inputs don't persist either —
  consistency over novelty).
- Separation chip on each pair row shows which D19 path qualified the pair.
- Mix control unchanged: 0/100/0 still re-ranks (claude-opus-5 → deepseek-v4-flash).
- No console errors or warnings.

## 5. Tests

`npm test`: **61 passing, 0 failures** (was 51 pre-B15). New/rewritten in
`test/pair.test.js`:

- frontier-band floor (max − 8) + max over non-null intelligence only
- band control: band 0 → top model only; band 20 → wider pool; band change re-ranks
- DeepSeek-twin regression (named, §1)
- D19 paths: 1.5× boundary qualifies; 2.0-pt boundary qualifies; neither → rejected
- zero-cost edge: price path cannot pass, score path is the only path
- null-intelligence models excluded from both slots and from max/median
- no-qualifying-pair state names the binding floor with frontier-band wording
- existing tests kept green; the p75 floor test rewritten for the band rule

## 6. Spot-check protocol (hand-computed from `public/models.json`)

Recommended pair: `z-ai/glm-5.3-flash` (planning) → `deepseek/deepseek-v4-flash`
(execution), expected $0.1411/1M.

```
0.65 × 0.1625 + 0.30 × 0.1181 + 0.05 × 0 = 0.105625 + 0.03543 = $0.141055 → $0.1411 ✓
```

Runner-up 1: `glm-5.3-flash` → `deepseek-v4-flash-0731`:
`0.65 × 0.1625 + 0.30 × 0.1225 = 0.105625 + 0.03675 = $0.142375 → $0.1424 ✓`

Runner-up 2: `glm-5.3-flash` → `deepseek-v4-pro`:
`0.65 × 0.1625 + 0.30 × 0.6259 = 0.105625 + 0.18777 = $0.293395 → $0.2934 ✓`

All three match the rendered cards. Separation chips verified against the
same records (1.38× / 5.7 pts; 1.33× / 5.7 pts; 3.85× / 4.3 pts).

## Known issues

- The recommended pair's planning slot is `glm-5.3-flash` (57.5), not the
  absolute max (63.1): the band admits the whole frontier, and expected-cost
  ranking picks the cheapest qualifying planner. This is the intended D18
  behavior — the floor is a constraint, not a preference.
- `claude-opus-5` and `claude-opus-5-fast` are both in the planning pool
  (63.1, $15 vs $30). They are distinct rows by D17 (separate pricing tiers)
  and satisfy D19 against cheap executors, so both can appear across pairs —
  but never as a mirror-pair of each other (ratio 2.0×, gap 0.0 → price path
  passes, so they *are* separable; they are not economically identical).
- Out of scope per brief: B5 mix-control persistence/polish, the AA Pro key
  question (B14 known issues), pipeline changes, verification-toggle redesign.
