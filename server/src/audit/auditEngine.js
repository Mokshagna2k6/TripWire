import { prisma } from "../db.js";

/** Writes the full pipeline trace (and optional human review) to Postgres in a single transaction/query. */
export async function recordAuditTrace(input) {
  return prisma.auditTrace.create({
    data: {
      requestId: input.requestId,
      policyId: input.policyId,
      model: input.model,
      promptMeta: input.promptMeta,
      rawResponse: input.rawResponse,
      structuredRepresentation: input.structuredRepresentation,
      metrics: input.metrics,
      evidence: input.evidence,
      judgeOutput: input.judgeOutput ?? undefined,
      riskLevel: input.decision.riskLevel,
      action: input.decision.action,
      regenerationCount: input.regenerationCount,
      latencyMs: input.latencyMs,
      tokens: input.tokens,
      finalOutcome: input.finalOutcome,
      ...(input.humanReviewData ? {
        humanReview: {
          create: input.humanReviewData
        }
      } : {})
    },
    include: {
      humanReview: true
    }
  });
}
