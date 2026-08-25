import { cosineSimilarity } from "../evidence/store.js";

/**
 * Semantic Anomaly Score (auxiliary, 0-1): embedding distance between the
 * response and its retrieved evidence/context. High = response drifted
 * semantically from what it was supposed to be grounded in. Feeds the
 * orchestrator's risk decision but never gates by itself.
 */
export function computeSAS(responseEmbedding, referenceEmbeddings) {
  if (referenceEmbeddings.length === 0 || responseEmbedding.length === 0) return 0;
  const avgSimilarity =
    referenceEmbeddings.reduce((sum, ref) => sum + cosineSimilarity(responseEmbedding, ref), 0) /
    referenceEmbeddings.length;
  return Math.max(0, 1 - avgSimilarity);
}
