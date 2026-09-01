import {
  expectedCost,
  satisfiesSeparation,
} from './pair.js';

// D22: a vendor is the OpenRouter ID prefix (everything before the first '/').
export function vendorOf(id) {
  const slash = id.indexOf('/');
  return slash === -1 ? id : id.slice(0, slash);
}

/**
 * Pure vendor-lens selection (D22). Vendors are ranked by their best
 * floor-qualifying planner's intelligence; ties are broken by execution depth
 * (the count of floor-qualifying models the vendor can field). The top 2
 * vendors that can field a legal pair get top-level rows; every vendor that
 * can field a pair appears in the expanded all-vendors list, ordered by
 * expected-$. No hardcoded brand lists — selection derives from data.
 */
export function computeVendorRows(models, mix = {}, modelBasedVerification = false, bandWidth = 8) {
  const plottable = models.filter((m) => (
    Number.isFinite(m.intelligence)
    && Number.isFinite(m.cost_per_1m_avg)
    && m.cost_per_1m_avg > 0
  ));
  if (plottable.length === 0) return { topRows: [], allVendors: [] };

  const floors = computeFloors(plottable, bandWidth);
  if (floors.planning == null || floors.execution == null) {
    return { topRows: [], allVendors: [] };
  }

  const byVendor = new Map();
  for (const m of plottable) {
    const v = vendorOf(m.id);
    if (!byVendor.has(v)) byVendor.set(v, []);
    byVendor.get(v).push(m);
  }

  const ranked = [];
  for (const [vendor, modelsOfVendor] of byVendor) {
    const bestPlanner = argmaxIntelligenceCheapest(
      modelsOfVendor.filter((m) => m.intelligence >= floors.planning),
    );
    if (!bestPlanner) continue;
    const depth = modelsOfVendor.filter((m) => m.intelligence >= floors.execution).length;
    const pair = buildVendorPair(modelsOfVendor, floors, mix, modelBasedVerification);
    ranked.push({ vendor, bestPlanner, depth, pair });
  }

  ranked.sort((a, b) => (b.bestPlanner.intelligence - a.bestPlanner.intelligence)
    || (b.depth - a.depth)
    || a.vendor.localeCompare(b.vendor));

  const topRows = [];
  for (const entry of ranked) {
    if (topRows.length >= 2) break;
    if (entry.pair) topRows.push(entry.pair);
  }

  const allVendors = ranked
    .filter((entry) => entry.pair)
    .sort((a, b) => (a.pair.expected_cost - b.pair.expected_cost)
      || a.vendor.localeCompare(b.vendor))
    .map((entry) => ({ vendor: entry.vendor, pair: entry.pair }));

  return { topRows, allVendors };
}

/**
 * Legal pair per vendor (D22): planner = argmax intelligence (tie → cheapest);
 * execution = cheapest vendor model that (a) ≥ execution floor, (b) is not the
 * planner and not its D17 children (inherit_from), (c) passes D19 against the
 * planner. If the cheapest legal executor fails, fall back to the next
 * cheapest (same pattern as lens 2). Returns null when no legal pair exists.
 */
export function buildVendorPair(modelsOfVendor, floors, mix = {}, modelBasedVerification = false) {
  const planners = modelsOfVendor.filter((m) => m.intelligence >= floors.planning);
  if (planners.length === 0) return null;
  const planner = argmaxIntelligenceCheapest(planners);

  const excluded = new Set([planner.id]);
  for (const m of modelsOfVendor) {
    if (m.inherit_from === planner.id) excluded.add(m.id);
  }

  const executors = modelsOfVendor
    .filter((e) => e.intelligence >= floors.execution && !excluded.has(e.id))
    .sort((a, b) => a.cost_per_1m_avg - b.cost_per_1m_avg);

  const executor = executors.find((e) => qualifies(planner, e));
  if (!executor) return null;

  return {
    type: 'vendor',
    vendor: vendorOf(planner.id),
    planning: planner,
    execution: executor,
    separation: satisfiesSeparation(planner, executor),
    expected_cost: expectedCost(planner, executor, mix, modelBasedVerification),
  };
}

function computeFloors(models, bandWidth) {
  const intelligence = models.map((m) => m.intelligence);
  const max = Math.max(...intelligence);
  const planning = intelligence.length === 1 ? intelligence[0] : max - bandWidth;
  const sorted = intelligence.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * 0.5;
  const lower = Math.floor(position);
  const fraction = position - lower;
  const execution = sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
  return { planning, execution, max };
}

function qualifies(a, b) {
  const separation = satisfiesSeparation(a, b);
  return a.id !== b.id && (separation.pricePath || separation.scorePath);
}

function argmaxIntelligenceCheapest(pool) {
  if (pool.length === 0) return null;
  const max = Math.max(...pool.map((m) => m.intelligence));
  return pool
    .filter((m) => m.intelligence === max)
    .sort((a, b) => a.cost_per_1m_avg - b.cost_per_1m_avg)[0];
}
