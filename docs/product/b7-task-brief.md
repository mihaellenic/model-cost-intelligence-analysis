# B7 task: GitHub Pages hosting + fail-closed weekly refresh (D24, amended)

## Context

You are implementing **B7** per decision **D24** (read it — it pins the
architecture and the rejected alternatives). Also read the pipeline's
failure contract in `scripts/fetch-aa-benchmarks.js` + `b12-task-brief.md`
§failure contract — you are wiring that contract to a new gate: **deploys**.

**Why:** the tool's data can go stale silently today. B7 makes the
build-and-deploy cycle weekly, fail-closed, and observable. The core
principle (D4 extended): **no path may exist that silently ships a wrong or
stale-pretending-fresh card.**

## Part 0 — commit the pending B5 work

The working tree has uncommitted B5 changes (`tooltip.js`, `b5-report.md`,
modified `index.html`/`main.js`/`styles.css`, docs). Commit them first
(`feat: B5 read-only params + per-row tooltips (D23)` or similar), so CI
starts from a clean tree. Do NOT commit `.env` (gitignored — verify it
stays ignored; never print key values).

## Part 1 — GitHub remote + repo setup

- Create a **public** GitHub repo (user approved public). Push `main`.
- Add **Actions secrets**: `AA_API_KEY`, `OPENROUTER_API_KEY` (values from
  the local `.env` — available to you locally; never echo them into logs,
  files, or the report). This is the ONLY secrets store (single-vendor
  consolidation is why D24 was amended to Pages).
- Repo **Settings → Pages → Source: "GitHub Actions"** (enable before the
  first deploy run).
- GitHub default failure emails are automatic — no setup, but note it in
  the report.

## Part 2 — Pages deploy workflow + fail-closed build

One workflow, `.github/workflows/deploy.yml` (the deployer):

- **Triggers:** `push` to `main` + `workflow_dispatch` (manual re-run).
- **Permissions block:** `contents: read`, `pages: write`, `id-token: write`
  (required by deploy-pages; the Settings → Pages → "GitHub Actions" source
  must be enabled first).
- **Concurrency:** `concurrency: { group: "pages", cancel-in-progress: false }`
  (a failing deploy must never cancel a live one mid-publish).
- **Steps:** checkout → setup-node (20+) → `npm ci` → **`npm run data`** →
  **`npm test`** → `npm run build` (vite) → configure-pages →
  upload-pages-artifact (`dist`) → deploy-pages.
  The chain order is the fail-closed contract: any fetcher error state
  (non-zero exit) or test failure stops the workflow BEFORE
  upload/deploy — the previously published Pages deployment stays live.
- **Vite base path (silent-404 gotcha):** set `base: '/<repo-name>/'` in
  `vite.config.js` (or `--base` flag). Pages serves at
  `https://<user>.github.io/<repo-name>/` — without `base`, assets/CSS 404
  and the page renders blank WITHOUT failing the build. Verify the built
  `dist/index.html` references asset paths under the sub-path.
- **Environment variables:** the two keys from Actions secrets
  (`env:` on the data step only, not the whole job).
- Verify the fail-closed chain end to end (the acceptance core):
  1. Clean run → site live at `https://<user>.github.io/<repo-name>/`.
  2. **Negative test:** temporarily rotate `AA_API_KEY` to a wrong value in
     Actions secrets → the workflow must FAIL at the data step → the
     previously published site still serves the old card → the failure
     email arrives (Actions default; confirm repo Settings → Notifications
     → Actions email for failed workflows is on). Restore the key afterward
     and re-run to green.
  3. Document in the report which chain link catches each of the four
     failure states (fetcher exit code, test failure, build failure).

## Part 3 — weekly Actions canary (not the deployer)

`.github/workflows/weekly-canary.yml`:

- Cron: `0 6 * * 1` (Mondays 06:00 UTC) + `workflow_dispatch` for manual
  runs.
- Steps: checkout → setup-node (20+) → `npm ci` → `npm run data` →
  `npm test`.
- **The canary does NOT deploy and does NOT build dist for publish** — its
  job is to re-exercise both live sources and the tests unattended, so
  source rot is caught within a week even if nothing else triggers a build.
- Env: from Actions secrets (same single store as the deploy workflow).
  Failure → GitHub emails the owner (default behavior; confirm in the
  report that email notification for failed workflows is on: repo
  Settings → Notifications → Actions). This is the ONE notification path
  for both failure classes now — deploy failures and canary failures both
  arrive as Actions failure emails.
- Add `capture_shrink` awareness: if `npm run data` fails, the run must be
  red (this is inherited from the fetchers' exit codes — assert in the
  report which exit code path fired).

## Part 4 — freshness surfacing (UI)

- Footer gains: `Data generated: <generated_at> · benchmarks fetched:
  <benchmarks_fetched_at>` — both fields already exist in `models.json`.
  Humanize (`2026-08-30 17:06 UTC`) and, if >7 days old, append a visible
  `⚠ stale (>7 days)` marker (computed at render time; simple date math —
  no new dependency).
- Metric: a visitor can tell the data's age in <5 seconds.

## Tests

1. Pipeline exit codes: each of the four failure states (fixture-injected)
   exits non-zero (add tests if missing — this is load-bearing for
   fail-closed deploys).
2. `npm run build` runs data → test → build in order (assert via a dry
   script-order test or package.json shape check).
3. Footer: stale marker fires at >7 days, not at ≤7 (pure date-math
   function, fixture-based).
4. Existing 96 tests stay green.

## Verification (report in `docs/product/b7-report.md`)

1. URLs: GitHub repo, Pages site (https://<user>.github.io/<repo-name>/).
2. The fail-closed proof: negative-test evidence (failed run log snippet
   showing the data step red), stale-site-still-live confirmation (public
   URL serving the old card during the red run), failure-email
   confirmation (redact addresses).
3. Canary: workflow file path + a manual `workflow_dispatch` run's result.
4. Footer DOM extraction (fresh state) + the stale marker demonstrated by
   unit test (do not wait a week).
5. Failure-state → chain-link mapping table (four states × where caught ×
   exit code).
6. `npm test` count locally and in CI (both green).

## Constraints

- **Never commit or expose `.env`, keys, or any secret** (redact in report).
- No new runtime dependencies; dev/CI deps OK (actions-checkout, setup-node).
- Do not weaken the failure contract to make builds pass — if a fetcher
  exits 0 on error today, fixing that is IN scope; loosening detection is NOT.
- Site must stay static (no server functions) — the pipeline runs at build
  time only.

## Out of scope

B8 (eslint — separate), B6 (per-type fitness), custom domain, analytics,
runtime data fetching (rejected in D24).