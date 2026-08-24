/** Error Density (0-5): heuristic count of structural/textual anomalies per sentence. */
export function computeErrorDensity(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) return 0;

  let issues = 0;

  // repeated consecutive words ("the the")
  issues += (text.match(/\b(\w+)\s+\1\b/gi) ?? []).length;

  // unbalanced brackets/braces/quotes
  for (const [open, close] of [["{", "}"], ["[", "]"], ["(", ")"]] as const) {
    const opens = (text.split(open).length - 1) - (text.split(close).length - 1);
    if (opens !== 0) issues += Math.abs(opens);
  }

  // truncated/garbled sentence fragments (ends mid-word with no punctuation and very short)
  issues += sentences.filter((s) => s.length < 3).length;

  return Math.min(5, (issues / sentences.length) * 5);
}
