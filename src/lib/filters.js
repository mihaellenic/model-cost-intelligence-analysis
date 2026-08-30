export const FAMILY_COLORS = {
  claude:      '#fb7185',
  gpt:         '#4ade80',
  'gpt-oss':   '#f472b6',
  gemini:      '#60a5fa',
  deepseek:    '#a78bfa',
  qwen:        '#38bdf8',
  codestral:   '#f59e0b',
  devstral:    '#fb923c',
  mistral:     '#fbbf24',
  llama:       '#34d399',
  gemma:       '#c084fc',
  phi:         '#818cf8',
  granite:     '#e879f9',
  glm:         '#f87171',
  kimi:        '#2dd4bf',
  minimax:     '#facc15',
  'seed-code': '#fb7185',
  'kat-coder': '#22d3ee',
  relace:      '#a3e635',
  morph:       '#f97316',
  poolside:    '#c4b5fd',
  grok:        '#facc15',
};

export function colorFor(family) {
  if (FAMILY_COLORS[family]) return FAMILY_COLORS[family];
  let hash = 0;
  for (const char of family) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return `hsl(${Math.abs(hash) % 360} 70% 62%)`;
}

export function uniqueFamilies(models) {
  return [...new Set(models.map((m) => m.family))].sort();
}

export function applyFilters(models, opts) {
  const { families, withIntel, withPrice } = opts;
  return models.filter((m) => {
    if (families.size > 0 && !families.has(m.family)) return false;
    if (withIntel && m.intelligence == null) return false;
    if (withPrice && m.cost_per_1m_avg == null) return false;
    return true;
  });
}
