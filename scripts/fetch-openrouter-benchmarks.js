import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseBenchmarkResponse } from './lib/benchmark-data.js';

const URL = 'https://openrouter.ai/api/v1/benchmarks';
const DEFAULT_OUT = resolve(process.cwd(), 'public/benchmarks-raw.json');

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

function previousValidBenchmarks(capture) {
  return capture && !capture.error && Array.isArray(capture.benchmarks)
    ? capture.benchmarks
    : null;
}

function writeCapture(path, capture) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(capture, null, 2));
}

function errorCapture(now, error, errorDetail, previousBenchmarks) {
  const capture = { source: URL, fetched_at: timestamp(now), error };
  if (errorDetail) capture.error_detail = errorDetail;
  if (previousBenchmarks) capture.previous_benchmarks = previousBenchmarks;
  return capture;
}

function logFailure(logger, capture) {
  const detail = capture.error_detail ? `: ${capture.error_detail}` : '';
  logger.warn(`[fetch-openrouter-benchmarks] failed ${capture.error}${detail}`);
}

export async function fetchBenchmarks({
  apiKey = process.env.OPENROUTER_API_KEY,
  fetchImpl = fetch,
  outPath = DEFAULT_OUT,
  now = () => new Date().toISOString(),
  logger = console,
} = {}) {
  if (!apiKey?.trim()) {
    const capture = errorCapture(now, 'missing_key', 'OPENROUTER_API_KEY not set — see README');
    writeCapture(outPath, capture);
    logFailure(logger, capture);
    return { ok: false, capture };
  }

  logger.log('[fetch-openrouter-benchmarks] GET', URL);

  let response;
  try {
    response = await fetchImpl(URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'model-cost-intelligence-analysis/1.0',
      },
    });
  } catch (error) {
    const capture = errorCapture(now, 'fetch_failed', error.message);
    writeCapture(outPath, capture);
    logFailure(logger, capture);
    return { ok: false, capture };
  }

  if (!response.ok) {
    const capture = errorCapture(now, 'fetch_failed', `HTTP ${response.status}`);
    writeCapture(outPath, capture);
    logFailure(logger, capture);
    return { ok: false, capture };
  }

  let benchmarks;
  try {
    const payload = await response.json();
    benchmarks = parseBenchmarkResponse(payload);
  } catch (error) {
    const capture = errorCapture(now, 'malformed_response', error.message);
    writeCapture(outPath, capture);
    logFailure(logger, capture);
    return { ok: false, capture };
  }

  const previousBenchmarks = previousValidBenchmarks(readPreviousCapture(outPath));
  if (previousBenchmarks && benchmarks.length < previousBenchmarks.length * 0.8) {
    const capture = errorCapture(
      now,
      'capture_shrink',
      `prior ${previousBenchmarks.length}, current ${benchmarks.length}`,
      previousBenchmarks,
    );
    writeCapture(outPath, capture);
    logFailure(logger, capture);
    return { ok: false, capture };
  }

  const withIntelligence = benchmarks.filter((benchmark) => benchmark.intelligence_index != null).length;
  logger.log(`[fetch-openrouter-benchmarks] parsed ${benchmarks.length} benchmark entries, ${withIntelligence} with intelligence_index`);
  const capture = { source: URL, fetched_at: timestamp(now), benchmarks };
  writeCapture(outPath, capture);
  logger.log('[fetch-openrouter-benchmarks] wrote', outPath);
  return { ok: true, capture };
}

export async function main() {
  const result = await fetchBenchmarks();
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.warn('[fetch-openrouter-benchmarks] failed:', error.message);
    process.exitCode = 1;
  });
}
