import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseCatalogVariants } from '../scripts/lib/catalog-collapse.js';
import {
  normalizeAaSlug,
  normalizeCatalogSlug,
  resolveAaIntelligence,
} from '../scripts/lib/aa-resolution.js';

function catalog(id, overrides = {}) {
  return {
    id,
    name: id,
    prompt_per_1m: 1,
    completion_per_1m: 2,
    context: 200000,
    supported_parameters: ['reasoning'],
    per_request_limits: { prompt_tokens: 100000 },
    ...overrides,
  };
}

function aa(slug, intelligence, overrides = {}) {
  return {
    slug,
    evaluations: {
      artificial_analysis_intelligence_index: intelligence,
      artificial_analysis_coding_index: 70,
      artificial_analysis_agentic_index: 55,
    },
    ...overrides,
  };
}

const base = catalog('openai/gpt-5.6-luna');
const linkedVariant = catalog('openai/gpt-5.6-luna-pro', {
  description: 'GPT-5.6 Luna Pro is the same underlying model as [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna), served in pro mode.',
});

test('collapses a linked same-underlying-model variant into its paid sibling and emits audit evidence', () => {
  const result = collapseCatalogVariants([base, linkedVariant]);

  assert.deepEqual(result.models, [base]);
  assert.deepEqual(result.collapses, [{
    variant_id: 'openai/gpt-5.6-luna-pro',
    base_id: 'openai/gpt-5.6-luna',
    matched_phrase: 'same underlying model as',
  }]);
});

test('collapses an identical-capabilities variant only when it links a sibling', () => {
  const fast = catalog('anthropic/claude-opus-5-fast', {
    id: 'anthropic/claude-opus-5-fast',
    description: 'Fast-mode variant of [Opus 5](/anthropic/claude-opus-5) - identical capabilities with higher output speed at 2x pricing.',
  });
  const opus = catalog('anthropic/claude-opus-5');

  const result = collapseCatalogVariants([opus, fast]);

  assert.deepEqual(result.models, [opus]);
  assert.deepEqual(result.collapses, [{
    variant_id: fast.id,
    base_id: opus.id,
    matched_phrase: 'identical capabilities',
  }]);
});

test('uses the sibling link adjacent to identical-capabilities language, not an earlier unrelated link', () => {
  const unrelated = catalog('vendor/unrelated');
  const intendedBase = catalog('vendor/base');
  const fast = catalog('vendor/base-fast', {
    description: '[Unrelated](https://openrouter.ai/vendor/unrelated) documentation. [Base](/vendor/base) - identical capabilities with higher output speed.',
  });

  const result = collapseCatalogVariants([unrelated, intendedBase, fast]);

  assert.deepEqual(result.models, [unrelated, intendedBase]);
  assert.deepEqual(result.collapses, [{
    variant_id: fast.id,
    base_id: intendedBase.id,
    matched_phrase: 'identical capabilities',
  }]);
});

test('retains unresolvable, protected, chained, and materially-different variants', () => {
  const missingSibling = catalog('vendor/model-pro', {
    description: 'The same underlying model as [Model](https://openrouter.ai/vendor/model).',
  });
  const legacyPro = catalog('openai/gpt-5-pro', {
    description: linkedVariant.description,
  });
  const chat = catalog('openai/gpt-5.6-luna-chat', {
    description: linkedVariant.description,
  });
  const intermediate = catalog('vendor/intermediate', {
    description: 'The same underlying model as [Base](https://openrouter.ai/vendor/base).',
  });
  const chained = catalog('vendor/variant', {
    description: 'The same underlying model as [Intermediate](https://openrouter.ai/vendor/intermediate).',
  });
  const baseWithDifferentParameters = catalog('vendor/spec-base');
  const differentParameters = catalog('vendor/spec-fast', {
    supported_parameters: ['reasoning', 'tools'],
    description: 'The same underlying model as [Spec Base](https://openrouter.ai/vendor/spec-base).',
  });

  const result = collapseCatalogVariants([
    base,
    missingSibling,
    legacyPro,
    chat,
    catalog('vendor/base'),
    intermediate,
    chained,
    baseWithDifferentParameters,
    differentParameters,
  ]);

  assert.deepEqual(result.models.map((model) => model.id), [
    base.id,
    missingSibling.id,
    legacyPro.id,
    chat.id,
    'vendor/base',
    baseWithDifferentParameters.id,
    differentParameters.id,
  ]);
  assert.deepEqual(result.collapses, [{
    variant_id: intermediate.id,
    base_id: 'vendor/base',
    matched_phrase: 'same underlying model as',
  }]);
  assert.deepEqual(result.nonCollapses.map((entry) => entry.reason), [
    'missing_sibling',
    'protected_variant',
    'protected_variant',
    'collapse_chain',
    'material_difference',
  ]);
});

test('normalizes punctuation and catalog-only trailing dates', () => {
  assert.equal(normalizeCatalogSlug('openai/gpt-5.6-luna'), 'gpt56luna');
  assert.equal(normalizeAaSlug('gpt-5-6-luna'), 'gpt56luna');
  assert.equal(normalizeCatalogSlug('deepseek/deepseek-v4-pro-0813'), 'deepseekv4pro');
  assert.equal(normalizeAaSlug('deepseek-v4-pro-0424'), 'deepseekv4pro0424');
});

test('uses a verbatim plain AA score ahead of effort variants', () => {
  const result = resolveAaIntelligence('openai/gpt-5.6-luna', [
    aa('gpt-5-6-luna', 52.3),
    aa('gpt-5-6-luna-low', 40),
    aa('gpt-5-6-luna-high', 65),
  ]);

  assert.equal(result.intelligence, 52.3);
  assert.equal(result.coding_index, 70);
  assert.equal(result.agentic_index, 55);
  assert.equal(result.intelligence_scope, null);
  assert.equal(result.effort_scores, undefined);
});

test('uses the median with visible scope when only effort variants exist', () => {
  const result = resolveAaIntelligence('openai/gpt-5.6-luna', [
    aa('gpt-5-6-luna-low', 40),
    aa('gpt-5-6-luna-medium', 50),
    aa('gpt-5-6-luna-high', 70),
  ]);

  assert.equal(result.intelligence, 50);
  assert.equal(result.intelligence_scope, 'effort-median');
  assert.deepEqual(result.effort_scores, [40, 50, 70]);
});

test('uses a lone effort score as a labelled median and never date-strips AA slugs', () => {
  const lone = resolveAaIntelligence('deepseek/deepseek-v4-pro-0813', [aa('deepseek-v4-pro-high', 42)]);
  const aaDated = resolveAaIntelligence('deepseek/deepseek-v4-pro-0813', [aa('deepseek-v4-pro-0424', 55)]);

  assert.equal(lone.intelligence, 42);
  assert.equal(lone.intelligence_scope, 'effort-median');
  assert.equal(aaDated.intelligence, null);
});

test('returns null and reports an unresolvable normalized-score collision', () => {
  const result = resolveAaIntelligence('openai/gpt-5.6-luna', [
    aa('gpt-5-6-luna', 52.3),
    aa('gpt_5_6_luna', 58.4),
  ]);

  assert.equal(result.intelligence, null);
  assert.deepEqual(result.collision, {
    catalog_id: 'openai/gpt-5.6-luna',
    aa_slugs: ['gpt-5-6-luna', 'gpt_5_6_luna'],
    scores: [52.3, 58.4],
  });
});
