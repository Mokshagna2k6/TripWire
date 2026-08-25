const HEDGE_PATTERN = /\b(might|may|could|possibly|perhaps|it seems|likely|unclear|not certain)\b/gi;
const ASSERTIVE_PATTERN = /\b(definitely|certainly|always|guaranteed|proven|undoubtedly|will)\b/gi;

/** Estimates the model's implied confidence from hedging vs. assertive language, 0-1. */
export function estimateConfidence(text) {
  const hedges = (text.match(HEDGE_PATTERN) ?? []).length;
  const assertions = (text.match(ASSERTIVE_PATTERN) ?? []).length;
  if (hedges === 0 && assertions === 0) return 0.6; // neutral default
  return Math.min(1, Math.max(0, 0.5 + 0.1 * assertions - 0.1 * hedges));
}

/** Confidence-Evidence Gap (0-5): |implied confidence - evidence support|, scaled to the 0-5 metric range. */
export function computeCEG(confidence, evidenceSupport) {
  return Math.abs(confidence - evidenceSupport) * 5;
}
