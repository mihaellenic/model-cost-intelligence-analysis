import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLensCard,
  capabilityCeiling,
  executionStepUp,
  planningStepUp,
} from '../src/lib/lens.js';

const MIX = { planning: 65, execution: 30, verification: 5 };

const twinFlash = {
  id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', family: 'deepseek',
  intelligence: 51.8, cost_per_1m_avg: 0.1181,
};
const twinFlash0731 = {
  id: 'deepseek/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash 0731', family: 'deepseek',
  intelligence: 51.8, cost_per_1m_avg: 0.1225,
};
const glmFlash = {
  id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash', family: 'glm',
  intelligence: 57.5, cost_per_1m_avg: 0.1625,
};
const deepseekV4Pro = {
  id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', family: 'deepseek',
  intelligence: 53.2, cost_per_1m_avg: 0.6259,
};

// Left-skewed filler pool keeps the execution floor (median) low, mirroring
// live data where cheap executors sit well above the median. Prices are kept
// above the executors under test so they never become the cheapest executor.
function lowModels(count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    id: `filler/low-${i}`, name: `Low ${i}`, family: 'qwen',
    intelligence: 20 + i * 2, cost_per_1m_avg: 4 + i * 0.5,
  }));
}

function baseFixture(extra = []) {
  return [glmFlash, twinFlash, twinFlash0731, deepseekV4Pro, ...lowModels(), ...extra];
}

test('DeepSeek-twin cross-pairs appear nowhere in the lens card or its ranking view', () => {
  const card = computeLensCard(baseFixture([
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
  ]), MIX);

  const twinIds = new Set([twinFlash.id, twinFlash0731.id]);
  for (const row of card.rows) {
    assert.ok(!(twinIds.has(row.planning.id) && twinIds.has(row.execution.id)),
      `twin cross-pair rendered: ${row.planning.id} ↔ ${row.execution.id}`);
  }
  for (const pair of card.ranking) {
    assert.ok(!(twinIds.has(pair.planning.id) && twinIds.has(pair.execution.id)),
      `twin cross-pair in ranking view: ${pair.planning.id} ↔ ${pair.execution.id}`);
  }
});

test('+0.2-pt planner does NOT qualify lens 2; a +3.4-pt different-family planner does', () => {
  const models = baseFixture([
    { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', family: 'gpt', intelligence: 57.7, cost_per_1m_avg: 0.7 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
  ]);
  const lens2 = planningStepUp(models, MIX);

  assert.equal(lens2.planning.id, 'openai/gpt-5.6-sol');
  assert.notEqual(lens2.planning.id, 'openai/gpt-5.6-luna');
  assert.ok(lens2.planning.intelligence >= glmFlash.intelligence + 3.0);
});

test('lens 2 family guard blocks a same-family step-up despite Δ≥3', () => {
  const models = baseFixture([
    { id: 'z-ai/glm-5.3', name: 'GLM 5.3', family: 'glm', intelligence: 60.6, cost_per_1m_avg: 2.9 },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.5, cost_per_1m_avg: 4 },
  ]);
  const lens2 = planningStepUp(models, MIX);

  assert.equal(lens2.planning.id, 'x-ai/grok-4.6');
  assert.notEqual(lens2.planning.id, 'z-ai/glm-5.3');
});

