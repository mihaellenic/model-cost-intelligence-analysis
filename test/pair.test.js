import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQualityFloors,
  expectedCost,
  recommendPairs,
  satisfiesSeparation,
} from '../src/lib/pair.js';

const floorModels = [
  { id: 'a', name: 'A', intelligence: 10, cost_per_1m_avg: 1 },
  { id: 'b', name: 'B', intelligence: 20, cost_per_1m_avg: 2 },
  { id: 'c', name: 'C', intelligence: 30, cost_per_1m_avg: 3 },
  { id: 'd', name: 'D', intelligence: 40, cost_per_1m_avg: 4 },
];

test('uses the frontier band (max − 8) for planning and the median for execution floors', () => {
  assert.deepEqual(computeQualityFloors(floorModels), {
    planning: 32,
    execution: 25,
    bandWidth: 8,
    max: 40,
  });
});

test('frontier band admits exactly the frontier models in the fixture', () => {
  const result = recommendPairs(floorModels, { planning: 65, execution: 30, verification: 5 }, false);

  const planningIds = new Set(result.pairs.map((pair) => pair.planning.id));
  assert.deepEqual([...planningIds].sort(), ['d']);
});

test('band control: band 0 admits only the top model, band 20 admits a wider pool', () => {
  const band0 = recommendPairs(floorModels, { planning: 65, execution: 30, verification: 5 }, false, 0);
  const band20 = recommendPairs(floorModels, { planning: 65, execution: 30, verification: 5 }, false, 20);

  assert.deepEqual(
    new Set(band0.pairs.map((pair) => pair.planning.id)),
    new Set(['d']),
  );
  assert.deepEqual(
    new Set(band20.pairs.map((pair) => pair.planning.id)),
    new Set(['b', 'c', 'd']),
  );
});

test('band change re-ranks pairs', () => {
  const band0 = recommendPairs(floorModels, { planning: 65, execution: 30, verification: 5 }, false, 0);
  const band20 = recommendPairs(floorModels, { planning: 65, execution: 30, verification: 5 }, false, 20);

  assert.notDeepEqual(
    band0.pairs.map((pair) => pair.planning.id),
    band20.pairs.map((pair) => pair.planning.id),
  );
});

