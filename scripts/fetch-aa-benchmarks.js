import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseAaPage } from './lib/aa-data.js';

export const AA_URL = 'https://artificialanalysis.ai/api/v2/language/models/free';
const DEFAULT_OUT = resolve(process.cwd(), 'public/aa-raw.json');

function timestamp(now) {
  return typeof now === 'function' ? now() : now;
}

function readPreviousCapture(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function previousValidModels(capture) {
  return capture && !capture.error && Array.isArray(capture.models) ? capture.models : null;
}

function writeCapture(path, capture) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(capture, null, 2));
}

function errorCapture(now, error, errorDetail, previousModels) {
  const capture = { source: AA_URL, fetched_at: timestamp(now), error };
  if (errorDetail) capture.error_detail = errorDetail;
  if (previousModels) capture.previous_models = previousModels;
  return capture;
}

function failed({ now, outPath, logger, error, errorDetail, previousModels }) {
  const capture = errorCapture(now, error, errorDetail, previousModels);
  writeCapture(outPath, capture);
  const detail = errorDetail ? `: ${errorDetail}` : '';
  logger.warn(`[fetch-aa-benchmarks] failed ${error}${detail}`);
  return { ok: false, capture };
}

export async function fetchAaBenchmarks({
  apiKey = process.env.AA_API_KEY,
  fetchImpl = fetch,
  outPath = DEFAULT_OUT,
  now = () => new Date().toISOString(),
  logger = console,
} = {}) {
  if (!apiKey?.trim()) {
    return failed({
      now,
      outPath,
      logger,
      error: 'missing_key',
      errorDetail: 'AA_API_KEY not set — see README',
    });
  }

  const models = [];
  let page = 1;
  let pagesFetched = 0;
  let intelligenceIndexVersion = null;
  let totalPages = null;

  while (true) {
    const url = `${AA_URL}?page=${page}`;
    logger.log('[fetch-aa-benchmarks] GET', url);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': 'model-cost-intelligence-analysis/1.0',
        },
      });
    } catch (error) {
      return failed({ now, outPath, logger, error: 'fetch_failed', errorDetail: error.message });
    }
    if (!response.ok) {
      return failed({ now, outPath, logger, error: 'fetch_failed', errorDetail: `HTTP ${response.status}` });
    }

    let payload;
    try {
      payload = parseAaPage(await response.json());
    } catch (error) {
      return failed({ now, outPath, logger, error: 'malformed_response', errorDetail: error.message });
    }

    if (totalPages == null) totalPages = payload.pagination.total_pages ?? null;
    if (totalPages != null && payload.pagination.total_pages != null && totalPages !== payload.pagination.total_pages) {
      return failed({ now, outPath, logger, error: 'malformed_response', errorDetail: 'pagination.total_pages changed during capture' });
    }
    if (intelligenceIndexVersion == null) intelligenceIndexVersion = payload.intelligence_index_version ?? null;
    if (payload.intelligence_index_version != null
      && intelligenceIndexVersion !== payload.intelligence_index_version) {
      return failed({ now, outPath, logger, error: 'malformed_response', errorDetail: 'intelligence_index_version changed during capture' });
    }

    models.push(...payload.data);
    pagesFetched += 1;
    if (!payload.pagination.has_more) {
      if (totalPages != null && page < totalPages) {
        return failed({ now, outPath, logger, error: 'malformed_response', errorDetail: 'pagination ended before total_pages' });
      }
      break;
    }
    if (totalPages != null && page >= totalPages) {
      return failed({ now, outPath, logger, error: 'malformed_response', errorDetail: 'pagination.has_more exceeded total_pages' });
    }
    page += 1;
  }

  const previousModels = previousValidModels(readPreviousCapture(outPath));
  if (previousModels && models.length < previousModels.length * 0.8) {
    return failed({
      now,
      outPath,
      logger,
      error: 'capture_shrink',
      errorDetail: `prior ${previousModels.length}, current ${models.length}`,
      previousModels,
    });
  }

  const withIntelligence = models.filter((model) => (
    model?.evaluations?.artificial_analysis_intelligence_index != null
  )).length;
  const capture = {
    source: AA_URL,
    fetched_at: timestamp(now),
    intelligence_index_version: intelligenceIndexVersion,
    models,
  };
  logger.log(`[fetch-aa-benchmarks] parsed ${models.length} models across ${pagesFetched} pages, ${withIntelligence} with intelligence_index`);
  writeCapture(outPath, capture);
  logger.log('[fetch-aa-benchmarks] wrote', outPath);
  return { ok: true, capture };
}

export async function main(options = {}) {
  const result = await fetchAaBenchmarks(options);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.warn('[fetch-aa-benchmarks] failed:', error.message);
    process.exitCode = 1;
  });
}
