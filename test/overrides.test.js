import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyIntelligenceOverrides,
  validateIntelligenceOverrides,
} from '../scripts/lib/intelligence-overrides.js';

function record(id, intelligence = null) {
  return {
    id,
    name: id,
    family: 'test',
    intelligence,
    intelligence_source: intelligence == null ? null : 'artificial-analysis',
    coding_index: null,
    agentic_index: null,
    intelligence_scope: null,
    cost_per_1m_avg: 1,
  };
}

const override = (overrides = {}) => ({
  model_id: 'vendor/model',
  intelligence: 41.1,
  coding_index: null,
  agentic_index: null,
  source_url: 'https://artificialanalysis.ai/models/vendor-model',
  source_type: 'aa-web',
  captured_at: '2026-08-30',
  note: 'verified',
  ...overrides,
});

test('applies an override only when the AA join returned null (live score wins)', () => {
  const unscored = applyIntelligenceOverrides([record('vendor/model')], [override()]);
  assert.equal(unscored.models[0].intelligence, 41.1);
  assert.equal(unscored.models[0].intelligence_source, 'manual');
  assert.deepEqual(unscored.applied, [{
    model_id: 'vendor/model',
    intelligence: 41.1,
    source_url: 'https://artificialanalysis.ai/models/vendor-model',
    source_type: 'aa-web',
    captured_at: '2026-08-30',
  }]);

  const scored = applyIntelligenceOverrides([record('vendor/model', 52.3)], [override()]);
  assert.equal(scored.models[0].intelligence, 52.3);
  assert.equal(scored.models[0].intelligence_source, 'artificial-analysis');
  assert.deepEqual(scored.applied, []);
  assert.deepEqual(scored.skippedLive, [{ model_id: 'vendor/model', live_intelligence: 52.3 }]);
});

test('lands override fields verbatim (intelligence unchanged to the digit)', () => {
  const { models } = applyIntelligenceOverrides([record('vendor/model')], [override({ intelligence: 38.7 })]);
  assert.equal(models[0].intelligence, 38.7);
  assert.equal(models[0].intelligence_citation, 'https://artificialanalysis.ai/models/vendor-model');
  assert.equal(models[0].intelligence_scope, null);
});

test('records get intelligence_source manual plus citation fields', () => {
  const { models } = applyIntelligenceOverrides([record('vendor/model')], [override()]);
  assert.equal(models[0].intelligence_source, 'manual');
  assert.equal(models[0].intelligence_citation, 'https://artificialanalysis.ai/models/vendor-model');
  assert.equal(models[0].intelligence_scope, null);
});

test('fails loudly on malformed override entries, never silently skips', () => {
  assert.throws(() => validateIntelligenceOverrides([override({ source_url: undefined })]), /missing source_url/);
  assert.throws(() => validateIntelligenceOverrides([override({ intelligence: 'high' })]), /non-numeric intelligence/);
  assert.throws(() => validateIntelligenceOverrides([override({ source_type: 'blog' })]), /invalid source_type/);
  assert.throws(() => validateIntelligenceOverrides([override({ model_id: '' })]), /missing model_id/);
  assert.throws(() => validateIntelligenceOverrides([override({ captured_at: undefined })]), /missing captured_at/);
  assert.throws(() => validateIntelligenceOverrides('not-an-array'), /must be an array/);
});

test('populates audit.manual_overrides and flags unknown IDs', () => {
  const result = applyIntelligenceOverrides(
    [record('vendor/model')],
    [override(), override({ model_id: 'vendor/ghost' })],
  );
  assert.equal(result.applied.length, 1);
  assert.deepEqual(result.unknown, [{ model_id: 'vendor/ghost' }]);
});
