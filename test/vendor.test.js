import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVendorPair,
  computeVendorRows,
  vendorOf,
} from '../src/lib/vendor.js';
import { computeLensCard } from '../src/lib/lens.js';

const MIX = { planning: 65, execution: 30, verification: 5 };

const glmFlash = {
  id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash', family: 'glm',
  intelligence: 57.5, cost_per_1m_avg: 0.1625,
};
const twinFlash = {
  id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', family: 'deepseek',
  intelligence: 51.8, cost_per_1m_avg: 0.1181,
};
const deepseekV4Pro = {
  id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', family: 'deepseek',
  intelligence: 53.2, cost_per_1m_avg: 0.6259,
};

// Left-skewed filler keeps the execution floor (median) low, mirroring live
// data where cheap executors sit well above the median.
function lowModels(count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    id: `filler/low-${i}`, name: `Low ${i}`, family: 'qwen',
    intelligence: 20 + i * 2, cost_per_1m_avg: 4 + i * 0.5,
  }));
}

function baseFixture(extra = []) {
  return [glmFlash, twinFlash, deepseekV4Pro, ...lowModels(), ...extra];
}

test('vendorOf returns the OpenRouter ID prefix', () => {
  assert.equal(vendorOf('anthropic/claude-opus-5'), 'anthropic');
  assert.equal(vendorOf('openai/gpt-5.6-sol'), 'openai');
  assert.equal(vendorOf('no-slash'), 'no-slash');
});

