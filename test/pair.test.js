import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQualityFloors,
  expectedCost,
  recommendPairs,
} from '../src/lib/pair.js';

const floorModels = [
  { id: 'a', name: 'A', intelligence: 10, cost_per_1m_avg: 1 },
  { id: 'b', name: 'B', intelligence: 20, cost_per_1m_avg: 2 },
  { id: 'c', name: 'C', intelligence: 30, cost_per_1m_avg: 3 },
  { id: 'd', name: 'D', intelligence: 40, cost_per_1m_avg: 4 },
];

test('uses p75 for planning and the median for execution floors', () => {
  assert.deepEqual(computeQualityFloors(floorModels), {
    planning: 32.5,
    execution: 25,
  });
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
