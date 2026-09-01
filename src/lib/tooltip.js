/**
 * Pure tooltip-line builder for model chips (B5 Part B).
 *
 * Extends the chart-tooltip content pattern (bar.js/scatter.js) into a shared
 * pure function so the pair card's model chips render the same verbatim
 * record values with the same rounding. No DOM, no storage — same purity
 * contract as pair.js/lens.js/vendor.js.
 *
 * D4: values are passed through verbatim; the only formatting is the same
 * `.toFixed` rounding used elsewhere in the UI.
 */

export function tooltipLines(model) {
  const lines = [
    `Intelligence: ${model.intelligence?.toFixed(2) ?? '—'}`,
  ];
  if (model.intelligence_source) lines.push('Intelligence source: Artificial Analysis');
  if (model.intelligence_scope === 'effort-median') {
    lines.push('Intelligence: effort-variant median');
  }
  if (model.intelligence_scope === 'variant-inherited') {
    lines.push(`Intelligence: inherited from ${model.inherit_from ?? 'base'}`);
  }
  if (model.intelligence_source === 'manual') {
    lines.push('Intelligence: manual override (cited)');
  }
  // Per-type indexes (B5): always present, `—` when null — a missing line
  // would read as "not measured", a `—` reads as "measured, unavailable".
  lines.push(`Coding index: ${formatIndex(model.coding_index)} · Agentic index: ${formatIndex(model.agentic_index)}`);
  if (model.cost_per_1m_avg != null) lines.push(`Cost: $${model.cost_per_1m_avg.toFixed(4)} / 1M (avg)`);
  if (model.cheapest_provider?.name) lines.push(`Cheapest: ${model.cheapest_provider.name}`);
  if (model.context_length != null) lines.push(`Context: ${model.context_length.toLocaleString()} tokens`);
  return lines;
}

function formatIndex(value) {
  return value == null ? '—' : value.toFixed(1);
}
