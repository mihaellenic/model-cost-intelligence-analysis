import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, colorFor } from '../src/lib/filters.js';

test('uses an explicit normalized-family color and a deterministic fallback', () => {
  assert.equal(colorFor('claude'), '#fb7185');
  assert.match(colorFor('future-code-family'), /^hsl\(\d+ 70% 62%\)$/);
  assert.equal(colorFor('future-code-family'), colorFor('future-code-family'));
});
