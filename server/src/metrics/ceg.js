// "will" was in the original assertive list and is one of the most common auxiliary verbs in
// English ("this will cover...", "the tax will be calculated as...") — almost never actually
// signals certainty, just future tense. Dropped it and widened both lists with genuine
// certainty/hedge markers instead.
const HEDGE_PATTERN = /\b(might|may|could|possibly|perhaps|it seems|it appears|seems to|appears to|likely|probably|potentially|unclear|not certain|somewhat|arguably|presumably|I believe|I think)\b/gi;
const ASSERTIVE_PATTERN = /\b(definitely|certainly|always|guaranteed|proven|undoubtedly|absolutely|without (?:a )?doubt|unquestionably|clearly|obviously|it is (?:certain|known) that)\b/gi;

/**
 * Estimates the model's implied confidence from hedging vs. assertive language, 0-1.
 * Normalized by sentence count so a longer response doesn't rack up a more extreme score
 * just from having more sentences for a hedge/assertive word to land in.
 */
export function estimateConfidence(text) {
  const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const hedges = (text.match(HEDGE_PATTERN) ?? []).length;
  const assertions = (text.match(ASSERTIVE_PATTERN) ?? []).length;
  if (hedges === 0 && assertions === 0) return 0.6; // neutral default, no signal either way
  const hedgeRate = hedges / sentenceCount;
  const assertionRate = assertions / sentenceCount;
  return Math.min(1, Math.max(0, 0.5 + 0.4 * assertionRate - 0.4 * hedgeRate));
}

/** Confidence-Evidence Gap (0-5): |implied confidence - evidence support|, scaled to the 0-5 metric range. */
export function computeCEG(confidence, evidenceSupport) {
  return Math.abs(confidence - evidenceSupport) * 5;
}
