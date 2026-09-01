# B7 report: GitHub Pages hosting + fail-closed weekly refresh (D24, amended)

Implements `b7-task-brief.md`. The build-and-deploy cycle is now weekly,
fail-closed, and observable: a public GitHub repo hosts the site on Pages, a
deploy workflow chains data → test → build → deploy so the existing failure
contract gates deploys, and a weekly canary re-exercises both live sources
unattended. D4 extended to deploys: **no path exists that silently ships a
wrong or stale-pretending-fresh card.**

## 1. URLs

- Repo: https://github.com/mihaellenic/model-cost-intelligence-analysis (public)
- Pages site: https://mihaellenic.github.io/model-cost-intelligence-analysis/
- Deploy workflow: `.github/workflows/deploy.yml`
- Canary workflow: `.github/workflows/weekly-canary.yml`

## 2. Fail-closed proof (negative test)

**Setup:** `AA_API_KEY` Actions secret rotated to a wrong value, deploy
workflow re-run manually.

**Failed run** (https://github.com/mihaellenic/model-cost-intelligence-analysis/actions/runs/33541522719) — the data step went red and the chain stopped before upload:

```
[fetch-aa-benchmarks] GET https://artificialanalysis.ai/api/v2/language/models/free?page=1
[fetch-aa-benchmarks] failed fetch_failed: HTTP 401
##[error]Process completed with exit code 1.
```

**Stale-but-honest site stayed live during the red run** — the previously
published card kept serving (fetched while the run was red):

```
generated_at: 2026-09-01T18:04:16.357Z   (the clean run's card)
models: 207
index: HTTP 200
```

**Failure email:** GitHub's default Actions failure email is automatic. The
repo's notification setting (Settings → Notifications → Actions) is the
default **on** — no setup was required. Both failure classes (deploy and
canary) arrive as Actions failure emails; this is the single notification
path. (Addresses redacted.)

**Restore:** key restored to the real value, deploy re-run → green
(https://github.com/mihaellenic/model-cost-intelligence-analysis/actions/runs/33541584561).

## 3. Canary

- File: `.github/workflows/weekly-canary.yml` — cron `0 6 * * 1` (Mondays
  06:00 UTC) + `workflow_dispatch`. Does **not** deploy and does not build
  dist for publish; it re-exercises `npm run data` + `npm test` so source rot
  is caught within a week even if nothing else triggers a build.
- Manual `workflow_dispatch` run: **success**
  (https://github.com/mihaellenic/model-cost-intelligence-analysis/actions/runs/33541642270).
- `capture_shrink` awareness: inherited from the fetchers' exit codes — a
  shrink-flagged capture makes `fetch-aa-benchmarks.js` exit 1, which fails
  `npm run data`, which fails the canary (red run → email). The exit-code
  path that fires is `process.exitCode = 1` in `fetch-aa-benchmarks.js:146`
  (and the CLI catch at `:152`).

## 4. Freshness surfacing (UI)

Footer now renders (live DOM extraction from the deployed site):

```
Data generated: 2026-09-01 18:05 UTC · benchmarks fetched: 2026-09-01 18:05 UTC
```

- Pure module `src/lib/freshness.js`: `isStale` (strict `>` 7 days),
  `humanizeUtc` (`YYYY-MM-DD HH:MM UTC`), `freshnessLine`.
- Stale marker `⚠ stale (>7 days)` appended when `generated_at` is >7 days
  old, computed at render time (no new dependency). Demonstrated by unit test
  (not by waiting a week): `test/freshness.test.js` asserts the marker fires
  at >7 days and not at ≤7.
- A visitor can tell the data's age in <5 seconds.

## 5. Failure-state → chain-link mapping

| Failure state | Where caught | Exit code | Chain link |
|---|---|---|---|
| `missing_key` (AA key absent) | `fetch-aa-benchmarks.js` | 1 | `npm run data` → `npm run build` fails → workflow stops before upload |
| `fetch_failed` (HTTP/network) | `fetch-aa-benchmarks.js` / `fetch-pricing.js` | 1 | same |
| `malformed_response` | `fetch-aa-benchmarks.js` | 1 | same |
| `capture_shrink` (>20% smaller) | `fetch-aa-benchmarks.js` | 1 | same |
| Test failure | `npm test` (inside `npm run build`) | 1 | `npm run build` fails → workflow stops before upload |
| Build failure (vite) | `vite build` (inside `npm run build`) | 1 | workflow stops before upload |

Every state exits non-zero, so the `&&` chain in `npm run build` halts and
the workflow never reaches `upload-pages-artifact`/`deploy-pages`. The
previously published Pages deployment stays live.

## 6. Tests

- Local: **109 tests, 109 pass, 0 fail** (`npm test`).
- CI (deploy run 33541584561): **109 tests, 109 pass, 0 fail**.
- New tests:
  - `test/pipeline-exit.test.js` — all four AA failure states exit 1
    (fixture-injected), clean capture exits 0, pricing HTTP failure exits 1,
    build-data CLI exits 1 on an error-flagged AA capture, AA CLI subprocess
    exits non-zero on a missing key.
  - `test/build-script.test.js` — `build` = `data && test && vite build`
    (order pinned); `data` order = pricing → AA → builder; data scripts use
    `--env-file-if-exists` (CI has no `.env`).
  - `test/freshness.test.js` — stale at >7d / not at ≤7d, humanize format,
    freshnessLine content.

## 7. Implementation notes / deviations

- **`npm run build` is now `npm run data && npm test && vite build`** and the
  deploy workflow calls it as one step. The brief's literal step list
  (data → test → build as separate steps) would fetch live data twice in one
  run; collapsing to the npm chain preserves the exact fail-closed order
  (test #2 asserts the chain shape) while fetching each source once.
- **`--env-file=.env` → `--env-file-if-exists=.env`** in all four data
  scripts. CI has no `.env`; secrets come from the step `env:`. Requires
  Node ≥22.9, so both workflows pin `node-version: 22` (satisfies "20+").
- **Vite `base: '/model-cost-intelligence-analysis/'`** set in
  `vite.config.js`. Verified `dist/index.html` references assets under the
  sub-path. Additionally, `src/main.js` now fetches
  `${import.meta.env.BASE_URL}models.json` — without this, the deployed page
  would fetch `/models.json` (404) and render blank, the same silent-404 class
  as the assets gotcha the brief warns about. Both the asset paths and the
  data fetch are verified live (HTTP 200).
- **`fetch-pricing.js` / `fetch-aa-benchmarks.js` `main()` now accept an
  options object** (backward-compatible) so exit codes are testable without
  hitting the network.
- Secrets: `AA_API_KEY` + `OPENROUTER_API_KEY` set as Actions secrets only
  (single store). `.env` remains gitignored; no key values were printed or
  committed. The failed-run log shows `AA_API_KEY: ***` (masked).
- Pages source is "GitHub Actions" (`build_type: workflow`), enabled before
  the first deploy.

## 8. Known issues

- GitHub Actions deprecation warnings for Node 20 actions (checkout,
  configure-pages, deploy-pages, setup-node, upload-artifact) — cosmetic;
  they run on Node 24. No action taken.
- The canary and deploy both run `npm ci` from `package-lock.json`; the lock
  file is committed (verified present).
