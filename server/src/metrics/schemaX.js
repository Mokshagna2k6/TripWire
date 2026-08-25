import { jaccard } from "./shared.js";

const SUPPORT_THRESHOLD = 0.15;
const AUTHORITY_SCORE = { high: 1, medium: 0.6, low: 0.3 };

function claimSupported(claim, evidence) {
  return evidence.some((chunk) => jaccard(claim.text, chunk.text) >= SUPPORT_THRESHOLD);
}

export function computeSchemaX(structured, evidence, schemaCheck) {
  const totalClaims = structured.claims.length;
  const supportedClaims = structured.claims.filter((c) => claimSupported(c, evidence)).length;
  // No evidence retrieved (domain has no RAG corpus, e.g. general/medical/enterprise, or an
  // open-domain prompt) does not mean the claims are unsupported — there's nothing to check
  // them against, so don't penalize. Only score claims down when evidence actually exists
  // and doesn't back them up (the case RAG-covered domains like finance_india are for).
  const evidenceSupport = evidence.length === 0 || totalClaims === 0 ? 1 : supportedClaims / totalClaims;

  const sourceQuality =
    evidence.length === 0
      ? 0.5
      : evidence.reduce((sum, e) => sum + (AUTHORITY_SCORE[e.authority] ?? 0.5), 0) / evidence.length;

  const schemaCompliance = schemaCheck.applicable ? (schemaCheck.valid ? 1 : 0) : 1;

  const score = 0.5 * evidenceSupport + 0.25 * sourceQuality + 0.25 * schemaCompliance;

  return { score, evidenceSupport, sourceQuality, schemaCompliance, supportedClaims, totalClaims };
}
