import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchBenchmarks } from '../scripts/fetch-openrouter-benchmarks.js';
import { indexBenchmarks, resolveBenchmark, validateBenchmarkCapture } from '../scripts/lib/benchmark-data.js';

const NOW = '2026-08-30T12:00:00.000Z';

function benchmark(id = 'vendor/model', intelligence = 63.1) {
  return {
    source: 'artificial-analysis',
    model_permaslug: id,
    display_name: id,
    intelligence_index: intelligence,
    coding_index: 78,
    agentic_index: 59.2,
    pricing: { prompt: '0.0000055', completion: '0.0000275' },
  };
}

async function withCaptureFile(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'b11-benchmarks-'));
  const outPath = join(dir, 'benchmarks-raw.json');
  try {
    await callback(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readCapture(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('writes a missing_key envelope without calling OpenRouter', async () => {
  await withCaptureFile(async (outPath) => {
    const result = await fetchBenchmarks({
      apiKey: '',
      fetchImpl: () => assert.fail('missing keys must not call fetch'),
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(readCapture(outPath).error, 'missing_key');
  });
});

test('writes fetch_failed envelopes for HTTP and network failures', async () => {
  await withCaptureFile(async (outPath) => {
    const http = await fetchBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response('rate limited', { status: 429 }),
      outPath,
      now: () => NOW,
    });
    assert.equal(http.ok, false);
    assert.equal(readCapture(outPath).error, 'fetch_failed');
    assert.match(readCapture(outPath).error_detail, /429/);

    const network = await fetchBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => { throw new Error('socket closed'); },
      outPath,
      now: () => NOW,
    });
    assert.equal(network.ok, false);
    assert.equal(readCapture(outPath).error, 'fetch_failed');
    assert.match(readCapture(outPath).error_detail, /socket closed/);
  });
});

test('writes malformed_response when data is not an array', async () => {
  await withCaptureFile(async (outPath) => {
    const result = await fetchBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response(JSON.stringify({ data: {} }), { status: 200 }),
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(readCapture(outPath).error, 'malformed_response');
    assert.match(readCapture(outPath).error_detail, /data/);
  });
});

test('preserves a full successful benchmark response verbatim under benchmarks', async () => {
  await withCaptureFile(async (outPath) => {
    const entry = benchmark();
    const result = await fetchBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response(JSON.stringify({ data: [entry], meta: { ignored: true } }), { status: 200 }),
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(readCapture(outPath), {
      source: 'https://openrouter.ai/api/v1/benchmarks',
      fetched_at: NOW,
      benchmarks: [entry],
    });
  });
});

test('flags capture shrink and preserves prior valid entries only as recovery evidence', async () => {
  await withCaptureFile(async (outPath) => {
    const prior = Array.from({ length: 10 }, (_, index) => benchmark(`vendor/model-${index}`));
    writeFileSync(outPath, JSON.stringify({ source: 'prior', fetched_at: '2026-08-29T00:00:00.000Z', benchmarks: prior }));

    const result = await fetchBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response(JSON.stringify({ data: prior.slice(0, 7) }), { status: 200 }),
      outPath,
      now: () => NOW,
    });
    const capture = readCapture(outPath);

    assert.equal(result.ok, false);
    assert.equal(capture.error, 'capture_shrink');
    assert.equal(capture.error_detail, 'prior 10, current 7');
    assert.deepEqual(capture.previous_benchmarks, prior);
    assert.equal(capture.benchmarks, undefined);
  });
});

test('resolves exact benchmark IDs and only one canonical variant hop', () => {
  const exact = benchmark('vendor/model');
  const noScore = benchmark('vendor/no-score', null);
  const index = new Map([
    [exact.model_permaslug, exact],
    [noScore.model_permaslug, noScore],
  ]);

  assert.deepEqual(resolveBenchmark('vendor/model', index), { benchmark: exact, intelligence_scope: null });
  assert.deepEqual(resolveBenchmark('vendor/model:free', index), { benchmark: exact, intelligence_scope: 'variant-inherited' });
  assert.deepEqual(resolveBenchmark('vendor/no-score:batch', index), { benchmark: null, intelligence_scope: null });
  assert.deepEqual(resolveBenchmark('vendor/model:batch:free', index), { benchmark: null, intelligence_scope: null });
  assert.deepEqual(resolveBenchmark('vendor/missing', index), { benchmark: null, intelligence_scope: null });
});

test('keeps the scored exact-ID entry when another benchmark source repeats the ID', () => {
  const scored = benchmark('vendor/model');
  const unscoredDuplicate = {
    source: 'design-arena',
    model_permaslug: 'vendor/model',
    display_name: 'Vendor Model',
    elo: 1300,
  };

  const index = indexBenchmarks([scored, unscoredDuplicate]);

  assert.equal(index.get('vendor/model'), scored);
});

test('refuses benchmark error envelopes and malformed captures downstream', () => {
  assert.throws(() => validateBenchmarkCapture({ error: 'fetch_failed', error_detail: '429' }), /fetch_failed/);
  assert.throws(() => validateBenchmarkCapture({ benchmarks: {} }), /benchmarks/);
  assert.deepEqual(validateBenchmarkCapture({ benchmarks: [benchmark()] }), [benchmark()]);
});
