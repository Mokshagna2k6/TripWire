/**
 * Token accounting for VCO (Verification Cost Overhead, spec point 36).
 *
 * VCO only means something if "what the LLM call would have cost anyway" is
 * kept separate from "what governance added on top". So the pipeline tracks
 * two buckets:
 *   baseline   = the single generate() call the app would have made with no
 *                gateway in front of it.
 *   governance = everything TripWire caused — regenerate retries, the
 *                EDIT_CLARIFY pass, the AI Judge, and CBG's counterfactual call.
 */

export const ZERO_TOKENS = { input: 0, output: 0 };

export function addTokens(a, b) {
  return { input: a.input + (b?.input ?? 0), output: a.output + (b?.output ?? 0) };
}

export function totalTokens(t) {
  return t.input + t.output;
}

/**
 * VCO = governance tokens / baseline tokens. 0.30 means governance cost 30% on
 * top of the raw model call. Returns 0 when no governance call was made (the
 * FAST clean path), and 0 rather than Infinity if baseline is somehow empty.
 */
export function computeVCO(baseline, governance) {
  const base = totalTokens(baseline);
  if (base === 0) return 0;
  return totalTokens(governance) / base;
}