test('DeepSeek-twin regression: same-score near-price twins form no pair in either ordering', () => {
  const twins = [
    { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', intelligence: 51.8, cost_per_1m_avg: 0.1181 },
    { id: 'deepseek/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash 0731', intelligence: 51.8, cost_per_1m_avg: 0.1225 },
    { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', intelligence: 63.1, cost_per_1m_avg: 15 },
  ];

  const result = recommendPairs(twins, { planning: 65, execution: 30, verification: 5 }, false);

  const twinIds = new Set(twins.slice(0, 2).map((model) => model.id));
  for (const pair of result.pairs) {
    assert.ok(!(twinIds.has(pair.planning.id) && twinIds.has(pair.execution.id)),
      `twin mirror-pair formed: ${pair.planning.id} ↔ ${pair.execution.id}`);
  }
});

test('D19 separation: 1.5× price path qualifies at exactly 1.5×', () => {
  const separation = satisfiesSeparation(
    { intelligence: 10, cost_per_1m_avg: 1.5 },
    { intelligence: 10, cost_per_1m_avg: 1 },
  );
  assert.equal(separation.pricePath, true);
  assert.equal(separation.scorePath, false);
});

test('D19 separation: 2.0-point path qualifies at exactly 2.0', () => {
  const separation = satisfiesSeparation(
    { intelligence: 60, cost_per_1m_avg: 1 },
    { intelligence: 58, cost_per_1m_avg: 1 },
  );
  assert.equal(separation.pricePath, false);
  assert.equal(separation.scorePath, true);
});

test('D19 separation: neither path → rejected', () => {
  const separation = satisfiesSeparation(
    { intelligence: 60, cost_per_1m_avg: 1.4 },
    { intelligence: 58.5, cost_per_1m_avg: 1 },
  );
  assert.equal(separation.pricePath, false);
  assert.equal(separation.scorePath, false);
});

test('D19 zero-cost edge: price path cannot pass; score path is the only path', () => {
  const sameScore = satisfiesSeparation(
    { intelligence: 60, cost_per_1m_avg: 0 },
    { intelligence: 60, cost_per_1m_avg: 1 },
  );
  assert.equal(sameScore.pricePath, false);
  assert.equal(sameScore.scorePath, false);

  const realGap = satisfiesSeparation(
    { intelligence: 60, cost_per_1m_avg: 0 },
    { intelligence: 58, cost_per_1m_avg: 1 },
  );
  assert.equal(realGap.pricePath, false);
  assert.equal(realGap.scorePath, true);
});

test('null-intelligence models are excluded from both slots and from the max/median computation', () => {
  const models = [
    { id: 'a', name: 'A', intelligence: 60, cost_per_1m_avg: 1 },
    { id: 'b', name: 'B', intelligence: 50, cost_per_1m_avg: 0.5 },
    { id: 'n', name: 'N', intelligence: null, cost_per_1m_avg: 0.1 },
    { id: 'z', name: 'Z', intelligence: 100, cost_per_1m_avg: 0 },
  ];

  const floors = computeQualityFloors(models);
  assert.equal(floors.max, 60);
  assert.equal(floors.planning, 52);
  assert.equal(floors.execution, 55);

  const result = recommendPairs(models, { planning: 65, execution: 30, verification: 5 }, false);
  for (const pair of result.pairs) {
    assert.notEqual(pair.planning.id, 'n');
    assert.notEqual(pair.execution.id, 'n');
    assert.notEqual(pair.planning.id, 'z');
    assert.notEqual(pair.execution.id, 'z');
  }
});

test('no-qualifying-pair state names the binding floor with frontier-band wording', () => {
  const result = recommendPairs([
    { id: 'a', name: 'A', intelligence: 60, cost_per_1m_avg: 1 },
    { id: 'b', name: 'B', intelligence: 30, cost_per_1m_avg: 0.5 },
  ], { planning: 65, execution: 30, verification: 5 }, false);

  assert.equal(result.pairs.length, 0);
  assert.match(result.reason, /frontier band −8 → ≥52\.0/);
  assert.match(result.reason, /planning floor/);
});

test('requires distinct planning and execution models', () => {
  const result = recommendPairs(floorModels, { planning: 65, execution: 30, verification: 5 }, false);

  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].planning.id, 'd');
  assert.equal(result.pairs[0].execution.id, 'c');
  assert.notEqual(result.pairs[0].planning.id, result.pairs[0].execution.id);
});

test('normalizes the mix and re-ranks the cheapest role assignment', () => {
  const models = [
    { id: 'a', name: 'A', intelligence: 100, cost_per_1m_avg: 10 },
    { id: 'b', name: 'B', intelligence: 100, cost_per_1m_avg: 1 },
    { id: 'c', name: 'C', intelligence: 50, cost_per_1m_avg: 5 },
    { id: 'd', name: 'D', intelligence: 20, cost_per_1m_avg: 2 },
    { id: 'e', name: 'E', intelligence: 0, cost_per_1m_avg: 2 },
  ];

  const planningHeavy = recommendPairs(models, { planning: 80, execution: 20, verification: 0 }, false);
  const executionHeavy = recommendPairs(models, { planning: 20, execution: 80, verification: 0 }, false);

  assert.deepEqual(
    [planningHeavy.pairs[0].planning.id, planningHeavy.pairs[0].execution.id],
    ['b', 'c'],
  );
  assert.deepEqual(
    [executionHeavy.pairs[0].planning.id, executionHeavy.pairs[0].execution.id],
    ['a', 'b'],
  );
});

test('adds execution-model verification cost only when model verification is enabled', () => {
  const planning = { cost_per_1m_avg: 10 };
  const execution = { cost_per_1m_avg: 2 };
  const mix = { planning: 65, execution: 30, verification: 5 };

  assert.ok(Math.abs(expectedCost(planning, execution, mix, false) - 7.1) < 1e-12);
  assert.ok(Math.abs(expectedCost(planning, execution, mix, true) - 7.2) < 1e-12);
});

test('reports the distinct-model constraint instead of relaxing a floor', () => {
  const result = recommendPairs([
    { id: 'only', name: 'Only', intelligence: 80, cost_per_1m_avg: 2 },
  ], { planning: 65, execution: 30, verification: 5 }, false);

  assert.equal(result.pairs.length, 0);
  assert.match(result.reason, /distinct/i);
  assert.match(result.reason, /planning floor/i);
});
