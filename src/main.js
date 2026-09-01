import { createBarChart, updateBarChart } from './charts/bar.js';
import { createScatterChart, updateScatterChart } from './charts/scatter.js';
import { applyFilters, uniqueFamilies } from './lib/filters.js';
import { recommendPairs, DEFAULT_MIX, DEFAULT_BAND } from './lib/pair.js';
import { computeLensCard } from './lib/lens.js';
import { tooltipLines } from './lib/tooltip.js';
import { freshnessLine } from './lib/freshness.js';
import { QUADRANT_INFO, classify, median } from './lib/quadrants.js';

// D23: mix + band are frozen constants, displayed read-only. The decision
// layer still takes them as parameters (pair.js/lens.js/vendor.js untouched);
// only the UI inputs are gone. Re-enabling editability is UI-only work.
const MIX = DEFAULT_MIX;
const BAND = DEFAULT_BAND;

const els = {
  meta: document.getElementById('meta'),
  filterFamily: document.getElementById('filter-family'),
  filterWithIntel: document.getElementById('filter-with-intel'),
  filterWithPrice: document.getElementById('filter-with-price'),
  pairParams: document.getElementById('pair-params'),
  modelVerification: document.getElementById('model-verification'),
  pairContext: document.getElementById('pair-context'),
  pairResults: document.getElementById('pair-results'),
  pairRanking: document.getElementById('pair-ranking'),
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
  const res = await fetch(`${import.meta.env.BASE_URL}models.json`);
  state.data = await res.json();
  els.meta.innerHTML = `
    <div><b>${state.data.models.length}</b> models tracked</div>
    <div>Generated: <code>${new Date(state.data.generated_at).toLocaleString()}</code></div>
    <div>Refresh: <code>npm run data</code></div>
  `;
  document.getElementById('foot-freshness').textContent = freshnessLine(
    state.data.generated_at,
    state.data.benchmarks_fetched_at,
  );
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

function renderPair(plottable, medians) {
  const recommendation = recommendPairs(
    plottable,
    MIX,
    els.modelVerification.checked,
    BAND,
  );

  if (!recommendation.mix) {
    els.pairContext.textContent = recommendation.reason;
    els.pairResults.innerHTML = '';
    els.pairRanking.hidden = true;
    return;
  }

  const { planning, execution, verification } = recommendation.mix;
  const verificationLabel = els.modelVerification.checked
    ? 'Model-based verification bills the execution model.'
    : 'Deterministic verification is $0.';
  const floorLabel = recommendation.floors.planning == null
    ? 'Quality floors will appear when models are plottable.'
    : `Planning floor: frontier band −${recommendation.floors.bandWidth.toFixed(1)} → ≥${recommendation.floors.planning.toFixed(1)} (max ${recommendation.floors.max.toFixed(1)}) · execution ≥ median (${recommendation.floors.execution.toFixed(1)}).`;
  els.pairParams.innerHTML = `
    <span class="pair__params-label">Params</span>
    <span>mix ${formatPercent(planning)} / ${formatPercent(execution)} / ${formatPercent(verification)}</span>
    <span>frontier band ${recommendation.floors.bandWidth.toFixed(1)}</span>
  `;
  els.pairContext.innerHTML = `
    <span>${floorLabel}</span>
    <span>Normalized mix: ${formatPercent(planning)} planning · ${formatPercent(execution)} execution · ${formatPercent(verification)} verification.</span>
    <span>${verificationLabel}</span>
  `;

  const card = computeLensCard(
    plottable,
    MIX,
    els.modelVerification.checked,
    BAND,
  );

  if (!card.row1) {
    els.pairResults.innerHTML = `<div class="pair__empty">${card.reason}</div>`;
    els.pairRanking.hidden = true;
    return;
  }

  const rowSpecs = [
    { kind: 'strategy', html: renderStrategyRow(card.row1, medians, 'STRATEGY: MINIMIZE SPEND',
      'The cheapest qualifying pair, ranked by expected workflow cost.') },
    ...card.vendors.topRows.map((row) => ({ kind: 'vendor', html: renderVendorRow(row, medians, card.row1.expected_cost) })),
  ];
  els.pairResults.innerHTML = rowSpecs
    .map(({ kind, html }) => wrapRow(html, kind))
    .join('');

  const collapsed = renderCollapsedSections(card, medians);
  els.pairRanking.hidden = recommendation.pairs.length <= 1;
  els.pairRanking.innerHTML = `
    <details class="pair__collapsed">
      <summary>Show ranking view</summary>
      ${recommendation.pairs.slice(1).map((pair, index) => renderRankedRow(pair, index + 2, medians)).join('')}
    </details>
  `;
  els.pairRanking.insertAdjacentHTML('afterbegin', collapsed);
}

function renderCollapsedSections(card, medians) {
  const ceilingHeadline = card.ceiling
    ? `Capability ceiling — $${card.ceiling.expected_cost.toFixed(2)}/1M · ${card.ceiling.vs_anchor.toFixed(0)}× the cheapest pair`
    : 'Capability ceiling — no qualifying pair';
  const lensHeadline = card.lenses.length
    ? `Bottleneck lenses — planning step-up $${card.lenses[0].expected_cost.toFixed(2)} · execution step-up $${card.lenses[1] ? card.lenses[1].expected_cost.toFixed(2) : '—'}`
    : 'Bottleneck lenses — none qualify';
  const vendorHeadline = `All vendor stacks — ${card.vendors.allVendors.length} with qualifying pairs`;

  const ceilingBody = card.ceiling
    ? renderCeilingRow(card.ceiling, medians)
    : '<div class="pair__empty">No qualifying pair.</div>';
  const lensBody = card.lenses.length
    ? card.lenses.map((lens) => renderLensRow(lens, medians)).join('')
    : '<div class="pair__empty">No qualifying lens.</div>';
  const vendorBody = card.vendors.allVendors.length
    ? card.vendors.allVendors.map(({ vendor, pair }) => renderVendorRow(pair, medians, card.row1.expected_cost)).join('')
    : '<div class="pair__empty">No vendor can field a qualifying pair.</div>';

  return `
    <details class="pair__collapsed">
      <summary>${ceilingHeadline}</summary>
      ${ceilingBody}
    </details>
    <details class="pair__collapsed">
      <summary>${lensHeadline}</summary>
      ${lensBody}
    </details>
    <details class="pair__collapsed">
      <summary>${vendorHeadline}</summary>
      ${vendorBody}
    </details>
  `;
}

function renderVendorRow(row, medians, anchor) {
  const multiple = anchor > 0
    ? `${(row.expected_cost / anchor).toFixed(0)}× the cheapest pair`
    : '';
  return `
    <div class="pair__result-head">
      <span class="pair__label pair__label--vendor">CONSTRAINT: ${row.vendor.toUpperCase()} ONLY</span>
      <strong>$${row.expected_cost.toFixed(4)} <small>/1M workflow tokens</small></strong>
      ${multiple ? `<span class="pair__multiple">${multiple}</span>` : ''}
    </div>
    <div class="pair__question">One vendor, one bill — what does consolidating cost?</div>
    <div class="pair__models">
      ${renderRole(row.planning, 'Planning', medians, row.separation)}
      <div class="pair__arrow" aria-hidden="true">→</div>
      ${renderRole(row.execution, 'Execution', medians)}
    </div>
  `;
}

function wrapRow(html, kind) {
  const cls = kind === 'strategy'
    ? 'pair__result--top'
    : kind === 'ceiling'
      ? 'pair__result--ceiling'
      : kind === 'vendor'
        ? 'pair__result--vendor'
        : 'pair__result--lens';
  return `<article class="pair__result ${cls}">${html}</article>`;
}

function renderStrategyRow(pair, medians, label, sub) {
  return `
    <div class="pair__result-head">
      <span class="pair__label">${label}</span>
      <strong>$${pair.expected_cost.toFixed(4)} <small>/1M workflow tokens</small></strong>
    </div>
    ${sub ? `<div class="pair__question">${sub}</div>` : ''}
    <div class="pair__models">
      ${renderRole(pair.planning, 'Planning', medians, pair.separation)}
      <div class="pair__arrow" aria-hidden="true">→</div>
      ${renderRole(pair.execution, 'Execution', medians)}
    </div>
  `;
}

function renderLensRow(lens, medians) {
  const isPlanning = lens.type === 'planning-step-up';
  const question = isPlanning
    ? 'What if planning quality is my bottleneck?'
    : 'What if execution quality is my bottleneck?';
  return `
    <div class="pair__result-head">
      <span class="pair__label pair__label--lens">LENS: ${isPlanning ? 'PLANNING STEP-UP' : 'EXECUTION STEP-UP'}</span>
      <strong>$${lens.expected_cost.toFixed(4)} <small>/1M workflow tokens</small></strong>
    </div>
    <div class="pair__question">${question}</div>
    <div class="pair__models">
      ${renderRole(lens.planning, 'Planning', medians, lens.separation)}
      <div class="pair__arrow" aria-hidden="true">→</div>
      ${renderRole(lens.execution, 'Execution', medians)}
    </div>
  `;
}

function renderCeilingRow(ceiling, medians) {
  const multiple = ceiling.vs_anchor != null
    ? `${ceiling.vs_anchor.toFixed(0)}× the cheapest pair`
    : '';
  return `
    <div class="pair__result-head">
      <span class="pair__label pair__label--ceiling">CEILING: MAXIMUM CAPABILITY</span>
      <strong>$${ceiling.expected_cost.toFixed(2)} <small>/1M workflow tokens</small></strong>
      ${multiple ? `<span class="pair__multiple">${multiple}</span>` : ''}
    </div>
    <div class="pair__question">A reference, not a strategy — what money buys regardless of cost.</div>
    <div class="pair__models">
      ${renderRole(ceiling.planning, 'Planning', medians, ceiling.separation)}
      <div class="pair__arrow" aria-hidden="true">→</div>
      ${renderRole(ceiling.execution, 'Execution', medians)}
    </div>
  `;
}

function renderRankedRow(pair, rank, medians) {
  return `
    <article class="pair__result pair__result--ranked">
      <div class="pair__result-head">
        <span class="pair__label pair__label--ranked">Rank ${rank}</span>
        <strong>$${pair.expected_cost.toFixed(4)} <small>/1M workflow tokens</small></strong>
      </div>
      <div class="pair__models">
        ${renderRole(pair.planning, 'Planning', medians, pair.separation)}
        <div class="pair__arrow" aria-hidden="true">→</div>
        ${renderRole(pair.execution, 'Execution', medians)}
      </div>
    </article>
  `;
}

function renderRole(model, role, medians, separation) {
  const quadrant = classify(model, medians.medCost, medians.medIntel);
  const quadrantLabel = QUADRANT_INFO[quadrant]?.label ?? 'Not classified';
  const separationChip = separation
    ? `<span class="pair__separation">${separationLabel(separation)}</span>`
    : '';
  return `
    <div class="pair__model" data-tip="${escapeAttr(tooltipLines(model).join('\n'))}">
      <span class="pair__role">${role}</span>
      <div class="pair__name">${model.name}</div>
      <div class="pair__meta">${model.family} · Intel ${model.intelligence.toFixed(1)} · $${model.cost_per_1m_avg.toFixed(4)}/1M</div>
      <span class="pair__quadrant pair__quadrant--${quadrant}">${quadrantLabel}</span>${separationChip}
    </div>
  `;
}

function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function separationLabel(separation) {
  const parts = [];
  if (separation.pricePath) parts.push(`${separation.priceRatio.toFixed(1)}× price`);
  if (separation.scorePath) parts.push(`${separation.scoreGap.toFixed(1)} pts`);
  return `separation: ${parts.join(' · ')}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

load().catch((err) => {
  els.meta.textContent = `Failed to load ${import.meta.env.BASE_URL}models.json. Run \`npm run data && npm run build\`.`;
  console.error(err);
});
