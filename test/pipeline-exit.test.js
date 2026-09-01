import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { main as aaMain } from '../scripts/fetch-aa-benchmarks.js';
import { main as pricingMain } from '../scripts/fetch-pricing.js';

const URL = 'https://artificialanalysis.ai/api/v2/language/models/free';

function aaModel(slug, intelligence = 52.3) {
  return {
    slug,
    name: slug,
    release_date: '2026-08-01',
    model_creator: { name: 'OpenAI' },
    evaluations: { artificial_analysis_intelligence_index: intelligence },
    pricing: { blended_per_million_tokens: 1 },
    performance: { time_to_first_token: 0.5 },
  };
}

async function withTempDir(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'b7-exit-'));
  try {
    return await callback(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function runExitCode(callback) {
  const previous = process.exitCode;
  process.exitCode = 0;
  try {
    return await callback();
  } finally {
    process.exitCode = previous;
  }
}

test('pipeline exit codes: AA fetcher sets exitCode 1 for all four failure states', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  await withTempDir(async (dir) => {
    const outPath = join(dir, 'aa-raw.json');
    mkdirSync(dirname(outPath), { recursive: true });
    const prior = Array.from({ length: 10 }, (_, index) => aaModel(`model-${index}`));
    const cases = [
      { name: 'missing_key', options: { apiKey: '', fetchImpl: () => assert.fail('must not fetch'), outPath } },
      { name: 'fetch_failed', options: { apiKey: 'k', fetchImpl: async () => new Response('nope', { status: 500 }), outPath } },
      { name: 'malformed_response', options: { apiKey: 'k', fetchImpl: async () => new Response(JSON.stringify({ pagination: {}, data: {} }), { status: 200 }), outPath } },
      { name: 'capture_shrink', options: { apiKey: 'k', fetchImpl: async () => new Response(JSON.stringify({ pagination: { has_more: false, total_pages: 1 }, data: prior.slice(0, 7) }), { status: 200 }), outPath } },
    ];
    for (const { name, options } of cases) {
      writeFileSync(outPath, JSON.stringify({ source: URL, fetched_at: '2026-08-29T00:00:00.000Z', models: prior }));
      const code = await runExitCode(async () => {
        await aaMain({ now: () => '2026-08-30T12:00:00.000Z', logger: { log() {}, warn() {} }, ...options });
        return process.exitCode;
      });
      assert.equal(code, 1, `${name} must exit non-zero`);
    }
  });
});

test('pipeline exit codes: AA fetcher leaves exitCode 0 on a clean capture', async () => {
  await withTempDir(async (dir) => {
    const outPath = join(dir, 'aa-raw.json');
    const code = await runExitCode(async () => {
      await aaMain({
        apiKey: 'k',
        fetchImpl: async () => new Response(JSON.stringify({
          intelligence_index_version: 'v4.1',
          pagination: { has_more: false, total_pages: 1 },
          data: [aaModel('gpt-5-6-luna')],
        }), { status: 200 }),
        outPath,
        now: () => '2026-08-30T12:00:00.000Z',
        logger: { log() {}, warn() {} },
      });
      return process.exitCode;
    });
    assert.equal(code, 0);
  });
});

test('pipeline exit codes: pricing fetcher sets exitCode 1 on HTTP failure', async () => {
  await withTempDir(async (dir) => {
    const outPath = join(dir, 'pricing-raw.json');
    const code = await runExitCode(async () => {
      await pricingMain({ fetchImpl: async () => new Response('nope', { status: 500 }), outPath, now: () => '2026-08-30T12:00:00.000Z', logger: { log() {}, warn() {} } });
      return process.exitCode;
    });
    assert.equal(code, 1);
  });
});

test('pipeline exit codes: build-data CLI exits non-zero on an error-flagged AA capture', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  await withTempDir(async (dir) => {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'public'), { recursive: true });
    writeFileSync(join(dir, 'scripts/family-allowlist.json'), JSON.stringify([{ prefix: 'openai/gpt-', family: 'gpt' }]));
    writeFileSync(join(dir, 'public/pricing-raw.json'), JSON.stringify({ source: URL, fetched_at: '2026-08-30T12:00:00.000Z', models: [] }));
    writeFileSync(join(dir, 'public/aa-raw.json'), JSON.stringify({ source: URL, fetched_at: '2026-08-30T12:00:00.000Z', error: 'fetch_failed', error_detail: 'HTTP 429' }));
    const result = spawnSync(process.execPath, [resolve(process.cwd(), 'scripts/build-data.js')], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'error-flagged AA capture must exit non-zero');
    assert.match(result.stderr, /fetch_failed/);
  });
});

test('pipeline exit codes: AA CLI exits non-zero when the key is missing (subprocess)', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'b7-cli-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/fetch-aa-benchmarks.js'], {
      cwd: dir,
      env: { ...process.env, AA_API_KEY: '' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, 'missing key must exit non-zero');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
