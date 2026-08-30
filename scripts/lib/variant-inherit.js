import { extractSiblingReference, isProtectedVariant, stableJson } from './catalog-collapse.js';

const WATCHED_FIELDS = ['context', 'per_request_limits', 'supported_parameters', 'architecture'];

// A variant's watched-field value is a subset of the base's when every entry
// in the variant's value also appears in the base's (stableJson-comparable).
// Arrays: every element of the variant's array must be present in the base's.
// Objects: every key of the variant's object must be present in the base's
// with an equal value. Null/undefined variant values are always a subset.
function isSubset(variantValue, baseValue) {
  if (variantValue == null) return true;
  if (Array.isArray(variantValue)) {
    if (!Array.isArray(baseValue)) return false;
    const baseSet = new Set(baseValue.map(stableJson));
    return variantValue.every((entry) => baseSet.has(stableJson(entry)));
  }
  if (variantValue && typeof variantValue === 'object') {
    if (!baseValue || typeof baseValue !== 'object' || Array.isArray(baseValue)) return false;
    return Object.entries(variantValue).every(([key, value]) => (
      Object.prototype.hasOwnProperty.call(baseValue, key)
      && stableJson(baseValue[key]) === stableJson(value)
    ));
  }
  return stableJson(variantValue) === stableJson(baseValue);
}

function subtractOnlyDelta(variant, base) {
  return WATCHED_FIELDS.every((field) => isSubset(variant[field] ?? null, base[field] ?? null));
}

/**
 * D17 rule: a variant retained as a separate row by the material-difference
 * guard may inherit its linked base's intelligence ONLY when ALL of:
 *   1. the description resolves a sibling (extractSiblingReference);
 *   2. the description affirmatively states capability identity (implied by
 *      the extractor match — no separate check);
 *   3. the base exists in the post-collapse catalog with a non-null AA score;
 *   4. the watched-field delta is subtract-only (variant ⊆ base).
 * Excluded: protected variants; one hop only (a base that itself inherits).
 *
 * Pure, no I/O. Mirrors the aa-resolution.js result shape so build-data.js
 * composition stays trivial.
 */
export function resolveVariantInheritance(nonCollapse, variant, base) {
  if (!nonCollapse || nonCollapse.reason !== 'material_difference') {
    return { skip: 'not_material_difference' };
  }
  if (isProtectedVariant(variant.id)) {
    return { skip: 'protected_variant' };
  }
  const reference = extractSiblingReference(variant.description);
  if (!reference) {
    return { skip: 'no_sibling_reference' };
  }
  if (!base || base.id !== reference.siblingId) {
    return { skip: 'base_missing' };
  }
  if (base.intelligence == null) {
    return { skip: 'base_unscored' };
  }
  if (base.inherit_from) {
    return { skip: 'inheritance_chain' };
  }
  if (!subtractOnlyDelta(variant, base)) {
    return { skip: 'additive_delta' };
  }

  return {
    intelligence: base.intelligence,
    coding_index: base.coding_index ?? null,
    agentic_index: base.agentic_index ?? null,
    intelligence_scope: 'variant-inherited',
    inherit_from: base.id,
    matched_phrase: reference.matchedPhrase,
    fields_inherited: WATCHED_FIELDS.filter((field) => (
      stableJson(variant[field] ?? null) !== stableJson(base[field] ?? null)
    )),
  };
}
