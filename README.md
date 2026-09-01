# Model Cost Intelligence Analysis

A static cost-intelligence tool for choosing a **planning + execution** coding-model pair based on intelligence and API cost.

The page compares coding models on two build-time-sourced axes:

- **Intelligence score** from the [Artificial Analysis API](https://artificialanalysis.ai/)
- **Cost per 1M tokens** from [OpenRouter](https://openrouter.ai) — average of prompt and completion pricing

The page ranks eligible, distinct planning/execution pairs by expected workflow cost across a visible task mix. The quadrant scatter remains the reasoning layer behind the recommendation.

Intelligence data via Artificial Analysis API. Attribution is required by Artificial Analysis's terms and is visible in the application footer.

## Quick start

```bash
npm install
printf 'AA_API_KEY=...\n' > .env
npm run data      # fetch OpenRouter pricing + Artificial Analysis intelligence, then build public/models.json
npm run dev       # vite dev server on http://localhost:5173
npm run build     # static bundle in dist/ (deploy anywhere)
npm run preview   # preview dist/
```

Create `.env` in the repository root with `AA_API_KEY=...` from [Artificial Analysis](https://artificialanalysis.ai/). The npm data commands load it with Node's native `--env-file=.env`; no dotenv dependency is used. `.env` is gitignored and must never be committed or printed. OpenRouter catalog/pricing is public; `OPENROUTER_API_KEY` is optional and used only by the retained `data:benchmarks` fallback command.

## Output

```
dist/
├── index.html
├── assets/index-*.js     # ~170 kB (59 kB gzip)
├── assets/index-*.css    # 3.4 kB
└── models.json           # generated, gitignored
```

Drop `dist/` on any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, …). The browser only loads generated `models.json`; it never calls OpenRouter or receives the API key. The repo is configured for GitHub Pages with the Vite base set to the repo sub-path (`/model-cost-intelligence-analysis/`).

## How it works

### Data pipeline (build time only)

| Script | Source | Output |
|---|---|---|
| `scripts/fetch-pricing.js` | `https://openrouter.ai/api/v1/models` | `public/pricing-raw.json` |
| `scripts/fetch-aa-benchmarks.js` | `https://artificialanalysis.ai/api/v2/language/models/free` (AA API key required) | `public/aa-raw.json` |
| `scripts/build-data.js` | filters and collapse-audits the OpenRouter catalog, then joins AA models by deterministic normalized slug | `public/models.json` |

`npm run data` runs pricing, AA capture, then the builder. `npm run data:pricing` and `npm run data:aa` run the individual default fetches. `npm run data:benchmarks` retains the OpenRouter benchmark fetcher as an auxiliary fallback and requires `OPENROUTER_API_KEY`; it is not part of the default pipeline. AA capture is always either a complete `{ source, fetched_at, intelligence_index_version, models }` snapshot or an explicit error envelope. Missing keys, fetch failures, malformed API data, and suspicious capture shrink write an error state. The builder refuses every error state rather than silently publishing all-null intelligence records. `npm run build` runs the full fail-closed chain (`data` → `test` → `vite build`); the data scripts use `--env-file-if-exists=.env` so they also run in CI, where the keys come from Actions secrets.

### Family allowlist

[`scripts/family-allowlist.json`](scripts/family-allowlist.json) is the coding-relevance gate. It contains ordered OpenRouter ID prefixes, normalized families, and targeted modality exclusions. Add a family rule only after confirming the family is coding-relevant in the live OpenRouter catalog.

```json
{
  "prefix": "google/gemini-",
  "family": "gemini",
  "exclude": ["image"]
}
```

### Final model record (what the UI sees)

```json
{
  "generated_at": "2026-08-30T12:00:00.000Z",
  "benchmarks_fetched_at": "2026-08-30T12:00:00.000Z",
  "models": [{
    "id": "openai/gpt-5.6-luna",
    "name": "GPT-5.6 Luna",
    "family": "claude",
    "intelligence": 52.3,
    "intelligence_source": "artificial-analysis",
    "coding_index": 70,
    "agentic_index": 55,
    "intelligence_scope": null,
    "cost_per_1m_avg": 1.5,
    "cheapest_provider": {
      "name": "openai/gpt-5.6-luna",
      "prompt_per_1m": 1,
      "completion_per_1m": 2
    },
    "providers": [{
      "name": "openai/gpt-5.6-luna",
      "prompt_per_1m": 1,
      "completion_per_1m": 2
    }],
    "context_length": 200000
  }]
}
```

`coding_index` and `agentic_index` are AA pass-through fields reserved for the later task-type-fit work; the current UI does not compute from them. `intelligence_scope: "effort-median"` means the model had no plain AA score, so the visible intelligence value is the median of the stored `effort_scores` rather than a silent low/high choice.

### UI

- **Bar chart** — all tracked models ranked by Artificial Analysis intelligence, color-coded by family.
- **Pair recommendation** — a distinct planning and execution model pair ranked by expected $/1M across an adjustable planning/execution/verification mix. Deterministic verification is $0 by default; model-based verification can charge the execution model.
- **Scatter** — X = log cost per 1M tokens, Y = intelligence, with fixed-size markers. Only models with **both** an intelligence score and a price are plotted.
  - 4 colored quadrants split by **median lines** (dashed gray), computed over the plotted population.
  - **Top-left (green)** — *Sweet spot*: high intel, low cost.
  - **Top-right (yellow)** — *Premium*: high intel, high cost.
  - **Bottom-left (orange)** — *Budget*: low intel, low cost.
  - **Bottom-right (red)** — *Avoid*: low intel, high cost.
- **Filters** — family multi-select, "only models with intelligence", and "only models with pricing". Pair quality floors are recalculated from the filtered plotted population.

### Data integrity rules

The builder (`scripts/build-data.js`) never guesses:

- **Intelligence** is a verbatim AA `artificial_analysis_intelligence_index` joined only by normalized slug (lowercase alphanumerics). OpenRouter catalog IDs may drop a trailing date; AA slugs never do. A normalization collision with different scores stays `null`; there is no family aggregate, fuzzy match, interpolation, or inferred score.
- Plain AA base scores win. If only `-low`, `-medium`, `-high`, or `-xhigh` effort variants exist, the output uses their median with `intelligence_scope: "effort-median"` and records all component scores. It never silently picks an effort level.
- Before the AA join, a catalog variant collapses only when its OpenRouter description deterministically links a sibling as the same underlying model or with identical capabilities. The sibling must be paid/canonical and agree on material capability fields; protected `-chat`, Instant, and legacy Pro IDs remain distinct. Every collapse is emitted in the build audit.
- **Pricing** comes directly from canonical paid OpenRouter catalog records. The family allowlist is the only inclusion mechanism; colon-suffixed variants, including `:batch` and `:free`, are rejected before pricing is calculated. A free variant can never create a $0 recommendation.
- Models without AA data render gray/unscored and are excluded from the scatter and pair recommendation. This is intentional: a wrong spend recommendation is worse than a missing recommendation.
- A failed or suspicious AA capture halts the build. It must be refreshed successfully; stale recovery data is never consumed automatically.

### Refresh schedule

The site is hosted on **GitHub Pages** and refreshed automatically every
Monday 06:00 UTC by a weekly canary (`.github/workflows/weekly-canary.yml`)
that re-exercises both live sources and the test suite. A deploy workflow
(`.github/workflows/deploy.yml`) runs the full fail-closed chain on every push
to `main` and on manual dispatch:

```bash
npm run data && npm test && vite build   # then upload dist/ + deploy-pages
```

Any fetcher error state (missing key, fetch failure, malformed response,
capture shrink) or test failure exits non-zero and stops the workflow **before
upload** — the previously published Pages deployment stays live and the
failure email arrives automatically. The API keys live in Actions secrets
(`AA_API_KEY`, `OPENROUTER_API_KEY`); `.env` is never committed. The footer
shows `Data generated` / `benchmarks fetched` timestamps with a `⚠ stale
(>7 days)` marker when the data is older than a week.

To refresh manually: `npm run data` locally, or trigger the deploy workflow
from the Actions tab.

## Caveats

- **Intelligence scores** are Artificial Analysis indexes: source-dependent summaries that can hide how a model behaves on your code. Always sanity-check a representative task before committing.
- **Pricing** is OpenRouter catalog pricing at build time. Real costs vary with traffic, batching, and negotiated rates.
- **API pricing only** — local-inference hardware and energy costs are outside the product’s scope.
- **Sparse data is honest data**: models without an exact benchmark record remain unscored; increase coverage by improving the auditable source data, never by guessing a score.

## Project layout

```
.
├── index.html                # single page
├── package.json
├── vite.config.js
├── public/                   # generated; gitignored
│   ├── aa-raw.json
│   ├── benchmarks-raw.json       # optional OpenRouter fallback capture
│   ├── models.json
│   └── pricing-raw.json
├── scripts/
│   ├── family-allowlist.json # coding-family gate
│   ├── fetch-aa-benchmarks.js
│   ├── fetch-openrouter-benchmarks.js # optional fallback
│   ├── fetch-pricing.js
│   ├── build-data.js
│   └── lib/
│       ├── aa-data.js
│       ├── aa-resolution.js
│       ├── catalog-collapse.js
│       ├── benchmark-data.js          # optional fallback
│       └── derive-metadata.js
└── src/
    ├── main.js
    ├── styles.css
    ├── charts/
    │   ├── bar.js
    │   └── scatter.js
    └── lib/
        ├── filters.js
        ├── pair.js
        └── quadrants.js
```

## License

MIT.
