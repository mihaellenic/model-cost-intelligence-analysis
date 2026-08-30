export function parseAaPage(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`expected response object; found ${typeof payload}`);
  }
  if (!Array.isArray(payload.data)) {
    throw new Error(`expected response.data to be an array; found ${typeof payload.data}`);
  }
  if (!payload.pagination || typeof payload.pagination !== 'object'
    || typeof payload.pagination.has_more !== 'boolean') {
    throw new Error('expected response.pagination.has_more to be a boolean');
  }
  if (payload.pagination.total_pages != null
    && (!Number.isInteger(payload.pagination.total_pages) || payload.pagination.total_pages < 1)) {
    throw new Error('expected response.pagination.total_pages to be a positive integer');
  }
  return payload;
}

export function validateAaCapture(capture) {
  if (!capture || typeof capture !== 'object') {
    throw new Error('AA capture is missing or malformed');
  }
  if (capture.error) {
    const detail = capture.error_detail ? `: ${capture.error_detail}` : '';
    throw new Error(`AA capture error ${capture.error}${detail}`);
  }
  if (!Array.isArray(capture.models)) {
    throw new Error('AA capture must contain a models array');
  }
  return capture.models;
}
