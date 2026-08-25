import { prisma } from "../db.js";

/** Writes the full pipeline trace to Postgres. This is the system of record for every decision TripWire makes. */
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
    },
  });
}
