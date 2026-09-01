import test from 'node:test';
import assert from 'node:assert/strict';
import { isStale, humanizeUtc, freshnessLine } from '../src/lib/freshness.js';

const NOW = new Date('2026-08-30T12:00:00.000Z');

test('freshness: stale fires strictly after 7 days, not at exactly 7', () => {
  const sevenDays = '2026-08-23T12:00:00.000Z';
  const justOver = '2026-08-23T11:59:59.000Z';
  const justUnder = '2026-08-23T12:00:01.000Z';
  assert.equal(isStale(sevenDays, NOW), false);
  assert.equal(isStale(justOver, NOW), true);
  assert.equal(isStale(justUnder, NOW), false);
});

test('freshness: fresh data is never stale', () => {
  assert.equal(isStale('2026-08-30T11:00:00.000Z', NOW), false);
  assert.equal(isStale('2026-08-29T12:00:00.000Z', NOW), false);
});

test('freshness: missing or malformed timestamps are not stale', () => {
  assert.equal(isStale(null, NOW), false);
  assert.equal(isStale(undefined, NOW), false);
  assert.equal(isStale('not-a-date', NOW), false);
});

test('freshness: humanizeUtc renders YYYY-MM-DD HH:MM UTC', () => {
  assert.equal(humanizeUtc('2026-08-30T17:06:00.000Z'), '2026-08-30 17:06 UTC');
  assert.equal(humanizeUtc('2026-08-30T17:06:05.000Z'), '2026-08-30 17:06 UTC');
  assert.equal(humanizeUtc('2026-01-05T09:03:00.000Z'), '2026-01-05 09:03 UTC');
  assert.equal(humanizeUtc(null), '—');
  assert.equal(humanizeUtc('garbage'), '—');
});

test('freshness: freshnessLine shows both timestamps and appends the stale marker only when stale', () => {
  const fresh = freshnessLine('2026-08-30T17:06:00.000Z', '2026-08-30T17:05:00.000Z', NOW);
  assert.equal(fresh, 'Data generated: 2026-08-30 17:06 UTC · benchmarks fetched: 2026-08-30 17:05 UTC');

  const stale = freshnessLine('2026-08-20T17:06:00.000Z', '2026-08-20T17:05:00.000Z', NOW);
  assert.ok(stale.includes('⚠ stale (>7 days)'));
  assert.ok(stale.includes('Data generated: 2026-08-20 17:06 UTC'));
  assert.ok(stale.includes('benchmarks fetched: 2026-08-20 17:05 UTC'));
});
