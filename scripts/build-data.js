import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveMetadata,
  isPaidCanonicalModel,
  matchAllowlist,
} from './lib/derive-metadata.js';
import {
  validateAaCapture,
} from './lib/aa-data.js';
import { validatePricingCapture } from './lib/pricing-data.js';
import { collapseCatalogVariants } from './lib/catalog-collapse.js';
import { resolveAaIntelligence } from './lib/aa-resolution.js';
import { resolveVariantInheritance } from './lib/variant-inherit.js';

function safeRead(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function averageCost(model) {
  return (model.prompt_per_1m + model.completion_per_1m) / 2;
}

function round4(value) {
  return Math.round(value * 1e4) / 1e4;
}

function provider(model) {
  return {
    name: model.id,
    prompt_per_1m: model.prompt_per_1m,
    completion_per_1m: model.completion_per_1m,
  };
}

function makeModelRecord(model, rule, aaModels) {
  const metadata = deriveMetadata(model, rule);
  const resolved = resolveAaIntelligence(model.id, aaModels);
  const intelligence = resolved.intelligence;
  const cheapestProvider = provider(model);
  const record = {
    id: model.id,
    name: model.name,
    ...metadata,
    intelligence,
    intelligence_source: intelligence == null ? null : 'artificial-analysis',
    coding_index: resolved.coding_index,
    agentic_index: resolved.agentic_index,
    intelligence_scope: resolved.intelligence_scope,
    cost_per_1m_avg: round4(averageCost(model)),
    cheapest_provider: cheapestProvider,
    providers: [cheapestProvider],
    context_length: model.context ?? null,
  };
  if (resolved.effort_scores) record.effort_scores = resolved.effort_scores;
  return record;
}

function applyVariantInheritance(record, rawVariant, nonCollapse, baseById, aaModels, inheritedIds) {
  const rawBase = baseById.get(nonCollapse.base_id);
  if (!rawBase) return { record, inherited: null, skipReason: 'base_missing' };
  const baseScore = resolveAaIntelligence(rawBase.id, aaModels);
  const base = {
    ...rawBase,
    intelligence: baseScore.intelligence,
    coding_index: baseScore.coding_index,
    agentic_index: baseScore.agentic_index,
    inherit_from: inheritedIds.has(rawBase.id) ? rawBase.id : null,
  };
  const inherited = resolveVariantInheritance(nonCollapse, rawVariant, base);
  if (inherited.skip) return { record, inherited: null, skipReason: inherited.skip };
  return {
    record: {
      ...record,
      intelligence: inherited.intelligence,
      intelligence_source: 'artificial-analysis',
      coding_index: inherited.coding_index,
      agentic_index: inherited.agentic_index,
      intelligence_scope: inherited.intelligence_scope,
      inherit_from: inherited.inherit_from,
    },
    inherited,
    skipReason: null,
  };
}

export function buildModelRecords({
  allowlist,
  priceList,
  aaCapture,
  generatedAt = new Date().toISOString(),
  pricingSource = null,
}) {
  const aaModels = validateAaCapture(aaCapture);
  const eligibleCatalog = priceList
    .filter(isPaidCanonicalModel)
    .map((model) => ({ model, rule: matchAllowlist(model, allowlist) }))
    .filter(({ rule }) => rule != null)
    .map(({ model, rule }) => ({ ...model, rule }));
  const collapsed = collapseCatalogVariants(eligibleCatalog);
  const collisions = [];
  const inheritances = [];
  const inheritanceSkips = [];
  const baseById = new Map(collapsed.models.map((model) => [model.id, model]));
  const nonCollapseByVariant = new Map(
    collapsed.nonCollapses.map((entry) => [entry.variant_id, entry]),
  );
  const inheritedIds = new Set();
  const models = collapsed.models.map(({ rule, ...model }) => {
    const record = makeModelRecord(model, rule, aaModels);
    const resolved = resolveAaIntelligence(model.id, aaModels);
    if (resolved.collision) collisions.push(resolved.collision);
    const nonCollapse = nonCollapseByVariant.get(model.id);
    if (!nonCollapse) return record;
    const { record: finalRecord, inherited, skipReason } = applyVariantInheritance(record, model, nonCollapse, baseById, aaModels, inheritedIds);
    if (inherited) {
      inheritedIds.add(model.id);
      inheritances.push({
        variant_id: model.id,
        base_id: inherited.inherit_from,
        matched_phrase: inherited.matched_phrase,
        fields_inherited: inherited.fields_inherited,
      });
    } else {
      inheritanceSkips.push({ variant_id: model.id, base_id: nonCollapse.base_id, reason: skipReason });
    }
    return finalRecord;
  });

  return {
    generated_at: generatedAt,
    benchmarks_fetched_at: aaCapture.fetched_at ?? null,
    intelligence_index_version: aaCapture.intelligence_index_version ?? null,
    sources: {
      intelligence: aaCapture.source ?? null,
      pricing: pricingSource,
    },
    audit: {
      collapses: collapsed.collapses,
      non_collapses: collapsed.nonCollapses,
      collisions,
      inheritances,
      inheritance_skips: inheritanceSkips,
    },
    models,
  };
}

export function main(root = process.cwd()) {
  const allowlist = safeRead(resolve(root, 'scripts/family-allowlist.json'));
  const priceCapture = safeRead(resolve(root, 'public/pricing-raw.json'));
  const aaCapture = safeRead(resolve(root, 'public/aa-raw.json'));
  if (!allowlist) throw new Error('family allowlist is missing or malformed');

  const output = buildModelRecords({
    allowlist,
    priceList: validatePricingCapture(priceCapture),
    aaCapture,
    pricingSource: priceCapture?.source ?? null,
  });
  const outPath = resolve(root, 'public/models.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  const withScore = output.models.filter((model) => model.intelligence != null).length;
  const withPrice = output.models.filter((model) => model.cost_per_1m_avg != null).length;
  const effortMedians = output.models.filter((model) => model.intelligence_scope === 'effort-median').length;
  const variantInherited = output.models.filter((model) => model.intelligence_scope === 'variant-inherited').length;
  console.log(`[build-data] wrote ${outPath}`);
  console.log(`[build-data] ${output.models.length} models, ${withScore} with intelligence, ${withPrice} with pricing`);
  console.log(`[build-data] ${output.audit.collapses.length} variants collapsed, ${effortMedians} effort-median scores, ${variantInherited} variant-inherited scores`);
  for (const collapse of output.audit.collapses) {
    console.log(`[build-data] collapse ${JSON.stringify(collapse)}`);
  }
  for (const inheritance of output.audit.inheritances) {
    console.log(`[build-data] inheritance ${JSON.stringify(inheritance)}`);
  }
  for (const skip of output.audit.inheritance_skips) {
    console.log(`[build-data] inheritance skip ${JSON.stringify(skip)}`);
  }
  for (const collision of output.audit.collisions) {
    console.warn(`[build-data] AA collision ${JSON.stringify(collision)}`);
  }
  console.log('[build-data] intelligence source: artificial-analysis');
  return output;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error('[build-data] failed:', error.message);
    process.exitCode = 1;
  }
}
