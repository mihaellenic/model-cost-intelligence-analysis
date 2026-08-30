export function parseBenchmarkResponse(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
    const found = payload && typeof payload === 'object'
      ? `object with data: ${Array.isArray(payload.data) ? 'array' : typeof payload.data}`
      : typeof payload;
    throw new Error(`expected response.data to be an array; found ${found}`);
  }
  return payload.data;
}

export function validateBenchmarkCapture(capture) {
  if (!capture || typeof capture !== 'object') {
    throw new Error('benchmarks capture is missing or malformed');
  }
  if (capture.error) {
    const detail = capture.error_detail ? `: ${capture.error_detail}` : '';
    throw new Error(`benchmarks capture error ${capture.error}${detail}`);
  }
  if (!Array.isArray(capture.benchmarks)) {
    throw new Error('benchmarks capture must contain a benchmarks array');
  }
  return capture.benchmarks;
}

export function indexBenchmarks(benchmarks) {
  const benchmarkById = new Map();
  for (const benchmark of benchmarks) {
    if (!benchmark?.model_permaslug || benchmark.intelligence_index == null) continue;
    if (!benchmarkById.has(benchmark.model_permaslug)) {
      benchmarkById.set(benchmark.model_permaslug, benchmark);
    }
  }
  return benchmarkById;
}

export function resolveBenchmark(modelId, benchmarkById) {
  const exact = benchmarkById.get(modelId);
  if (exact) return { benchmark: exact, intelligence_scope: null };

  if ((modelId.match(/:/g) ?? []).length !== 1) {
    return { benchmark: null, intelligence_scope: null };
  }

  const canonicalId = modelId.slice(0, modelId.indexOf(':'));
  const inherited = benchmarkById.get(canonicalId);
  if (inherited?.intelligence_index == null) {
    return { benchmark: null, intelligence_scope: null };
  }

  return { benchmark: inherited, intelligence_scope: 'variant-inherited' };
}
