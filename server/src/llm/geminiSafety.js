/**
 * Maps Gemini's own built-in safety classifier output (returned free on every generateContent
 * call, already paid for regardless of whether we read it) into our hit format — OR'd alongside
 * the independent regex detector, never replacing it. Two independent signals catch more than
 * either alone, and neither can silently override the other: a real hit from either source still
 * counts, and our own regex still gates fully on its own merits with zero dependency on this.
 */
const CATEGORY_NAMES = {
  HARM_CATEGORY_HARASSMENT: "harassment",
  HARM_CATEGORY_HATE_SPEECH: "hate_speech",
  HARM_CATEGORY_SEXUALLY_EXPLICIT: "sexually_explicit",
  HARM_CATEGORY_DANGEROUS_CONTENT: "dangerous_content",
  HARM_CATEGORY_CIVIC_INTEGRITY: "civic_integrity",
};

// HIGH lands in hard-gate territory (matches our own severity>=4 threshold); MEDIUM only
// contributes to the softer SHS score; LOW/NEGLIGIBLE aren't included as hits at all.
const PROBABILITY_SEVERITY = {
  HIGH: 5,
  MEDIUM: 3,
};

/** Converts a generateContent response's candidate[0].safetyRatings into our {category, severity} hit shape. */
export function mapGeminiSafetyRatings(safetyRatings = []) {
  const hits = [];
  for (const rating of safetyRatings) {
    const severity = PROBABILITY_SEVERITY[rating.probability];
    if (!severity) continue;
    const category = CATEGORY_NAMES[rating.category] ?? "gemini_flagged";
    hits.push({ category, term: `gemini:${category}`, severity });
  }
  return hits;
}
