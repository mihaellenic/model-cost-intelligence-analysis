import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchAaBenchmarks } from '../scripts/fetch-aa-benchmarks.js';
import { validateAaCapture } from '../scripts/lib/aa-data.js';
import { buildModelRecords } from '../scripts/build-data.js';

const NOW = '2026-08-30T12:00:00.000Z';
const URL = 'https://artificialanalysis.ai/api/v2/language/models/free';

function aaModel(slug, intelligence = 52.3) {
  return {
    slug,
    name: slug,
    release_date: '2026-08-01',
    model_creator: { name: 'OpenAI' },
    evaluations: {
      artificial_analysis_intelligence_index: intelligence,
      artificial_analysis_coding_index: 66,
      artificial_analysis_agentic_index: 51,
    },
    pricing: { blended_per_million_tokens: 1 },
    performance: { time_to_first_token: 0.5 },
  };
}

async function withCaptureFile(callback) {
  const dir = mkdtempSync(join(tmpdir(), 'b12-aa-'));
  const outPath = join(dir, 'aa-raw.json');
  try {
    await callback(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readCapture(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('writes missing_key without requesting Artificial Analysis', async () => {
  await withCaptureFile(async (outPath) => {
    const result = await fetchAaBenchmarks({
      apiKey: '',
      fetchImpl: () => assert.fail('missing keys must not call fetch'),
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(readCapture(outPath).error, 'missing_key');
  });
});

test('writes fetch_failed for HTTP and mid-pagination network failures', async () => {
  await withCaptureFile(async (outPath) => {
    const http = await fetchAaBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response('rate limited', { status: 429 }),
      outPath,
      now: () => NOW,
    });
    assert.equal(http.ok, false);
    assert.equal(readCapture(outPath).error, 'fetch_failed');

    const pageTwoFails = await fetchAaBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async (url) => {
        if (url.endsWith('?page=1')) {
          return new Response(JSON.stringify({
            intelligence_index_version: 'v4.1',
            pagination: { has_more: true, total_pages: 2 },
            data: [aaModel('gpt-5-6-luna')],
          }), { status: 200 });
        }
        throw new Error('socket closed');
      },
      outPath,
      now: () => NOW,
    });
    assert.equal(pageTwoFails.ok, false);
    assert.equal(readCapture(outPath).error, 'fetch_failed');
    assert.equal(readCapture(outPath).models, undefined);
  });
});

test('writes malformed_response when a page lacks pagination or data array', async () => {
  await withCaptureFile(async (outPath) => {
    const result = await fetchAaBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response(JSON.stringify({ pagination: {}, data: {} }), { status: 200 }),
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(readCapture(outPath).error, 'malformed_response');
  });
});

test('rejects a premature final page when total_pages says more data exists', async () => {
  await withCaptureFile(async (outPath) => {
    const result = await fetchAaBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response(JSON.stringify({
        intelligence_index_version: 'v4.1',
        pagination: { has_more: false, total_pages: 2 },
        data: [aaModel('gpt-5-6-luna')],
      }), { status: 200 }),
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, false);
    assert.equal(readCapture(outPath).error, 'malformed_response');
    assert.equal(readCapture(outPath).models, undefined);
  });
});

test('captures every requested page verbatim and records the version', async () => {
  await withCaptureFile(async (outPath) => {
    const pages = new Map([
      [`${URL}?page=1`, {
        intelligence_index_version: 'v4.1',
        pagination: { has_more: true, total_pages: 2 },
        data: [aaModel('gpt-5-6-luna')],
      }],
      [`${URL}?page=2`, {
        intelligence_index_version: 'v4.1',
        pagination: { has_more: false, total_pages: 2 },
        data: [aaModel('gpt-5-6-sol', 60.9)],
      }],
    ]);
    const requested = [];
    const result = await fetchAaBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async (url, init) => {
        requested.push(url);
        assert.equal(init.headers['x-api-key'], 'test-key');
        return new Response(JSON.stringify(pages.get(url)), { status: 200 });
      },
      outPath,
      now: () => NOW,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(requested, [`${URL}?page=1`, `${URL}?page=2`]);
    assert.deepEqual(readCapture(outPath), {
      source: URL,
      fetched_at: NOW,
      intelligence_index_version: 'v4.1',
      models: [aaModel('gpt-5-6-luna'), aaModel('gpt-5-6-sol', 60.9)],
    });
  });
});

test('flags suspicious AA capture shrink and preserves prior models solely as evidence', async () => {
  await withCaptureFile(async (outPath) => {
    const previous = Array.from({ length: 10 }, (_, index) => aaModel(`model-${index}`));
    writeFileSync(outPath, JSON.stringify({ source: URL, fetched_at: '2026-08-29T00:00:00.000Z', models: previous }));

    const result = await fetchAaBenchmarks({
      apiKey: 'test-key',
      fetchImpl: async () => new Response(JSON.stringify({
        intelligence_index_version: 'v4.1',
        pagination: { has_more: false, total_pages: 1 },
        data: previous.slice(0, 7),
      }), { status: 200 }),
      outPath,
      now: () => NOW,
    });
    const capture = readCapture(outPath);

    assert.equal(result.ok, false);
    assert.equal(capture.error, 'capture_shrink');
    assert.equal(capture.error_detail, 'prior 10, current 7');
    assert.deepEqual(capture.previous_models, previous);
    assert.equal(capture.models, undefined);
  });
});

test('refuses malformed and error-flagged captures downstream', () => {
  assert.throws(() => validateAaCapture({ error: 'fetch_failed', error_detail: 'HTTP 429' }), /fetch_failed/);
  assert.throws(() => validateAaCapture({ models: {} }), /models/);
  assert.deepEqual(validateAaCapture({ models: [aaModel('gpt-5-6-luna')] }), [aaModel('gpt-5-6-luna')]);
});

const allowlist = [{ prefix: 'openai/gpt-', family: 'gpt' }];
const priceList = [
  {
    id: 'openai/gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    prompt_per_1m: 1,
    completion_per_1m: 2,
    context: 200000,
    supported_parameters: ['reasoning'],
    per_request_limits: { prompt_tokens: 100000 },
  },
  {
    id: 'openai/gpt-5.6-luna-pro',
    name: 'GPT-5.6 Luna Pro',
    prompt_per_1m: 2,
    completion_per_1m: 4,
    context: 200000,
    supported_parameters: ['reasoning'],
    per_request_limits: { prompt_tokens: 100000 },
    description: 'The same underlying model as [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna).',
  },
  {
    id: 'openai/gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    prompt_per_1m: 3,
    completion_per_1m: 6,
    context: 200000,
  },
];

test('refuses error-flagged AA captures before producing model records', () => {
  assert.throws(() => buildModelRecords({
    allowlist,
    priceList,
    aaCapture: { error: 'fetch_failed', error_detail: 'HTTP 429' },
    generatedAt: NOW,
  }), /fetch_failed/);
});

test('collapses variants and carries AA values verbatim or as labelled effort medians', () => {
  const output = buildModelRecords({
    allowlist,
    priceList,
    aaCapture: {
      source: URL,
      fetched_at: NOW,
      intelligence_index_version: 'v4.1',
      models: [
        aaModel('gpt-5-6-luna', 52.3),
        aaModel('gpt-5-6-sol-low', 40),
        aaModel('gpt-5-6-sol-high', 60),
      ],
    },
    generatedAt: NOW,
    pricingSource: 'https://openrouter.ai/api/v1/models',
  });

  assert.equal(output.benchmarks_fetched_at, NOW);
  assert.deepEqual(output.models.map((model) => model.id), ['openai/gpt-5.6-luna', 'openai/gpt-5.6-sol']);
  assert.equal(output.models[0].intelligence, 52.3);
  assert.equal(output.models[0].intelligence_source, 'artificial-analysis');
  assert.equal(output.models[0].intelligence_scope, null);
  assert.equal(output.models[1].intelligence, 50);
  assert.equal(output.models[1].intelligence_scope, 'effort-median');
  assert.deepEqual(output.models[1].effort_scores, [40, 60]);
  assert.deepEqual(output.audit.collapses, [{
    variant_id: 'openai/gpt-5.6-luna-pro',
    base_id: 'openai/gpt-5.6-luna',
    matched_phrase: 'same underlying model as',
  }]);
});
