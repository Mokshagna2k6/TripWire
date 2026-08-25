/**
 * Safety/Harm Score (0-5). Layer 1 = deterministic keyword rules (always run).
 * Layer 2 = optional AI-Judge severity (DEEP mode only), blended in when present.
 */
export function computeSHS(hits, judgeSeverity) {
  const layer1 = hits.length === 0 ? 0 : Math.max(...hits.map((h) => h.severity)) + Math.min(1, hits.length - 1) * 0.5;
  const layer1Clamped = Math.min(5, layer1);
  if (judgeSeverity === undefined) return layer1Clamped;
  return Math.min(5, Math.max(layer1Clamped, judgeSeverity));
}
