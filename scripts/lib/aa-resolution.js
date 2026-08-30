function catalogTail(id) {
  return String(id ?? '').split('/').slice(1).join('/');
}

export function normalizeAaSlug(slug) {
  return String(slug ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeCatalogSlug(id) {
  const withoutDate = catalogTail(id).replace(/[-.]?(?:20\d{2})?\d{2}\d{2}$/, '');
  return normalizeAaSlug(withoutDate);
}

function aaScore(model) {
  const score = model?.evaluations?.artificial_analysis_intelligence_index;
  return Number.isFinite(score) ? score : null;
}

function effortBase(slug) {
  const match = String(slug ?? '').toLowerCase().match(/^(.*?)[-_.](low|medium|high|xhigh)$/);
  return match ? { normalizedBase: normalizeAaSlug(match[1]), effort: match[2] } : null;
}

function median(scores) {
  const sorted = [...scores].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function indexFields(model) {
  return {
    coding_index: model?.evaluations?.artificial_analysis_coding_index ?? null,
    agentic_index: model?.evaluations?.artificial_analysis_agentic_index ?? null,
  };
}

export function resolveAaIntelligence(catalogId, aaModels) {
  const normalizedCatalog = normalizeCatalogSlug(catalogId);
  const scoredModels = aaModels.filter((model) => aaScore(model) != null);
  const exact = scoredModels.filter((model) => normalizeAaSlug(model.slug) === normalizedCatalog);
  const exactScores = [...new Set(exact.map(aaScore))];
  if (exactScores.length > 1) {
    return {
      intelligence: null,
      coding_index: null,
      agentic_index: null,
      intelligence_scope: null,
      collision: {
        catalog_id: catalogId,
        aa_slugs: exact.map((model) => model.slug),
        scores: exact.map(aaScore),
      },
    };
  }
  if (exact.length > 0) {
    return {
      intelligence: aaScore(exact[0]),
      ...indexFields(exact[0]),
      intelligence_scope: null,
    };
  }

  const effortModels = scoredModels.filter((model) => effortBase(model.slug)?.normalizedBase === normalizedCatalog);
  if (effortModels.length === 0) {
    return { intelligence: null, coding_index: null, agentic_index: null, intelligence_scope: null };
  }
  const effortScores = effortModels.map(aaScore).sort((a, b) => a - b);
  return {
    intelligence: median(effortScores),
    coding_index: null,
    agentic_index: null,
    intelligence_scope: 'effort-median',
    effort_scores: effortScores,
  };
}
