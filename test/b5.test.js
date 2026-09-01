import test from 'node:test';
import assert from 'node:assert/strict';
import { tooltipLines } from '../src/lib/tooltip.js';
import { DEFAULT_MIX, DEFAULT_BAND, computeQualityFloors, recommendPairs } from '../src/lib/pair.js';

// B5 Part A — frozen-params contract (D23). The UI imports DEFAULT_MIX /
// DEFAULT_BAND as its only source of mix/band; the decision layer still takes
// them as parameters. These tests pin the constants and prove the card's
// floors line (computed from the constants) matches the pure layer.
test('frozen params: DEFAULT_MIX is 65/30/5 and DEFAULT_BAND is 8', () => {
  assert.deepEqual(DEFAULT_MIX, { planning: 65, execution: 30, verification: 5 });
  assert.equal(DEFAULT_BAND, 8);
});

test('frozen params: floors computed from the constants match explicit 65/30/5 + band 8', () => {
  const models = [
    { id: 'a', name: 'A', intelligence: 10, cost_per_1m_avg: 1 },
    { id: 'b', name: 'B', intelligence: 20, cost_per_1m_avg: 2 },
    { id: 'c', name: 'C', intelligence: 30, cost_per_1m_avg: 3 },
    { id: 'd', name: 'D', intelligence: 40, cost_per_1m_avg: 4 },
  ];
  const fromConstants = computeQualityFloors(models, DEFAULT_BAND);
  const fromExplicit = computeQualityFloors(models, 8);
  assert.deepEqual(fromConstants, fromExplicit);
  assert.equal(fromConstants.bandWidth, 8);
  assert.equal(fromConstants.planning, 32);
});

test('frozen params: recommendPairs with the constants equals explicit 65/30/5 + band 8', () => {
  const models = [
    { id: 'a', name: 'A', intelligence: 10, cost_per_1m_avg: 1 },
    { id: 'b', name: 'B', intelligence: 20, cost_per_1m_avg: 2 },
    { id: 'c', name: 'C', intelligence: 30, cost_per_1m_avg: 3 },
    { id: 'd', name: 'D', intelligence: 40, cost_per_1m_avg: 4 },
  ];
  const viaConstants = recommendPairs(models, DEFAULT_MIX, false, DEFAULT_BAND);
  const viaExplicit = recommendPairs(models, { planning: 65, execution: 30, verification: 5 }, false, 8);
  assert.deepEqual(viaConstants.pairs, viaExplicit.pairs);
  assert.deepEqual(viaConstants.floors, viaExplicit.floors);
});

// B5 Part B — tooltip lines. Values are verbatim record pass-throughs with
// the same rounding as elsewhere (D4); nulls render `—` and the per-type line
// is always present.
test('tooltip: coding/agentic values render with one decimal, line always present', () => {
  const lines = tooltipLines({
    id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash', family: 'glm',
    intelligence: 57.5, intelligence_source: 'artificial-analysis',
    coding_index: 71.5, agentic_index: 58.2,
    cost_per_1m_avg: 0.1625, cheapest_provider: { name: 'z-ai/glm-5.3-flash' },
    context_length: 1310720,
  });
  assert.ok(lines.includes('Coding index: 71.5 · Agentic index: 58.2'));
  assert.ok(lines.includes('Intelligence: 57.50'));
  assert.ok(lines.includes('Cost: $0.1625 / 1M (avg)'));
  assert.ok(lines.includes(`Context: ${(1310720).toLocaleString()} tokens`));
});

test('tooltip: null coding/agentic render —, the line is never omitted', () => {
  const lines = tooltipLines({
    id: 'x', name: 'X', family: 'f',
    intelligence: 50, intelligence_source: 'artificial-analysis',
    coding_index: null, agentic_index: null,
    cost_per_1m_avg: 1,
  });
  assert.ok(lines.includes('Coding index: — · Agentic index: —'));
});

test('tooltip: integer index values render with one decimal (no formatting drift)', () => {
  const lines = tooltipLines({
    id: 'anthropic/claude-opus-5-fast', name: 'Claude Opus 5 (Fast)', family: 'claude',
    intelligence: 63.1, intelligence_source: 'artificial-analysis',
    coding_index: 78, agentic_index: 59.2,
    cost_per_1m_avg: 30,
  });
  assert.ok(lines.includes('Coding index: 78.0 · Agentic index: 59.2'));
});

test('tooltip: intelligence_scope labels still render (effort-median, variant-inherited, manual)', () => {
  const effort = tooltipLines({
    id: 'e', name: 'E', family: 'f', intelligence: 50,
    intelligence_source: 'artificial-analysis', intelligence_scope: 'effort-median',
    coding_index: null, agentic_index: null, cost_per_1m_avg: 1,
  });
  assert.ok(effort.includes('Intelligence: effort-variant median'));

  const inherited = tooltipLines({
    id: 'v', name: 'V', family: 'f', intelligence: 50,
    intelligence_source: 'artificial-analysis', intelligence_scope: 'variant-inherited',
    inherit_from: 'anthropic/claude-opus-5',
    coding_index: null, agentic_index: null, cost_per_1m_avg: 1,
  });
  assert.ok(inherited.includes('Intelligence: inherited from anthropic/claude-opus-5'));

  const manual = tooltipLines({
    id: 'm', name: 'M', family: 'f', intelligence: 50,
    intelligence_source: 'manual', intelligence_scope: null,
    coding_index: null, agentic_index: null, cost_per_1m_avg: 1,
  });
  assert.ok(manual.includes('Intelligence: manual override (cited)'));
});

test('tooltip: null intelligence renders — and the per-type line still appears', () => {
  const lines = tooltipLines({
    id: 'n', name: 'N', family: 'f',
    intelligence: null, intelligence_source: null,
    coding_index: null, agentic_index: null,
    cost_per_1m_avg: 0.5,
  });
  assert.ok(lines.includes('Intelligence: —'));
  assert.ok(lines.includes('Coding index: — · Agentic index: —'));
});
