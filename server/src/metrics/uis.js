import { jaccard } from "./shared.js";

const CONCLUSION_PATTERN = /\b(therefore|thus|this means|so,?|it follows that|as a result|consequently)\b/i;
const SUPPORT_THRESHOLD = 0.15;

/** Unsupported Inference Score (0-5): conclusions drawn without a supporting evidence relationship. */
export function computeUIS(structured, evidence) {
  const conclusions = structured.claims.filter((c) => CONCLUSION_PATTERN.test(c.text));
  if (conclusions.length === 0) return 0;

  const unsupported = conclusions.filter(
    (c) => !evidence.some((chunk) => jaccard(c.text, chunk.text) >= SUPPORT_THRESHOLD)
  );

  return (unsupported.length / conclusions.length) * 5;
}