test('lens 2 falls back to the next cheapest executor when D19 blocks the cheapest', () => {
  const models = [
    glmFlash,
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'x-ai/grok-4.6-twin', name: 'Grok 4.6 Twin', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4.5 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
    { id: 'moonshotai/kimi-k3', name: 'Kimi K3', family: 'kimi', intelligence: 59.7, cost_per_1m_avg: 9 },
    { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', family: 'claude', intelligence: 62.1, cost_per_1m_avg: 30 },
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
  ];
  const lens2 = planningStepUp(models, MIX);

  assert.equal(lens2.planning.id, 'x-ai/grok-4.6');
  assert.equal(lens2.execution.id, 'openai/gpt-5.6-sol');
  assert.notEqual(lens2.execution.id, 'x-ai/grok-4.6-twin');
});

test('lens 2 renders nothing when no planner meets Δ+3 and the family guard', () => {
  const models = baseFixture([
    { id: 'z-ai/glm-5.3', name: 'GLM 5.3', family: 'glm', intelligence: 61, cost_per_1m_avg: 2.9 },
  ]);
  assert.equal(planningStepUp(models, MIX), null);
});

test('lens 3 price ceiling: a $30 executor is excluded when a $4 executor ties its intelligence', () => {
  const models = [
    { ...glmFlash, cost_per_1m_avg: 2 },
    { id: 'deepseek/exec-cheap', name: 'Exec Cheap', family: 'deepseek', intelligence: 50, cost_per_1m_avg: 0.5 },
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.5, cost_per_1m_avg: 4 },
    { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', family: 'claude', intelligence: 60.5, cost_per_1m_avg: 30 },
    ...lowModels(),
  ];
  const lens3 = executionStepUp(models, MIX);

  assert.equal(lens3.planning.id, glmFlash.id);
  assert.equal(lens3.execution.id, 'x-ai/grok-4.6');
  assert.notEqual(lens3.execution.id, 'anthropic/claude-fable-5');
});

test('lens 3 includes a $30 executor when the affordable one has lower intelligence', () => {
  const models = [
    { ...glmFlash, cost_per_1m_avg: 4 },
    { id: 'deepseek/exec-cheap', name: 'Exec Cheap', family: 'deepseek', intelligence: 50, cost_per_1m_avg: 3 },
    { id: 'x-ai/grok-4.5', name: 'Grok 4.5', family: 'grok', intelligence: 55.8, cost_per_1m_avg: 4 },
    { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', family: 'claude', intelligence: 60.5, cost_per_1m_avg: 30 },
    ...lowModels(),
  ];
  const lens3 = executionStepUp(models, MIX);

  assert.equal(lens3.planning.id, glmFlash.id);
  assert.equal(lens3.execution.id, 'anthropic/claude-fable-5');
  assert.notEqual(lens3.execution.id, 'x-ai/grok-4.5');
});

test('lens 3 skips when its pair equals Row 1', () => {
  const models = [
    glmFlash,
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'deepseek/exec-cheap', name: 'Exec Cheap', family: 'deepseek', intelligence: 50, cost_per_1m_avg: 0.1181 },
    { id: 'deepseek/exec-2', name: 'Exec 2', family: 'deepseek', intelligence: 48, cost_per_1m_avg: 0.2 },
    ...lowModels(),
  ];
  const card = computeLensCard(models, MIX);

  assert.equal(card.row1.planning.id, glmFlash.id);
  assert.equal(card.row1.execution.id, 'deepseek/exec-cheap');
  assert.ok(!card.lenses.some((lens) => lens.type === 'execution-step-up'));
});

test('all lens rows still enforce floors and D19 separation', () => {
  const card = computeLensCard(baseFixture([
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
  ]), MIX);

  assert.ok(card.rows.length >= 2);
  for (const row of card.rows) {
    assert.ok(row.planning.intelligence >= card.floors.planning);
    assert.ok(row.execution.intelligence >= card.floors.execution);
    assert.ok(row.separation.pricePath || row.separation.scorePath,
      `row ${row.type} fails D19`);
  }
});

test('ranking view data is the true ranked list starting at position 2', () => {
  const card = computeLensCard(baseFixture(), MIX);

  assert.ok(card.ranking.length >= 3);
  assert.deepEqual(
    [card.ranking[0].planning.id, card.ranking[0].execution.id],
    [card.row1.planning.id, card.row1.execution.id],
  );
  assert.notDeepEqual(
    [card.ranking[1].planning.id, card.ranking[1].execution.id],
    [card.ranking[0].planning.id, card.ranking[0].execution.id],
  );
});

test('ceiling execution EXCLUDES the planner\'s D17/D15 variant children (inherit_from)', () => {
  const models = [
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 15 },
    { id: 'anthropic/claude-opus-5-fast', name: 'Claude Opus 5 (Fast)', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 30, inherit_from: 'anthropic/claude-opus-5' },
    { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', family: 'claude', intelligence: 62.1, cost_per_1m_avg: 30 },
    twinFlash,
    ...lowModels(),
  ];
  const ceiling = capabilityCeiling(models, MIX);

  assert.equal(ceiling.planning.id, 'anthropic/claude-opus-5');
  assert.equal(ceiling.execution.id, 'anthropic/claude-fable-5');
  assert.notEqual(ceiling.execution.id, 'anthropic/claude-opus-5-fast',
    'opus-5-fast must NOT be picked as opus-5\'s ceiling executor');
});

test('ceiling: degenerate all-equal-intelligence data skips the row without a fabricated pair', () => {
  const models = Array.from({ length: 6 }, (_, i) => ({
    id: `a/top-${i}`, name: `Top ${i}`, family: 'claude', intelligence: 60, cost_per_1m_avg: i + 1,
  }));
  assert.equal(capabilityCeiling(models, MIX), null);
});

test('ceiling: a pair failing D19 (same price, same score) is skipped, not substituted', () => {
  const models = [
    { id: 'a/dup1', name: 'Dup1', family: 'claude', intelligence: 60, cost_per_1m_avg: 1 },
    { id: 'a/dup2', name: 'Dup2', family: 'claude', intelligence: 60, cost_per_1m_avg: 1 },
    twinFlash,
    ...lowModels(),
  ];
  assert.equal(capabilityCeiling(models, MIX), null);
});

test('ceiling computes the vs-anchor multiple and is omitted when it repeats another row', () => {
  const opus5 = { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 0.3 };
  const opus5Fast = { id: 'anthropic/claude-opus-5-fast', name: 'Claude Opus 5 (Fast)', family: 'claude', intelligence: 63.1, cost_per_1m_avg: 30, inherit_from: 'anthropic/claude-opus-5' };
  const fable5 = { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', family: 'claude', intelligence: 62.1, cost_per_1m_avg: 0.5 };

  // opus-5 is the cheapest planner AND fable-5 the cheapest executor, so Row 1
  // is exactly the ceiling pair — the ceiling must be skipped as a repeat.
  const repeatCard = computeLensCard([opus5, opus5Fast, fable5, ...lowModels()], MIX);
  assert.equal(repeatCard.row1.planning.id, 'anthropic/claude-opus-5');
  assert.equal(repeatCard.row1.execution.id, 'anthropic/claude-fable-5');
  assert.equal(repeatCard.ceiling, null, 'ceiling repeats Row 1 and must be skipped');

  // With a cheaper executor present, Row 1 diverges from the ceiling and the
  // vs-anchor multiple is computed.
  const anchorCard = computeLensCard([
    { ...opus5, cost_per_1m_avg: 15 },
    opus5Fast,
    { ...fable5, cost_per_1m_avg: 30 },
    twinFlash,
    ...lowModels(),
  ], MIX);
  assert.equal(anchorCard.row1.execution.id, twinFlash.id);
  assert.equal(anchorCard.ceiling.planning.id, 'anthropic/claude-opus-5');
  assert.equal(anchorCard.ceiling.execution.id, 'anthropic/claude-fable-5');
  assert.ok(anchorCard.ceiling.vs_anchor > 1);
});

test('no qualifying pair: row 1 absent, lenses and ceiling all skipped', () => {
  const card = computeLensCard([
    { id: 'a/only', name: 'Only', family: 'claude', intelligence: 80, cost_per_1m_avg: 2 },
  ], MIX);

  assert.equal(card.row1, null);
  assert.deepEqual(card.rows, []);
  assert.match(card.reason, /No qualifying pair/i);
});

test('lens 2 picks the cheapest qualifying planner when multiple meet the step (grok-4.6 over sol)', () => {
  const models = baseFixture([
    { id: 'x-ai/grok-4.6', name: 'Grok 4.6', family: 'grok', intelligence: 60.9, cost_per_1m_avg: 4 },
    { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'gpt', intelligence: 60.9, cost_per_1m_avg: 6 },
  ]);
  const lens2 = planningStepUp(models, MIX);

  assert.equal(lens2.planning.id, 'x-ai/grok-4.6');
  assert.equal(lens2.execution.id, twinFlash.id);
});
