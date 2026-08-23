/**
 * Response Analyzer: turns the raw LLM text into a structured representation
 * (claims, entities, citations, structure, intent, key spans) that downstream
 * metrics and the evidence comparator operate on. Heuristic, not ML-based —
 * sufficient for an MVP; a real NLP pipeline can slot in behind this module
 * boundary later without touching callers.
 */
export interface Claim {
  text: string;
  hasNumber: boolean;
  hasCitation: boolean;
}

export interface StructuredRepresentation {
  claims: Claim[];
  entities: string[];
  citations: string[];
  structure: "json" | "list" | "prose";
  intent: "informational" | "instructional" | "transactional" | "creative";
  keySpans: string[];
}

const CITATION_PATTERN = /\[(\d+)\]|https?:\/\/\S+/g;
const ENTITY_PATTERN = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
const NUMBER_PATTERN = /\b\d+([.,]\d+)?%?\b/;
const STOP_ENTITY_WORDS = new Set(["I", "The", "This", "That", "It", "A", "An"]);

export function analyzeResponse(text: string): StructuredRepresentation {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const claims: Claim[] = sentences.map((s) => ({
    text: s,
    hasNumber: NUMBER_PATTERN.test(s),
    hasCitation: /\[(\d+)\]|https?:\/\//.test(s),
  }));

  const citations = [...text.matchAll(CITATION_PATTERN)].map((m) => m[0]);

  const entities = [
    ...new Set(
      [...text.matchAll(ENTITY_PATTERN)]
        .map((m) => m[1])
        .filter((e) => !STOP_ENTITY_WORDS.has(e) && e.length > 2)
    ),
  ].slice(0, 25);

  let structure: StructuredRepresentation["structure"] = "prose";
  if (/^\s*[{[]/.test(text.trim())) structure = "json";
  else if (/^\s*[-*\d]+[.)]\s/m.test(text)) structure = "list";

  let intent: StructuredRepresentation["intent"] = "informational";
  if (/\b(steps?|how to|instructions?)\b/i.test(text)) intent = "instructional";
  else if (/\b(order|purchase|book|confirm|payment)\b/i.test(text)) intent = "transactional";
  else if (/\b(story|poem|imagine|once upon)\b/i.test(text)) intent = "creative";

  const keySpans = claims.filter((c) => c.hasNumber || c.hasCitation).map((c) => c.text);

  return { claims, entities, citations, structure, intent, keySpans };
}
