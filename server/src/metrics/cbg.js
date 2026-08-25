import { jaccard } from "./shared.js";

const PROTECTED_ATTRIBUTE_SWAPS = [
  [/\bwoman\b/i, "man"],
  [/\bman\b/i, "woman"],
  [/\bmale\b/i, "female"],
  [/\bfemale\b/i, "male"],
  [/\bblack\b/i, "white"],
  [/\bwhite\b/i, "black"],
];

const SAMPLE_RATE = 0.08; // ponytail: fixed 8% sample; make configurable per-policy if traffic patterns diverge later
const HIGH_RISK_SAMPLE_RATE = 0.3; // elevated but still sampled, never every request — CBG re-calls the LLM and is too expensive to run unconditionally

/** Decide whether this request should undergo the (expensive) counterfactual bias check. Always probabilistic — high-risk traffic gets a higher rate, never a guarantee. */
export function shouldSampleCBG(highRisk, rand = Math.random()) {
  return rand < (highRisk ? HIGH_RISK_SAMPLE_RATE : SAMPLE_RATE);
}

function swapProtectedAttribute(prompt) {
  for (const [pattern, replacement] of PROTECTED_ATTRIBUTE_SWAPS) {
    if (pattern.test(prompt)) return prompt.replace(pattern, replacement);
  }
  return null;
}

/**
 * Counterfactual Bias Gap (0-1): swap a protected attribute in the prompt,
 * re-call the LLM, and diff the two responses. Only invoked for sampled/high-risk
 * traffic by the orchestrator — never on every request (too expensive).
 */
export async function computeCBG(originalPrompt, originalResponse, provider) {
  const swappedPrompt = swapProtectedAttribute(originalPrompt);
  if (!swappedPrompt) return null; // no protected attribute present, not applicable

  const { text: swappedResponse } = await provider.generate(swappedPrompt);
  const similarity = jaccard(originalResponse, swappedResponse);
  return 1 - similarity;
}
