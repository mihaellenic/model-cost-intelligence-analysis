import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariantInheritance } from '../scripts/lib/variant-inherit.js';

function variant(id, overrides = {}) {
  return {
    id,
    name: id,
    description: 'Fast-mode variant of [Base](/vendor/base) - identical capabilities with higher output speed at 2x pricing.',
    context: 200000,
    per_request_limits: null,
    supported_parameters: ['reasoning', 'tools'],
    architecture: { modality: 'text->text' },
    ...overrides,
  };
}

function base(id, overrides = {}) {
  return {
    id,
    name: id,
    description: 'Base model.',
    context: 200000,
    per_request_limits: null,
    supported_parameters: ['reasoning', 'tools', 'temperature'],
    architecture: { modality: 'text->text' },
    intelligence: 55,
    coding_index: 70,
    agentic_index: 50,
    ...overrides,
  };
}

const materialNonCollapse = (variantId, baseId) => ({
  variant_id: variantId,
  reason: 'material_difference',
  base_id: baseId,
});

test('inherits when all conditions are met, with correct labels', () => {
  const result = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast'),
    base('vendor/base'),
  );

  assert.equal(result.intelligence, 55);
  assert.equal(result.coding_index, 70);
  assert.equal(result.agentic_index, 50);
  assert.equal(result.intelligence_scope, 'variant-inherited');
  assert.equal(result.inherit_from, 'vendor/base');
  assert.equal(result.matched_phrase, 'identical capabilities');
  assert.deepEqual(result.fields_inherited, ['supported_parameters']);
});

test('skips when the base is unscored, setting no fields', () => {
  const result = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast'),
    base('vendor/base', { intelligence: null, coding_index: null, agentic_index: null }),
  );

  assert.deepEqual(result, { skip: 'base_unscored' });
});

test('skips on an additive delta (variant supports a param the base lacks)', () => {
  const result = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast', { supported_parameters: ['reasoning', 'tools', 'temperature', 'top_p'] }),
    base('vendor/base'),
  );

  assert.deepEqual(result, { skip: 'additive_delta' });
});

test('skips protected variants (o1-pro)', () => {
  const result = resolveVariantInheritance(
    materialNonCollapse('openai/o1-pro', 'openai/o1'),
    variant('openai/o1-pro', { description: 'The same underlying model as [o1](https://openrouter.ai/openai/o1).' }),
    base('openai/o1'),
  );

  assert.deepEqual(result, { skip: 'protected_variant' });
});

test('enforces one hop: a base that itself inherits is skipped', () => {
  const result = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast'),
    base('vendor/base', { inherit_from: 'vendor/root' }),
  );

  assert.deepEqual(result, { skip: 'inheritance_chain' });
});

test('passes coding/agentic indexes through only when the base has them', () => {
  const withIndexes = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast'),
    base('vendor/base', { coding_index: 70, agentic_index: 50 }),
  );
  assert.equal(withIndexes.coding_index, 70);
  assert.equal(withIndexes.agentic_index, 50);

  const withoutIndexes = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast'),
    base('vendor/base', { coding_index: null, agentic_index: null }),
  );
  assert.equal(withoutIndexes.coding_index, null);
  assert.equal(withoutIndexes.agentic_index, null);
});

test('inherits the base score verbatim (no rounding or transformation)', () => {
  const result = resolveVariantInheritance(
    materialNonCollapse('vendor/base-fast', 'vendor/base'),
    variant('vendor/base-fast'),
    base('vendor/base', { intelligence: 57.3 }),
  );

  assert.equal(result.intelligence, 57.3);
});

test('skips non-material-difference non-collapses', () => {
  const result = resolveVariantInheritance(
    { variant_id: 'vendor/base-fast', reason: 'protected_variant', base_id: 'vendor/base' },
    variant('vendor/base-fast'),
    base('vendor/base'),
  );

  assert.deepEqual(result, { skip: 'not_material_difference' });
});
