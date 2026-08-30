export const OVERRIDE_SOURCE_TYPES = ['aa-web', 'vendor-docs', 'prior-capture'];

/**
 * D4-strict validation of the offline overrides map. Malformed entries FAIL
 * loudly — a bad override is never silently skipped.
 */
export function validateIntelligenceOverrides(overrides) {
  if (overrides == null) return [];
  if (!Array.isArray(overrides)) {
    throw new Error('intelligence overrides must be an array');
  }
  for (const entry of overrides) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`intelligence override entry must be an object; found ${typeof entry}`);
    }
    if (typeof entry.model_id !== 'string' || !entry.model_id) {
      throw new Error(`intelligence override missing model_id: ${JSON.stringify(entry)}`);
    }
    if (!Number.isFinite(entry.intelligence)) {
      throw new Error(`intelligence override for ${entry.model_id} has non-numeric intelligence: ${entry.intelligence}`);
    }
    if (typeof entry.source_url !== 'string' || !entry.source_url) {
      throw new Error(`intelligence override for ${entry.model_id} missing source_url`);
    }
    if (!OVERRIDE_SOURCE_TYPES.includes(entry.source_type)) {
      throw new Error(`intelligence override for ${entry.model_id} has invalid source_type: ${entry.source_type}`);
    }
    if (typeof entry.captured_at !== 'string' || !entry.captured_at) {
      throw new Error(`intelligence override for ${entry.model_id} missing captured_at`);
    }
  }
  return overrides;
}

/**
 * Applies overrides ONLY when the automatic AA join returned null for that
 * ID — an override never overwrites a live score. Returns the updated models
 * plus an audit trail of applied / skipped-live / unknown-ID entries.
 */
export function applyIntelligenceOverrides(records, overrides) {
  const validated = validateIntelligenceOverrides(overrides);
  const byId = new Map(validated.map((entry) => [entry.model_id, entry]));
  const applied = [];
  const skippedLive = [];
  const unknown = [];

  const models = records.map((record) => {
    const override = byId.get(record.id);
    if (!override) return record;
    if (record.intelligence != null) {
      skippedLive.push({ model_id: record.id, live_intelligence: record.intelligence });
      return record;
    }
    applied.push({
      model_id: record.id,
      intelligence: override.intelligence,
      source_url: override.source_url,
      source_type: override.source_type,
      captured_at: override.captured_at,
    });
    return {
      ...record,
      intelligence: override.intelligence,
      intelligence_source: 'manual',
      coding_index: override.coding_index ?? null,
      agentic_index: override.agentic_index ?? null,
      intelligence_scope: null,
      intelligence_citation: override.source_url,
    };
  });

  for (const entry of validated) {
    if (!records.some((record) => record.id === entry.model_id)) {
      unknown.push({ model_id: entry.model_id });
    }
  }

  return { models, applied, skippedLive, unknown };
}
