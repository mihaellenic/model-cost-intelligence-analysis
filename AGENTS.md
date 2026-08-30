# Project: Model Cost Intelligence Analysis

Static decision matrix for picking coding LLMs by intelligence vs. cost. PoC stage; being restructured toward a mature version.

## Commands

- `npm run data` — fetch BenchLM + OpenRouter, then build `public/models.json`
- `npm run dev` — vite dev server (http://localhost:5173)
- `npm run build` — `npm run data` + vite build → `dist/`
- `npm run preview` — preview `dist/`

## Key files

- `scripts/build-data.js` — OpenRouter selection + BenchLM matching logic (load-bearing)
- `scripts/family-allowlist.json` — coding-relevant OpenRouter family rules
- `scripts/lib/derive-metadata.js` — pure selection and metadata derivation
- `scripts/fetch-*.js` — BenchLM and OpenRouter scrapers
- `src/main.js` — UI entry
- `src/lib/quadrants.js` — quadrant + picks logic
- `src/lib/filters.js` — filters + family colors

## Conventions

- Tests use Node's built-in `node:test` (`npm test`)
- No lint yet (planned: eslint)
- Single-page Vite + Chart.js
- Data integrity over coverage: a wrong price is worse than a missing one
