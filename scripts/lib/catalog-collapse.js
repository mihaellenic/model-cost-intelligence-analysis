function siblingIdFromTarget(target) {
  try {
    if (!target.startsWith('/') && new URL(target).hostname !== 'openrouter.ai') return null;
    const url = new URL(target, 'https://openrouter.ai');
    const path = url.pathname.replace(/^\/+/, '').replace(/^models\//, '');
    return path.includes('/') ? path : null;
  } catch {
    return null;
  }
}

export function extractSiblingReference(description) {
  if (typeof description !== 'string') return null;
  const sameUnderlying = description.match(/same underlying model as\s+\[[^\]]+\]\(([^)]+)\)/i);
  if (sameUnderlying) {
    const siblingId = siblingIdFromTarget(sameUnderlying[1]);
    return siblingId ? { siblingId, matchedPhrase: 'same underlying model as' } : null;
  }
  if (/identical capabilities/i.test(description)) {
    const phraseIndex = description.toLowerCase().indexOf('identical capabilities');
    const siblingLink = [...description.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .filter((match) => match.index <= phraseIndex)
      .at(-1);
    const siblingId = siblingLink && siblingIdFromTarget(siblingLink[1]);
    return siblingId ? { siblingId, matchedPhrase: 'identical capabilities' } : null;
  }
  return null;
}

export function isProtectedVariant(id) {
  const tail = id.toLowerCase().split('/').at(-1);
  if (/(?:-chat|-instant)(?:$|-)/.test(tail)) return true;
  return tail === 'o1-pro'
    || tail === 'gpt-5-pro'
    || /^gpt-5\.[245]-pro$/.test(tail);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function materiallyDiffers(variant, base) {
  return ['context', 'per_request_limits', 'supported_parameters', 'architecture']
    .some((field) => stableJson(variant[field] ?? null) !== stableJson(base[field] ?? null));
}

export function collapseCatalogVariants(models) {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const references = new Map(models
    .map((model) => [model.id, extractSiblingReference(model.description)])
    .filter(([, reference]) => reference != null));
  const collapsedIds = new Set();
  const collapses = [];
  const nonCollapses = [];

  for (const variant of models) {
    const reference = references.get(variant.id);
    if (!reference) continue;
    if (isProtectedVariant(variant.id)) {
      nonCollapses.push({ variant_id: variant.id, reason: 'protected_variant' });
      continue;
    }

    const base = modelsById.get(reference.siblingId);
    if (!base) {
      nonCollapses.push({ variant_id: variant.id, reason: 'missing_sibling', base_id: reference.siblingId });
      continue;
    }
    if (references.has(base.id)) {
      collapsedIds.add(variant.id);
      nonCollapses.push({ variant_id: variant.id, reason: 'collapse_chain', base_id: base.id });
      continue;
    }
    if (materiallyDiffers(variant, base)) {
      nonCollapses.push({ variant_id: variant.id, reason: 'material_difference', base_id: base.id });
      continue;
    }

    collapsedIds.add(variant.id);
    collapses.push({
      variant_id: variant.id,
      base_id: base.id,
      matched_phrase: reference.matchedPhrase,
    });
  }

  return {
    models: models.filter((model) => !collapsedIds.has(model.id)),
    collapses,
    nonCollapses,
  };
}
