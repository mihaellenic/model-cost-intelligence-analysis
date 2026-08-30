import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchPricing } from '../scripts/fetch-pricing.js';
import { validatePricingCapture } from '../scripts/lib/pricing-data.js';

test('preserves catalog fields needed to validate a description-based collapse', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'b12-pricing-'));
  const outPath = join(dir, 'pricing-raw.json');
  const model = {
    id: 'openai/gpt-5.6-luna-pro',
    name: 'GPT-5.6 Luna Pro',
    description: 'The same underlying model as [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna).',
    pricing: { prompt: '0.000002', completion: '0.000004' },
    context_length: 200000,
    per_request_limits: { prompt_tokens: 100000 },
    supported_parameters: ['reasoning'],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  };
  try {
    await fetchPricing({
      fetchImpl: async () => new Response(JSON.stringify({ data: [model] }), { status: 200 }),
      outPath,
      now: () => '2026-08-30T12:00:00.000Z',
      logger: { log() {} },
    });

    assert.deepEqual(JSON.parse(readFileSync(outPath, 'utf8')), {
      source: 'https://openrouter.ai/api/v1/models',
      fetched_at: '2026-08-30T12:00:00.000Z',
      models: [{
        id: model.id,
        name: model.name,
        prompt_per_1m: 2,
        completion_per_1m: 4,
        context: 200000,
        description: model.description,
        per_request_limits: model.per_request_limits,
        supported_parameters: model.supported_parameters,
        architecture: model.architecture,
      }],
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects missing or non-numeric catalog prices instead of treating them as zero', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'b12-pricing-'));
  const outPath = join(dir, 'pricing-raw.json');
  try {
    const capture = await fetchPricing({
      fetchImpl: async () => new Response(JSON.stringify({ data: [{
        id: 'openrouter/auto-beta',
        name: 'Auto Beta',
        pricing: { prompt: '1' },
      }] }), { status: 200 }),
      outPath,
      logger: { log() {} },
    });
    assert.deepEqual(capture.models, []);

    const sentinelCapture = await fetchPricing({
      fetchImpl: async () => new Response(JSON.stringify({ data: [{
        id: 'openrouter/auto-beta',
        name: 'Auto Beta',
        pricing: { prompt: '-1', completion: '-1' },
      }] }), { status: 200 }),
      outPath,
      logger: { log() {} },
    });
    assert.deepEqual(sentinelCapture.models, []);

    await assert.rejects(() => fetchPricing({
      fetchImpl: async () => new Response(JSON.stringify({ data: [{
        id: 'openai/gpt-5.6-luna',
        name: 'GPT-5.6 Luna',
        pricing: { prompt: 'not-a-number' },
      }] }), { status: 200 }),
      outPath,
      logger: { log() {} },
    }), /pricing\.prompt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refuses pricing error envelopes and missing model arrays downstream', () => {
  assert.throws(() => validatePricingCapture({ error: 'openrouter returned 500' }), /pricing capture error/);
  assert.throws(() => validatePricingCapture({ models: {} }), /models/);
  assert.deepEqual(validatePricingCapture({ models: [] }), []);
});
