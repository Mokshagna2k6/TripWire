import type { RetrievedChunk } from "../evidence/store.js";
import { jaccard } from "./shared.js";

const UTILIZATION_THRESHOLD = 0.1;

/** Context Utilization Rate (0-1): share of retrieved evidence chunks actually reflected in the response. */
export function computeCUR(responseText: string, evidence: RetrievedChunk[]): number {
  if (evidence.length === 0) return 0;
  const used = evidence.filter((chunk) => jaccard(responseText, chunk.text) >= UTILIZATION_THRESHOLD).length;
  return used / evidence.length;
}