test('vendors rank by best planner; a tie is broken by execution depth', () => {
  const models = baseFixture([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', family: 'gpt', intelligence: 52.3, cost_per_1m_avg: 0.7 },
    { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra', family: 'gpt', intelligence: 56.6, cost_per_1m_avg: 7 },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'x-ai/grok-4.3', name: 'Grok 4.3', family: 'grok', intelligence: 37.9, cost_per_1m_avg: 1.875 },
  ]);
  const { topRows } = computeVendorRows(models, MIX);

  // anthropic (63.1) first; openai and x-ai tie at 60.9, openai's deeper
  // execution bench (3 floor-qualifying models vs x-ai's 2) wins slot 2.
  assert.equal(topRows.length, 2);
  assert.equal(topRows[0].vendor, 'anthropic');
  assert.equal(topRows[1].vendor, 'openai');
  assert.notEqual(topRows[1].vendor, 'x-ai');
});

test('depth counts only floor-qualifying models; below-floor models do not inflate it', () => {
  const models = [...lowModels(10), glmFlash, twinFlash, deepseekV4Pro,
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', family: 'gpt', intelligence: 52.3, cost_per_1m_avg: 0.7 },
    { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra', family: 'gpt', intelligence: 56.6, cost_per_1m_avg: 7 },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'x-ai/grok-4.3', name: 'Grok 4.3', family: 'grok', intelligence: 37.9, cost_per_1m_avg: 1.875 },
    { id: 'x-ai/grok-4.2', name: 'Grok 4.2', family: 'grok', intelligence: 10, cost_per_1m_avg: 0.1 },
    { id: 'x-ai/grok-4.1', name: 'Grok 4.1', family: 'grok', intelligence: 5, cost_per_1m_avg: 0.05 },
    { id: 'x-ai/grok-4.0', name: 'Grok 4.0', family: 'grok', intelligence: 2, cost_per_1m_avg: 0.01 },
  ];
  const { topRows } = computeVendorRows(models, MIX);

  // openai and x-ai tie on best planner (60.9). openai's 3 floor-qualifying
  // models beat x-ai's 2 — x-ai's three below-floor models (10, 5, 2) must
  // NOT count toward depth, or x-ai would wrongly win the tie-break.
  assert.equal(topRows[0].vendor, 'openai');
  assert.equal(topRows[1].vendor, 'x-ai');
});

test('vendor pair: argmax planner + cheapest legal executor, D19 fallback, honest absence', () => {
  const floors = { planning: 55.1, execution: 33.05, max: 63.1 };

  // Cheapest executor (grok-4.3-twin) fails D19 (same price, same score as
  // planner); the rule falls back to the next cheapest legal executor.
  const fallback = buildVendorPair([
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'x-ai/grok-4.6-twin', name: 'Grok 4.6 Twin', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'x-ai/grok-4.3', name: 'Grok 4.3', family: 'grok', intelligence: 37.9, cost_per_1m_avg: 1.875 },
  ], floors, MIX);
  assert.equal(fallback.planning.id, 'x-ai/grok-4.6');
  assert.equal(fallback.execution.id, 'x-ai/grok-4.3');
  assert.notEqual(fallback.execution.id, 'x-ai/grok-4.6-twin');

  // No planner above the planning floor → honest absence.
  assert.equal(buildVendorPair([
    { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', family: 'deepseek', intelligence: 51.8, cost_per_1m_avg: 0.1181 },
  ], floors, MIX), null);

  // Planner present but no legal executor (only the planner itself and its
  // D17 child qualify) → honest absence.
  const noExecutor = buildVendorPair([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-opus-5-fast', name: 'Claude Opus 5 (Fast)', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 30, inherit_from: 'anthropic/claude-opus-5' },
  ], floors, MIX);
  assert.equal(noExecutor, null);
});

test('vendor pair excludes the planner\'s D17 variant children (inherit_from)', () => {
  const floors = { planning: 55.1, execution: 33.05, max: 63.1 };
  const pair = buildVendorPair([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-opus-5-fast', name: 'Claude Opus 5 (Fast)', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 30, inherit_from: 'anthropic/claude-opus-5' },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
  ], floors, MIX);

  assert.equal(pair.planning.id, 'anthropic/claude-opus-5');
  assert.equal(pair.execution.id, 'anthropic/claude-sonnet-5');
  assert.notEqual(pair.execution.id, 'anthropic/claude-opus-5-fast',
    'opus-5-fast must NOT be picked as opus-5\'s vendor executor');
});

test('no-brand-lock: a "new" vendor topping the frontier gets a top row with no allowlist change', () => {
  const models = baseFixture([
    { id: 'acme/acme-omni', name: 'Acme Omni', family: 'acme', intelligence: 64.2, cost_per_1m_avg: 8 },
    { id: 'acme/acme-lite', name: 'Acme Lite', family: 'acme', intelligence: 50, cost_per_1m_avg: 0.5 },
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
  ]);
  const { topRows } = computeVendorRows(models, MIX);

  assert.equal(topRows[0].vendor, 'acme');
  assert.equal(topRows[0].planning.id, 'acme/acme-omni');
  assert.equal(topRows[0].execution.id, 'acme/acme-lite');
});

test('collapsed-chrome headline data is present regardless of collapsed state', () => {
  const card = computeLensCard(baseFixture([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', family: 'claude', intelligence: 62.1, cost_per_1m_avg: 30 },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
  ]), MIX);

  assert.ok(card.ceiling, 'ceiling must exist for its headline number');
  assert.ok(card.ceiling.vs_anchor > 1, 'ceiling multiple must be computed');
  assert.ok(card.lenses.length >= 1, 'lenses must exist for their headline prices');
  assert.ok(card.lenses.every((lens) => Number.isFinite(lens.expected_cost)));
  assert.ok(card.vendors.allVendors.length >= 1);
});

test('layout contract: top-level is [Row 1, vendor × N]; lenses/ceiling/ranking intact', () => {
  const card = computeLensCard(baseFixture([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', family: 'gpt', intelligence: 52.3, cost_per_1m_avg: 0.7 },
  ]), MIX);

  assert.equal(card.topRows[0].type, 'minimize-spend');
  assert.equal(card.topRows[0].planning.id, glmFlash.id);
  assert.equal(card.topRows.length, 3, 'exactly [Row 1, vendor, vendor] top-level');
  assert.equal(card.topRows[1].type, 'vendor');
  assert.equal(card.topRows[2].type, 'vendor');

  // Demoted rows still present with their own data.
  assert.ok(card.lenses.length >= 1);
  assert.ok(card.ceiling);
  assert.ok(card.ranking.length >= 3);
  assert.deepEqual(
    [card.ranking[0].planning.id, card.ranking[0].execution.id],
    [card.row1.planning.id, card.row1.execution.id],
  );

  // Vendor rows are constraint views, never "recommended".
  for (const row of card.topRows.slice(1)) {
    assert.equal(row.type, 'vendor');
    assert.ok(row.vendor);
  }
});

test('fewer than 2 legal-pair vendors renders fewer top-level rows (honest count)', () => {
  const models = baseFixture([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
  ]);
  const { topRows, allVendors } = computeVendorRows(models, MIX);

  assert.equal(topRows.length, 1, 'only anthropic can field a legal pair');
  assert.equal(topRows[0].vendor, 'anthropic');
  assert.equal(allVendors.length, 1);
});

test('a vendor that cannot field a legal pair is absent from top rows and listed honestly', () => {
  const models = baseFixture([
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-sol-twin', name: 'GPT-5.6 Sol Twin', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
  ]);
  const { topRows, allVendors } = computeVendorRows(models, MIX);

  // openai's only floor-qualifying models are the sol twins (same price, same
  // score → D19 fails); it cannot field a legal pair and must not take a slot.
  assert.equal(topRows.length, 1);
  assert.equal(topRows[0].vendor, 'anthropic');
  assert.ok(!allVendors.some((entry) => entry.vendor === 'openai'));
});

test('all-vendors list orders by expected-$ ascending', () => {
  const models = [...lowModels(10), glmFlash, twinFlash, deepseekV4Pro,
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', family: 'claude', intelligence: 55.3, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
    { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', family: 'gpt', intelligence: 52.3, cost_per_1m_avg: 0.7 },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'x-ai/grok-4.3', name: 'Grok 4.3', family: 'grok', intelligence: 37.9, cost_per_1m_avg: 1.875 },
  ];
  const { allVendors } = computeVendorRows(models, MIX);

  const costs = allVendors.map((entry) => entry.pair.expected_cost);
  assert.deepEqual(costs, costs.slice().sort((a, b) => a - b));
  assert.ok(allVendors.length >= 3, 'x-ai appears in the expanded list despite losing the tie-break');
});
