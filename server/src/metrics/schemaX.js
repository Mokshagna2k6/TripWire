import { jaccard } from "./shared.js";

const SUPPORT_THRESHOLD = 0.15;
const AUTHORITY_SCORE = { high: 1, medium: 0.6, low: 0.3 };

function claimSupported(claim, evidence) {
  return evidence.some((chunk) => jaccard(claim.text, chunk.text) >= SUPPORT_THRESHOLD);
}

export function computeSchemaX(structured, evidence, schemaCheck) {
  const totalClaims = structured.claims.length;
  const supportedClaims = structured.claims.filter((c) => claimSupported(c, evidence)).length;
  // A missing corpus is unverified, not fully supported. Keep the neutral score separate
  // from genuine evidence support so policy cannot mistake absence of evidence for proof.
  const evidenceSupport = totalClaims === 0 ? 1 : evidence.length === 0 ? 0.5 : supportedClaims / totalClaims;

  const sourceQuality =
    evidence.length === 0
      ? 0.5
      : evidence.reduce((sum, e) => sum + (AUTHORITY_SCORE[e.authority] ?? 0.5), 0) / evidence.length;

  const schemaCompliance = schemaCheck.applicable ? (schemaCheck.valid ? 1 : 0) : 1;

  const score = 0.5 * evidenceSupport + 0.25 * sourceQuality + 0.25 * schemaCompliance;

  return { score, evidenceSupport, sourceQuality, schemaCompliance, supportedClaims, totalClaims };
}
