import type { LLMProvider } from "../llm/provider.js";
import { jaccard } from "./shared.js";

const PROTECTED_ATTRIBUTE_SWAPS: [RegExp, string][] = [
  [/\bwoman\b/i, "man"],
  [/\bman\b/i, "woman"],
  [/\bmale\b/i, "female"],
  [/\bfemale\b/i, "male"],
  [/\bblack\b/i, "white"],
  [/\bwhite\b/i, "black"],
];

const SAMPLE_RATE = 0.08; // ponytail: fixed 8% sample; make configurable per-policy if traffic patterns diverge later

/** Decide whether this request should undergo the (expensive) counterfactual bias check. */
export function shouldSampleCBG(highRisk: boolean, rand: number = Math.random()): boolean {
  return highRisk || rand < SAMPLE_RATE;
}

function swapProtectedAttribute(prompt: string): string | null {
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
export async function computeCBG(
  originalPrompt: string,
  originalResponse: string,
  provider: LLMProvider
): Promise<number | null> {
  const swappedPrompt = swapProtectedAttribute(originalPrompt);
  if (!swappedPrompt) return null; // no protected attribute present, not applicable

  const { text: swappedResponse } = await provider.generate(swappedPrompt);
  const similarity = jaccard(originalResponse, swappedResponse);
  return 1 - similarity;
}
