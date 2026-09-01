import {
  expectedCost,
  plottableModels,
  recommendPairs,
  satisfiesSeparation,
} from './pair.js';
import { computeVendorRows } from './vendor.js';

// D20: capability-step for the planning lens and the executor price ceiling.
export const PLANNING_STEP = 3.0;
export const EXECUTOR_CEILING_MULTIPLE = 10;

/**
 * Pure lens-card selection (D20 + D21). Each row is the argmin/argmax of its
 * own objective; nothing is a rank position. `computeLensCard` returns the
 * ordered non-null rows (Row 1, planning step-up, execution step-up, ceiling)
 * plus the untouched true ranking for the collapsible ranking view.
 */
export function computeLensCard(models, mix = {}, modelBasedVerification = false, bandWidth = 8) {
  const ctx = computeContext(models, mix, modelBasedVerification, bandWidth);
  if (!ctx) {
    const rec = recommendPairs(plottableModels(models), mix, modelBasedVerification, bandWidth);
    return {
      floors: rec.floors,
      mix: rec.mix,
      reason: rec.reason,
      row1: null,
      lenses: [],
      ceiling: null,
      vs_anchor: null,
      ranking: [],
      rows: [],
    };
  }

  const row1 = {
    type: 'minimize-spend',
    ...ctx.row1,
    expected_cost: ctx.row1.expected_cost,
  };

  const lens2 = planningStepUp(models, mix, modelBasedVerification, bandWidth);
  const lens3 = executionStepUp(models, mix, modelBasedVerification, bandWidth);

  let lenses = [lens2, lens3].filter(Boolean);

  // Honesty rules from the brief (D4): a lens that repeats Row 1 adds nothing.
  lenses = lenses.filter((lens) => !samePair(lens, row1));

  // If both lenses collapse to the same pair, render the first, skip the second.
  if (lenses.length === 2 && samePair(lenses[0], lenses[1])) {
    lenses = lenses.slice(0, 1);
  }

  let ceiling = capabilityCeiling(models, mix, modelBasedVerification, bandWidth);

  // Ceiling repeats an already-rendered row: skip it.
  if (ceiling) {
    const repeats = samePair(ceiling, row1) || lenses.some((lens) => samePair(lens, ceiling));
    if (repeats) ceiling = null;
  }

  const rows = [row1, ...lenses, ceiling].filter(Boolean);

  // D22: vendor-lens rows. Computed only when Row 1 exists (the vs-anchor
  // multiple needs the anchor); top-level rows are [row1, ...vendorRows].
  const vendors = computeVendorRows(models, mix, modelBasedVerification, bandWidth);
  const topRows = [row1, ...vendors.topRows];

  return {
    floors: ctx.rec.floors,
    mix: ctx.rec.mix,
    reason: null,
    row1,
    lenses,
    ceiling,
    vs_anchor: ceiling ? ceiling.vs_anchor : null,
    ranking: ctx.rec.pairs,
    rows,
    vendors,
    topRows,
  };
}

/**
 * Lens 2 — "What if planning quality is my bottleneck?"
 * Cheapest qualifying executor (execution floor) + cheapest planner that is
 * BOTH ≥ (Row-1 planner intelligence + PLANNING_STEP) AND a different family.
 * D19 must pass against the chosen executor; if the cheapest executor fails,
 * fall back to the next cheapest. Absent (null) if no planner qualifies.
 */
export function planningStepUp(models, mix = {}, modelBasedVerification = false, bandWidth = 8) {
  const ctx = computeContext(models, mix, modelBasedVerification, bandWidth);
  if (!ctx) return null;

  const target = ctx.row1.planning.intelligence + PLANNING_STEP;
  const planners = ctx.planningPool
    .filter((m) => m.intelligence >= target && m.family !== ctx.row1.planning.family)
    .sort((a, b) => a.cost_per_1m_avg - b.cost_per_1m_avg);
  if (planners.length === 0) return null;
  const planner = planners[0];

  const executors = ctx.executionPool
    .filter((e) => e.id !== planner.id)
    .sort((a, b) => a.cost_per_1m_avg - b.cost_per_1m_avg);
  const executor = executors.find((e) => qualifies(planner, e));
  if (!executor) return null;

  return row('planning-step-up', planner, executor, ctx.rec.mix, modelBasedVerification);
}

