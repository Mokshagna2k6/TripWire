import { detectPii, type PiiMatch } from "./pii.js";
import { detectSecrets, type SecretMatch } from "./secrets.js";
import { detectSafety, type SafetyHit } from "./safety.js";
import { checkSchema, type SchemaCheckResult } from "./schema.js";

export { detectPii, detectSecrets, detectSafety, checkSchema };
export type { PiiMatch, SecretMatch, SafetyHit, SchemaCheckResult };

export interface FastDetectorResult {
  pii: PiiMatch[];
  secrets: SecretMatch[];
  safety: SafetyHit[];
  schema: SchemaCheckResult;
}

export function runFastDetectors(
  text: string,
  expectedFormat?: { format?: "json"; requiredFields?: string[] }
): FastDetectorResult {
  // ponytail: these are cheap regex scans run inline; parallelize via worker
  // threads only if profiling shows this is a bottleneck at scale.
  return {
    pii: detectPii(text),
    secrets: detectSecrets(text),
    safety: detectSafety(text),
    schema: checkSchema(text, expectedFormat),
  };
}

export interface HardGateResult {
  triggered: boolean;
  reasons: string[];
}

/** Confirmed credential leak / severe privacy / severe safety = immediate BLOCK. */
export function checkHardGate(result: FastDetectorResult): HardGateResult {
  const reasons: string[] = [];

  if (result.secrets.length > 0) {
    reasons.push(`confirmed credential leak: ${result.secrets.map((s) => s.type).join(", ")}`);
  }

  const severePii = result.pii.filter((p) => p.type === "ssn" || p.type === "credit_card");
  if (severePii.length > 0) {
    reasons.push(`severe privacy violation: ${severePii.map((p) => p.type).join(", ")}`);
  }

  const severeSafety = result.safety.filter((s) => s.severity >= 4);
  if (severeSafety.length > 0) {
    reasons.push(`severe safety violation: ${[...new Set(severeSafety.map((s) => s.category))].join(", ")}`);
  }

  return { triggered: reasons.length > 0, reasons };
}
