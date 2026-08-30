export function median(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// Quadrant semantics (shared by the shading plugin and pick classification):
//   low cost  = cost <= medianCost       high cost = cost > medianCost
//   high intel = intel >= medianIntel    low intel = intel < medianIntel
//   good  = low cost  & high intel       warn  = high cost & high intel
//   cheap = low cost  & low intel        bad   = high cost & low intel
export function classify(model, medCost, medIntel) {
  if (model.intelligence == null || model.cost_per_1m_avg == null) return 'unknown';
  const lowCost = model.cost_per_1m_avg <= medCost;
  const highIntel = model.intelligence >= medIntel;
  if (lowCost && highIntel) return 'good';
  if (!lowCost && highIntel) return 'warn';
  if (lowCost && !highIntel) return 'cheap';
  return 'bad';
}

export const QUADRANT_INFO = {
  good:  { label: 'Sweet spot', tone: 'good',  description: 'High intelligence, low cost. Pick first.' },
  warn:  { label: 'Premium',    tone: 'warn',  description: 'High intelligence, high cost. Pay only if you need the edge.' },
  cheap: { label: 'Budget',     tone: 'cheap', description: 'Low cost but weaker. Fine for routine tasks.' },
  bad:   { label: 'Avoid',      tone: 'bad',   description: 'Low intelligence and high cost. Skip.' },
};

export function computePicks(models, medCost, medIntel) {
  const withBoth = models.filter((m) => m.intelligence != null && m.cost_per_1m_avg != null);
  if (withBoth.length === 0) return { best: null, cheap: null, premium: null, costP25: null };

  medCost = medCost ?? median(withBoth.map((m) => m.cost_per_1m_avg));
  medIntel = medIntel ?? median(withBoth.map((m) => m.intelligence));

  const inGood = withBoth.filter((m) => classify(m, medCost, medIntel) === 'good');
  const inWarn = withBoth.filter((m) => classify(m, medCost, medIntel) === 'warn');
  const cheapZoneOnly = withBoth.filter((m) => m.cost_per_1m_avg <= medCost);

  const best = inGood.length ? pickTop(inGood, 'value') : pickTop(cheapZoneOnly, 'value');
  const premium = inWarn.length ? pickTop(inWarn, 'intel') : null;

  const costP25 = quantile(withBoth.map((m) => m.cost_per_1m_avg), 0.25);
  const cheapCandidates = withBoth.filter((m) => m.cost_per_1m_avg <= costP25);
  const pool = cheapCandidates.length ? cheapCandidates : withBoth;
  const cheap = pickTop(pool, 'intel');

  return { best, cheap, premium, costP25 };
}

function pickTop(arr, by) {
  const sorted = arr.slice().sort((a, b) => {
    if (by === 'value') return (b.intelligence / Math.max(b.cost_per_1m_avg, 0.001)) - (a.intelligence / Math.max(a.cost_per_1m_avg, 0.001));
    return b.intelligence - a.intelligence;
  });
  return sorted[0] || null;
}

function quantile(values, q) {
  const xs = values.filter((v) => v != null && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const pos = (xs.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return xs[base + 1] !== undefined ? xs[base] + rest * (xs[base + 1] - xs[base]) : xs[base];
}
