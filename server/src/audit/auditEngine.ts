import { prisma } from "../db.js";
import type { MetricsBundle } from "../metrics/index.js";
import type { RetrievedChunk } from "../evidence/store.js";
import type { JudgeOutput } from "../judge/judge.js";
import type { RiskDecision } from "../risk/riskEngine.js";

export interface AuditRecordInput {
  requestId: string;
  policyId: string;
  model: string;
  promptMeta: Record<string, unknown>;
  rawResponse: string;
  structuredRepresentation: unknown;
  metrics: MetricsBundle;
  evidence: RetrievedChunk[];
  judgeOutput: JudgeOutput | null;
  decision: RiskDecision;
  regenerationCount: number;
  latencyMs: number;
  tokens: { input: number; output: number };
  finalOutcome: string;
}

/** Writes the full pipeline trace to Postgres. This is the system of record for every decision TripWire makes. */
export async function recordAuditTrace(input: AuditRecordInput) {
  return prisma.auditTrace.create({
    data: {
      requestId: input.requestId,
      policyId: input.policyId,
      model: input.model,
      promptMeta: input.promptMeta as object,
      rawResponse: input.rawResponse,
      structuredRepresentation: input.structuredRepresentation as object,
      metrics: input.metrics as unknown as object,
      evidence: input.evidence as unknown as object,
      judgeOutput: (input.judgeOutput as unknown as object) ?? undefined,
      riskLevel: input.decision.riskLevel,
      action: input.decision.action,
      regenerationCount: input.regenerationCount,
      latencyMs: input.latencyMs,
      tokens: input.tokens as unknown as object,
      finalOutcome: input.finalOutcome,
    },
  });
}
