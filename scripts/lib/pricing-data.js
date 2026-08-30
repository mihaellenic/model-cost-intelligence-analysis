export function validatePricingCapture(capture) {
  if (!capture || typeof capture !== 'object') {
    throw new Error('pricing capture is missing or malformed');
  }
  if (capture.error) {
    throw new Error(`pricing capture error ${capture.error}`);
  }
  if (!Array.isArray(capture.models)) {
    throw new Error('pricing capture must contain a models array');
  }
  return capture.models;
}
