export function isPaidCanonicalModel(model) {
  if (!model?.id || model.id.includes(':')) return false;
  const average = (model.prompt_per_1m + model.completion_per_1m) / 2;
  return Number.isFinite(average) && average > 0;
}

export function matchAllowlist(model, rules) {
  const id = model?.id?.toLowerCase();
  if (!id || id.includes(':')) return null;

  for (const rule of rules) {
    if (!id.startsWith(rule.prefix)) continue;
    if ((rule.exclude || []).some((pattern) => id.includes(pattern.toLowerCase()))) return null;
    return rule;
  }

  return null;
}

export function deriveMetadata(model, rule) {
  return { family: rule.family };
}