/**
 * Lens 3 — "What if execution quality is my bottleneck?"
 * Cheapest qualifying planner (Row 1's planner) + highest-intelligence
 * executor within EXECUTOR_CEILING_MULTIPLE × the cheapest executor's price
 * (tie → cheapest). D19 must pass. Absent (null) if no executor qualifies.
 */
export function executionStepUp(models, mix = {}, modelBasedVerification = false, bandWidth = 8) {
  const ctx = computeContext(models, mix, modelBasedVerification, bandWidth);
  if (!ctx) return null;

  const planner = ctx.row1.planning;
  const ceiling = EXECUTOR_CEILING_MULTIPLE * ctx.cheapestExecutor.cost_per_1m_avg;
  const executors = ctx.executionPool
    .filter((e) => e.id !== planner.id && e.cost_per_1m_avg <= ceiling)
    .sort((a, b) => (b.intelligence - a.intelligence) || (a.cost_per_1m_avg - b.cost_per_1m_avg));
  const executor = executors.find((e) => qualifies(planner, e));
  if (!executor) return null;

  return row('execution-step-up', planner, executor, ctx.rec.mix, modelBasedVerification);
}

/**
 * Row 4 (D21) — capability ceiling, a reference, not a strategy.
 * Planning = argmax intelligence (tie → cheapest); execution = argmax
 * intelligence EXCLUDING the planner and its D17 variant children
 * (inherit_from === planner.id). D19 must pass or the row is skipped — never
 * a near-ceiling substitute. Degenerate all-equal-intelligence data: skipped.
 */
export function capabilityCeiling(models, mix = {}, modelBasedVerification = false, bandWidth = 8) {
  const ctx = computeContext(models, mix, modelBasedVerification, bandWidth);
  if (!ctx) return null;

  if (new Set(ctx.plottable.map((m) => m.intelligence)).size <= 1) return null;

  const planner = argmaxIntelligenceCheapest(ctx.planningPool);
  const excluded = new Set([planner.id]);
  for (const m of ctx.executionPool) {
    if (m.inherit_from === planner.id) excluded.add(m.id);
  }
  const executors = ctx.executionPool.filter((e) => !excluded.has(e.id));
  if (executors.length === 0) return null;

  const executor = argmaxIntelligenceCheapest(executors);
  if (!qualifies(planner, executor)) return null;

  const expected_cost = expectedCost(planner, executor, ctx.rec.mix, modelBasedVerification);
  const vs_anchor = ctx.row1.expected_cost > 0 ? expected_cost / ctx.row1.expected_cost : null;

  return {
    type: 'ceiling',
    planning: planner,
    execution: executor,
    separation: satisfiesSeparation(planner, executor),
    expected_cost,
    vs_anchor,
  };
}

function computeContext(models, mix, modelBasedVerification, bandWidth) {
  const plottable = plottableModels(models);
  const rec = recommendPairs(plottable, mix, modelBasedVerification, bandWidth);
  if (!rec.mix || rec.pairs.length === 0) return null;

  const floors = rec.floors;
  const planningPool = plottable.filter((m) => m.intelligence >= floors.planning);
  const executionPool = plottable.filter((m) => m.intelligence >= floors.execution);
  const cheapestExecutor = executionPool
    .slice()
    .sort((a, b) => a.cost_per_1m_avg - b.cost_per_1m_avg)[0];
  return { rec, plottable, floors, planningPool, executionPool, cheapestExecutor, row1: rec.pairs[0] };
}

function qualifies(a, b) {
  const separation = satisfiesSeparation(a, b);
  return a.id !== b.id && (separation.pricePath || separation.scorePath);
}

function samePair(a, b) {
  return a.planning.id === b.planning.id && a.execution.id === b.execution.id;
}

function argmaxIntelligenceCheapest(pool) {
  const max = Math.max(...pool.map((m) => m.intelligence));
  return pool
    .filter((m) => m.intelligence === max)
    .sort((a, b) => a.cost_per_1m_avg - b.cost_per_1m_avg)[0];
}

function row(type, planning, execution, mix, modelBasedVerification) {
  return {
    type,
    planning,
    execution,
    separation: satisfiesSeparation(planning, execution),
    expected_cost: expectedCost(planning, execution, mix, modelBasedVerification),
  };
}
