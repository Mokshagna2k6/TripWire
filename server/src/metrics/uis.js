import { jaccard } from "./shared.js";

// Widened from the original 7-word list, which only caught explicit logical connectors —
// most real inference in natural language doesn't use one ("The customer cancelled. They must
// be unhappy with the service" has no "therefore" but is still an unflagged inference leap).
// Added: causal/evidential connectors, modal-certainty phrasing, and implication verbs.
const CONCLUSION_PATTERN = /\b(therefore|thus|hence|accordingly|this (?:means|shows|suggests|implies|proves)|so,|it follows that|as a result|consequently|which means|in other words|must (?:be|have)|(?:clearly|obviously|evidently),|indicates that|proves that|given (?:this|that))\b/i;
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
