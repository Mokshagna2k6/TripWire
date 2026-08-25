const MAX_EVIDENCE_CHARS = 2000;

/** Builds the final prompt sent to the LLM: user prompt + trimmed, relevance-ranked evidence context. */
export function optimizeContext(prompt, evidence) {
  if (evidence.length === 0) return prompt;

  let used = 0;
  const parts = [];
  for (const chunk of evidence) {
    if (used + chunk.text.length > MAX_EVIDENCE_CHARS) break;
    parts.push(`- (${chunk.source}) ${chunk.text}`);
    used += chunk.text.length;
  }

  return `Context (use only if relevant, cite naturally):\n${parts.join("\n")}\n\nRequest:\n${prompt}`;
}
