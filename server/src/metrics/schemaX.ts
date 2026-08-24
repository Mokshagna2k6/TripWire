import type { Claim, StructuredRepresentation } from "../analyzer/responseAnalyzer.js";
import type { RetrievedChunk } from "../evidence/store.js";
import type { SchemaCheckResult } from "../detectors/schema.js";
import { jaccard } from "./shared.js";

const SUPPORT_THRESHOLD = 0.15;
const AUTHORITY_SCORE: Record<string, number> = { high: 1, medium: 0.6, low: 0.3 };

export interface SchemaXResult {
  score: number; // 0-1, weighted composite
  evidenceSupport: number; // ES, 0-1
  sourceQuality: number; // SQ, 0-1
  schemaCompliance: number; // SC, 0-1
  supportedClaims: number;
  totalClaims: number;
}

function claimSupported(claim: Claim, evidence: RetrievedChunk[]): boolean {
  return evidence.some((chunk) => jaccard(claim.text, chunk.text) >= SUPPORT_THRESHOLD);
}

export function computeSchemaX(
  structured: StructuredRepresentation,
  evidence: RetrievedChunk[],
  schemaCheck: SchemaCheckResult
): SchemaXResult {
  const totalClaims = structured.claims.length;
  const supportedClaims = structured.claims.filter((c) => claimSupported(c, evidence)).length;
  const evidenceSupport = totalClaims === 0 ? 1 : supportedClaims / totalClaims;

  const sourceQuality =
    evidence.length === 0
      ? 0.5
      : evidence.reduce((sum, e) => sum + (AUTHORITY_SCORE[e.authority] ?? 0.5), 0) / evidence.length;

  const schemaCompliance = schemaCheck.applicable ? (schemaCheck.valid ? 1 : 0) : 1;

  const score = 0.5 * evidenceSupport + 0.25 * sourceQuality + 0.25 * schemaCompliance;

  return { score, evidenceSupport, sourceQuality, schemaCompliance, supportedClaims, totalClaims };
}
