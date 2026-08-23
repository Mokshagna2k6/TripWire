import type { ThresholdAction } from "../policy/policyEngine.js";

export const MAX_REGENERATE_RETRIES = 2;

/** Corrective feedback prompt for the REGENERATE loop: tells Gemini exactly what was wrong. */
export function buildCorrectiveFeedbackPrompt(originalPrompt: string, priorResponse: string, reasons: string[]): string {
  return [
    `Your previous response failed verification for these specific reasons:`,
    ...reasons.map((r) => `- ${r}`),
    ``,
    `Previous response:\n"""${priorResponse}"""`,
    ``,
    `Rewrite your answer to the original request below, fixing the issues above. Do not repeat the same mistakes.`,
    ``,
    `Original request: ${originalPrompt}`,
  ].join("\n");
}

/** Single-pass edit for the EDIT_CLARIFY action: lighter touch than a full regenerate. */
export function buildEditClarifyPrompt(originalPrompt: string, priorResponse: string, reasons: string[]): string {
  return [
    `Lightly revise the response below to address these gaps, without changing its overall content or structure:`,
    ...reasons.map((r) => `- ${r}`),
    ``,
    `Response to revise:\n"""${priorResponse}"""`,
    ``,
    `Original request: ${originalPrompt}`,
  ].join("\n");
}

/** After exhausting regenerate retries, escalate: hard-gate failures escalate to BLOCK, everything else to HUMAN_REVIEW. */
export function escalateAfterRetries(lastActionWasHardGate: boolean): ThresholdAction {
  return lastActionWasHardGate ? "BLOCK" : "HUMAN_REVIEW";
}
