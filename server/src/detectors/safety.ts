/**
 * Layer 1 of SHS (Safety/Harm Score): deterministic keyword/rule based classification.
 * Layer 2 (AI-Judge) lives in judge/judge.ts and only runs in DEEP verification mode.
 */
export interface SafetyHit {
  category: string;
  term: string;
  severity: number; // 0-5, per-category ceiling contribution
}

const RULES: { category: string; severity: number; terms: RegExp }[] = [
  { category: "violence", severity: 5, terms: /\b(kill|murder|bomb making|mass shooting)\b/gi },
  { category: "self_harm", severity: 5, terms: /\b(suicide method|how to self[- ]harm)\b/gi },
  { category: "weapons", severity: 4, terms: /\b(build a bomb|make a weapon|untraceable firearm)\b/gi },
  { category: "illegal_activity", severity: 3, terms: /\b(launder money|synthesize meth|hack into)\b/gi },
  { category: "hate_speech", severity: 4, terms: /\b(racial slur|ethnic cleansing)\b/gi },
  { category: "profanity", severity: 1, terms: /\b(damn|hell)\b/gi },
];

export function detectSafety(text: string): SafetyHit[] {
  const hits: SafetyHit[] = [];
  for (const rule of RULES) {
    const found = text.match(rule.terms);
    if (found) {
      for (const term of found) hits.push({ category: rule.category, term, severity: rule.severity });
    }
  }
  return hits;
}
