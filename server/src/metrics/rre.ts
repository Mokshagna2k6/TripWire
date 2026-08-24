import type { RetrievedChunk } from "../evidence/store.js";
import { jaccard } from "./shared.js";

const RELEVANCE_THRESHOLD = 0.3;
const RETENTION_THRESHOLD = 0.1;

/**
 * Retrieval Retention Efficacy (0-1): of the evidence chunks that were highly
 * relevant to the query, what fraction actually survived into the response's
 * key spans (i.e. weren't retrieved-then-dropped).
 */
export function computeRRE(keySpans: string[], evidence: RetrievedChunk[]): number {
  const relevant = evidence.filter((e) => e.similarity >= RELEVANCE_THRESHOLD);
  if (relevant.length === 0) return 1; // nothing highly relevant was available to retain
  const retained = relevant.filter((chunk) =>
    keySpans.some((span) => jaccard(span, chunk.text) >= RETENTION_THRESHOLD)
  );
  return retained.length / relevant.length;
}
