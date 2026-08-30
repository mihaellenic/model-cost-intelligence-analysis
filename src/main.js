import { createBarChart, updateBarChart } from './charts/bar.js';
import { createScatterChart, updateScatterChart } from './charts/scatter.js';
import { applyFilters, uniqueFamilies } from './lib/filters.js';
import { recommendPairs } from './lib/pair.js';
import { QUADRANT_INFO, classify, median } from './lib/quadrants.js';

const els = {
  meta: document.getElementById('meta'),
  filterFamily: document.getElementById('filter-family'),
  filterWithIntel: document.getElementById('filter-with-intel'),
  filterWithPrice: document.getElementById('filter-with-price'),
  mixPlanning: document.getElementById('mix-planning'),
  mixExecution: document.getElementById('mix-execution'),
  mixVerification: document.getElementById('mix-verification'),
  modelVerification: document.getElementById('model-verification'),
  pairContext: document.getElementById('pair-context'),
  pairResults: document.getElementById('pair-results'),
};

const state = {
  data: null,
  selectedFamilies: new Set(),
  highlightedModel: null,
};

const bar = createBarChart(document.getElementById('bar'));
const scatter = createScatterChart(document.getElementById('scatter'));

bar.__onClickModel = (i) => {
  const m = bar.__models?.[i];
  if (m) highlight(m.id);
};
scatter.__onPointClick = (m) => highlight(m.id);

function highlight(id) {
  state.highlightedModel = state.highlightedModel === id ? null : id;
  render();
}

async function load() {
  const res = await fetch('/models.json');
  state.data = await res.json();
  els.meta.innerHTML = `
    <div><b>${state.data.models.length}</b> models tracked</div>
    <div>Generated: <code>${new Date(state.data.generated_at).toLocaleString()}</code></div>
    <div>Refresh: <code>npm run data</code></div>
  `;
  populateFamilyFilter();
  attachFilterHandlers();
  render();
}

function populateFamilyFilter() {
  const fams = uniqueFamilies(state.data.models);
  els.filterFamily.innerHTML = fams
    .map((f) => `<option value="${f}">${f}</option>`)
    .join('');
}

function attachFilterHandlers() {
  els.filterFamily.addEventListener('change', () => {
    state.selectedFamilies = new Set([...els.filterFamily.selectedOptions].map((o) => o.value));
    render();
  });
  els.filterWithIntel.addEventListener('change', render);
  els.filterWithPrice.addEventListener('change', render);
  for (const input of [els.mixPlanning, els.mixExecution, els.mixVerification]) {
    input.addEventListener('input', render);
  }
  els.modelVerification.addEventListener('change', render);
}

function getFiltered() {
  return applyFilters(state.data.models, {
    families: state.selectedFamilies,
    withIntel: els.filterWithIntel.checked,
    withPrice: els.filterWithPrice.checked,
  });
}

function render() {
  const filtered = getFiltered();
  updateBarChart(bar, filtered);

  // Medians must describe the population that actually gets plotted (both
  // axes non-null), otherwise quadrant boundaries and picks disagree.
  const plottable = filtered.filter((m) => m.intelligence != null && m.cost_per_1m_avg != null);
  const medians = {
    medCost: median(plottable.map((m) => m.cost_per_1m_avg)),
    medIntel: median(plottable.map((m) => m.intelligence)),
  };
  updateScatterChart(scatter, filtered, medians);
  renderPair(plottable, medians);
}

function currentMix() {
  return {
    planning: Number(els.mixPlanning.value),
    execution: Number(els.mixExecution.value),
    verification: Number(els.mixVerification.value),
  };
}

function renderPair(plottable, medians) {
  const recommendation = recommendPairs(
    plottable,
    currentMix(),
    els.modelVerification.checked,
  );

  if (!recommendation.mix) {
    els.pairContext.textContent = recommendation.reason;
    els.pairResults.innerHTML = '';
    return;
  }

  const { planning, execution, verification } = recommendation.mix;
  const verificationLabel = els.modelVerification.checked
    ? 'Model-based verification bills the execution model.'
    : 'Deterministic verification is $0.';
  const floorLabel = recommendation.floors.planning == null
    ? 'Quality floors will appear when models are plottable.'
    : `Quality floors: planning ≥ p75 (${recommendation.floors.planning.toFixed(1)}) · execution ≥ median (${recommendation.floors.execution.toFixed(1)}).`;
  els.pairContext.innerHTML = `
    <span>${floorLabel}</span>
    <span>Normalized mix: ${formatPercent(planning)} planning · ${formatPercent(execution)} execution · ${formatPercent(verification)} verification.</span>
    <span>${verificationLabel}</span>
  `;

  if (recommendation.pairs.length === 0) {
    els.pairResults.innerHTML = `<div class="pair__empty">${recommendation.reason}</div>`;
    return;
  }

  els.pairResults.innerHTML = recommendation.pairs.slice(0, 3)
    .map((pair, index) => renderPairResult(pair, index, medians))
    .join('');
}

function renderPairResult(pair, index, medians) {
  const heading = index === 0 ? 'Recommended pair' : `Runner-up ${index}`;
  return `
    <article class="pair__result ${index === 0 ? 'pair__result--top' : 'pair__result--runner'}">
      <div class="pair__result-head">
        <span class="pair__label">${heading}</span>
        <strong>$${pair.expected_cost.toFixed(4)} <small>/1M workflow tokens</small></strong>
      </div>
      <div class="pair__models">
        ${renderRole(pair.planning, 'Planning', medians)}
        <div class="pair__arrow" aria-hidden="true">→</div>
        ${renderRole(pair.execution, 'Execution', medians)}
      </div>
    </article>
  `;
}

function renderRole(model, role, medians) {
  const quadrant = classify(model, medians.medCost, medians.medIntel);
  const quadrantLabel = QUADRANT_INFO[quadrant]?.label ?? 'Not classified';
  return `
    <div class="pair__model">
      <span class="pair__role">${role}</span>
      <div class="pair__name">${model.name}</div>
      <div class="pair__meta">${model.family} · Intel ${model.intelligence.toFixed(1)} · $${model.cost_per_1m_avg.toFixed(4)}/1M</div>
      <span class="pair__quadrant pair__quadrant--${quadrant}">${quadrantLabel}</span>
    </div>
  `;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

load().catch((err) => {
  els.meta.textContent = 'Failed to load /models.json. Run `npm run data && npm run build`.';
  console.error(err);
});
