import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));

test('build script runs data -> test -> build in order (fail-closed chain)', () => {
  assert.equal(pkg.scripts.build, 'npm run data && npm test && vite build');
});

test('data script runs pricing, then AA benchmarks, then the builder', () => {
  const steps = pkg.scripts.data.split(' && ');
  assert.equal(steps.length, 3);
  assert.match(steps[0], /fetch-pricing\.js/);
  assert.match(steps[1], /fetch-aa-benchmarks\.js/);
  assert.match(steps[2], /build-data\.js/);
});

test('data scripts tolerate a missing .env (CI has none; secrets come from the step env)', () => {
  for (const script of ['data', 'data:pricing', 'data:aa', 'data:benchmarks']) {
    assert.match(pkg.scripts[script], /--env-file-if-exists=\.env/, `${script} must use --env-file-if-exists`);
  }
});
