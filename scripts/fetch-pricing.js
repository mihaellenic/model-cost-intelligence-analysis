import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const PRICING_URL = 'https://openrouter.ai/api/v1/models';
const DEFAULT_OUT = resolve(process.cwd(), 'public/pricing-raw.json');

function parsePrice(value, field) {
  if (value == null || value === '-1') return null;
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error(`${field} must be a non-negative numeric string`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be finite`);
  return parsed;
}

function round4(value) {
  return Math.round(value * 1e4) / 1e4;
}

export async function fetchPricing({
  fetchImpl = fetch,
  outPath = DEFAULT_OUT,
  now = () => new Date().toISOString(),
  logger = console,
} = {}) {
  mkdirSync(dirname(outPath), { recursive: true });
  logger.log('[fetch-pricing] GET', PRICING_URL);
  const response = await fetchImpl(PRICING_URL, {
    headers: { 'User-Agent': 'model-cost-intelligence-analysis/1.0' },
  });
  if (!response.ok) throw new Error(`openrouter returned ${response.status}`);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('expected OpenRouter response.data to be an array');
  }

  const models = [];
  for (const model of payload.data) {
    const prompt = parsePrice(model.pricing?.prompt, `model ${model?.id ?? '(unknown)'}.pricing.prompt`);
    const completion = parsePrice(model.pricing?.completion, `model ${model?.id ?? '(unknown)'}.pricing.completion`);
    if (prompt == null || completion == null) continue;
    models.push({
      id: model.id,
      name: model.name,
      prompt_per_1m: round4(prompt * 1_000_000),
      completion_per_1m: round4(completion * 1_000_000),
      context: model.context_length ?? null,
      description: model.description,
      per_request_limits: model.per_request_limits,
      supported_parameters: model.supported_parameters,
      architecture: model.architecture,
    });
  }

  const capture = { source: PRICING_URL, fetched_at: now(), models };
  logger.log(`[fetch-pricing] extracted ${models.length} priced models`);
  writeFileSync(outPath, JSON.stringify(capture, null, 2));
  logger.log('[fetch-pricing] wrote', outPath);
  return capture;
}

export async function main() {
  try {
    await fetchPricing();
  } catch (error) {
    console.warn('[fetch-pricing] failed:', error.message);
    mkdirSync(dirname(DEFAULT_OUT), { recursive: true });
    writeFileSync(DEFAULT_OUT, JSON.stringify({
      source: PRICING_URL,
      fetched_at: new Date().toISOString(),
      models: [],
      error: error.message,
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
