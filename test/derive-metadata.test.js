import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveMetadata,
  isPaidCanonicalModel,
  matchAllowlist,
} from '../scripts/lib/derive-metadata.js';

const rules = [
  { prefix: 'openai/gpt-oss-', family: 'gpt-oss' },
  { prefix: 'openai/gpt-', family: 'gpt', exclude: ['image', 'audio'] },
  { prefix: 'google/gemini-', family: 'gemini', exclude: ['image'] },
  { prefix: 'qwen/qwen', family: 'qwen', exclude: ['-vl-'] },
];

test('matches the first coding family rule and rejects excluded variants', () => {
  assert.equal(matchAllowlist({ id: 'openai/gpt-oss-120b' }, rules)?.family, 'gpt-oss');
  assert.equal(matchAllowlist({ id: 'google/gemini-2.5-pro' }, rules)?.family, 'gemini');
  assert.equal(matchAllowlist({ id: 'google/gemini-3-pro-image' }, rules), null);
  assert.equal(matchAllowlist({ id: 'qwen/qwen3-vl-32b-instruct' }, rules), null);
  assert.equal(matchAllowlist({ id: 'google/gemini-2.5-pro:free' }, rules), null);
});

test('derives only the normalized allowlisted family', () => {
  const metadata = deriveMetadata(
    { name: 'Qwen3 8B', id: 'qwen/qwen3-8b' },
    { family: 'qwen' },
  );
  assert.deepEqual(metadata, { family: 'qwen' });
});

test('accepts only paid canonical models as a pricing basis', () => {
  assert.equal(isPaidCanonicalModel({ id: 'qwen/qwen3-8b:free', prompt_per_1m: 0, completion_per_1m: 0 }), false);
  assert.equal(isPaidCanonicalModel({ id: 'qwen/qwen3-8b:batch', prompt_per_1m: 0.1, completion_per_1m: 0.2 }), false);
  assert.equal(isPaidCanonicalModel({ id: 'qwen/qwen3-8b', prompt_per_1m: 0, completion_per_1m: 0 }), false);
  assert.equal(isPaidCanonicalModel({ id: 'qwen/qwen3-8b', prompt_per_1m: 0.1, completion_per_1m: 0.2 }), true);
});
