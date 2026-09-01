const DAY_MS = 24 * 60 * 60 * 1000;

export function isStale(iso, now = new Date(), days = 7) {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then > days * DAY_MS;
}

export function humanizeUtc(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function freshnessLine(generatedAt, benchmarksFetchedAt, now = new Date()) {
  const stale = isStale(generatedAt, now);
  return `Data generated: ${humanizeUtc(generatedAt)} · benchmarks fetched: ${humanizeUtc(benchmarksFetchedAt)}${stale ? ' · ⚠ stale (>7 days)' : ''}`;
}
