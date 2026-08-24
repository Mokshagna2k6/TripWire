/** Detects PII patterns in text. Regex-based — sufficient for MVP fast-path detection. */
export interface PiiMatch {
  type: string;
  value: string;
}

const PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  credit_card: /\b(?:\d[ -]*?){13,16}\b/g,
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const [type, pattern] of Object.entries(PATTERNS)) {
    const found = text.match(pattern);
    if (found) {
      for (const value of found) matches.push({ type, value });
    }
  }
  return matches;
}
