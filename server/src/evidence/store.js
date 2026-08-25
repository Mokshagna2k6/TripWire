import { prisma } from "../db.js";

export function cosineSimilarity(a, b) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieve the top-k most relevant evidence chunks for a query, scoped to a
 * domain. Similarity computed in application code (no pgvector dependency).
 */
export async function retrieveEvidence(domain, queryText, provider, topK = 4) {
  const queryEmbedding = await provider.embed(queryText);

  const docs = await prisma.evidenceDocument.findMany({
    where: { domain },
    include: { chunks: true },
  });

  const scored = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      const embedding = chunk.embedding;
      scored.push({
        chunkId: chunk.id,
        documentId: doc.id,
        title: doc.title,
        source: doc.source,
        authority: doc.authority,
        text: chunk.text,
        similarity: cosineSimilarity(queryEmbedding, embedding),
      });
    }
  }

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}
