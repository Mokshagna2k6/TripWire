import { prisma } from "../db.js";

const MAX_RETRIEVAL_CANDIDATES = 500;

function queryTerms(text) {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])].slice(0, 12);
}

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
 * domain. Postgres first narrows candidates using indexed document ownership and
 * lexical terms; only the bounded candidate set is scored in application code.
 */
export async function retrieveEvidence(domain, queryText, provider, topK = 4) {
  const queryEmbedding = await provider.embed(queryText);

  const terms = queryTerms(queryText);
  const chunks = await prisma.evidenceChunk.findMany({
    where: {
      document: { domain },
      ...(terms.length > 0 ? { OR: terms.map((term) => ({ text: { contains: term, mode: "insensitive" } })) } : {}),
    },
    include: { document: { select: { id: true, title: true, source: true, authority: true } } },
    take: MAX_RETRIEVAL_CANDIDATES,
  });

  const scored = [];
  for (const chunk of chunks) {
    scored.push({
      chunkId: chunk.id,
      documentId: chunk.document.id,
      title: chunk.document.title,
      source: chunk.document.source,
      authority: chunk.document.authority,
      text: chunk.text,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    });
  }

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}
