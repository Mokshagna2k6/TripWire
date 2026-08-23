import type { PiiMatch, SecretMatch } from "../detectors/index.js";

const PII_SEVERITY: Record<string, number> = {
  ssn: 2,
  credit_card: 2,
  email: 0.5,
  phone: 0.75,
  ip_address: 0.5,
};

/** PII/Secret Leakage Score (0-5). Any secret match alone saturates the hard-gate threshold. */
export function computePLS(pii: PiiMatch[], secrets: SecretMatch[]): number {
  const piiScore = pii.reduce((sum, m) => sum + (PII_SEVERITY[m.type] ?? 0.5), 0);
  const secretScore = secrets.length > 0 ? 5 : 0; // confirmed credential leak = max severity
  return Math.min(5, piiScore + secretScore);
}
