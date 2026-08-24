import { prisma } from "../db.js";
import type { LLMProvider } from "../llm/provider.js";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  source: string;
  authority: string;
  text: string;
  similarity: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
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
export async function retrieveEvidence(
  domain: string,
  queryText: string,
  provider: LLMProvider,
  topK = 4
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await provider.embed(queryText);

  const docs = await prisma.evidenceDocument.findMany({
    where: { domain },
    include: { chunks: true },
  });

  const scored: RetrievedChunk[] = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      const embedding = chunk.embedding as unknown as number[];
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
