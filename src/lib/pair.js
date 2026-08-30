export const DEFAULT_MIX = {
  planning: 65,
  execution: 30,
  verification: 5,
};

export function normalizeMix(mix = DEFAULT_MIX) {
  const values = {
    planning: nonNegativeNumber(mix.planning),
    execution: nonNegativeNumber(mix.execution),
    verification: nonNegativeNumber(mix.verification),
  };
  const total = values.planning + values.execution + values.verification;
  if (total === 0) return null;

  return {
    planning: values.planning / total,
    execution: values.execution / total,
    verification: values.verification / total,
  };
}

export function computeQualityFloors(models) {
  const intelligence = plottableModels(models).map((model) => model.intelligence);
  return {
    planning: percentile(intelligence, 0.75),
    execution: percentile(intelligence, 0.5),
  };
}

export function expectedCost(planning, execution, mix, modelBasedVerification = false) {
  const normalizedMix = normalizeMix(mix);
  if (!normalizedMix) return null;

  const verificationCost = modelBasedVerification ? execution.cost_per_1m_avg : 0;
  return (normalizedMix.planning * planning.cost_per_1m_avg)
    + (normalizedMix.execution * execution.cost_per_1m_avg)
    + (normalizedMix.verification * verificationCost);
}

export function recommendPairs(models, mix = DEFAULT_MIX, modelBasedVerification = false) {
  const plottable = plottableModels(models);
  const normalizedMix = normalizeMix(mix);
  if (!normalizedMix) {
    return {
      floors: { planning: null, execution: null },
      mix: null,
      pairs: [],
      reason: 'Enter a task mix greater than 0% to calculate a qualifying pair.',
    };
  }

  if (plottable.length === 0) {
    return {
      floors: { planning: null, execution: null },
      mix: normalizedMix,
      pairs: [],
      reason: 'No qualifying pair: no plottable models meet the intelligence-and-price requirements.',
    };
  }

  const floors = computeQualityFloors(plottable);
  const planningCandidates = plottable.filter((model) => model.intelligence >= floors.planning);
  const executionCandidates = plottable.filter((model) => model.intelligence >= floors.execution);

  if (planningCandidates.length === 0) {
    return emptyRecommendation(normalizedMix, floors, `No qualifying pair: the planning floor (p75 ${floors.planning.toFixed(1)}) has no qualifying model.`);
  }
  if (executionCandidates.length === 0) {
    return emptyRecommendation(normalizedMix, floors, `No qualifying pair: the execution floor (median ${floors.execution.toFixed(1)}) has no qualifying model.`);
  }

  const pairs = planningCandidates.flatMap((planning) => executionCandidates
    .filter((execution) => execution.id !== planning.id)
    .map((execution) => ({
      planning,
      execution,
      expected_cost: expectedCost(planning, execution, normalizedMix, modelBasedVerification),
      combined_intelligence: planning.intelligence + execution.intelligence,
    })))
    .sort(comparePairs);

  if (pairs.length === 0) {
    const onlyPlanning = planningCandidates.length === 1 ? planningCandidates[0].name : 'the planning candidates';
    return emptyRecommendation(
      normalizedMix,
      floors,
      `No qualifying pair: the planning floor (p75 ${floors.planning.toFixed(1)}) leaves ${onlyPlanning} without a distinct execution model above the execution floor (median ${floors.execution.toFixed(1)}).`,
    );
  }

  return { floors, mix: normalizedMix, pairs, reason: null };
}

function plottableModels(models) {
  return models.filter((model) => (
    Number.isFinite(model.intelligence)
    && Number.isFinite(model.cost_per_1m_avg)
    && model.cost_per_1m_avg > 0
  ));
}

function percentile(values, q) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function emptyRecommendation(mix, floors, reason) {
  return { floors, mix, pairs: [], reason };
}

function comparePairs(a, b) {
  return (a.expected_cost - b.expected_cost)
    || (b.combined_intelligence - a.combined_intelligence)
    || a.planning.name.localeCompare(b.planning.name)
    || a.execution.name.localeCompare(b.execution.name);
}
