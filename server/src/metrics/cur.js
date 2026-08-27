import { jaccard } from "./shared.js";

const UTILIZATION_THRESHOLD = 0.1;

/** Context Utilization Rate (0-1): share of retrieved evidence chunks actually reflected in the response. */
export function computeCUR(responseText, evidence) {
  // No retrieved context is not a utilization failure; there was nothing to use.
  if (evidence.length === 0) return 1;
  const used = evidence.filter((chunk) => jaccard(responseText, chunk.text) >= UTILIZATION_THRESHOLD).length;
  return used / evidence.length;
}
