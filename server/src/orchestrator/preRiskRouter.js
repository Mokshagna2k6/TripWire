const HIGH_RISK_DOMAINS = new Set(["finance", "finance_india", "medical", "legal"]);
const HIGH_RISK_KEYWORDS = /\b(diagnos|prescri|invest advice|tax filing|legal advice|medical dosage|contract terms)\b/i;

/**
 * Pre-generation routing: classifies risk from domain + prompt content before
 * the LLM call is even made, so the orchestrator knows which verification
 * depth to run once the response comes back.
 */
export function classifyPreRisk(domain, prompt, riskTolerance) {
  const reasons = [];
  let score = 0;

  if (HIGH_RISK_DOMAINS.has(domain)) {
    score += 2;
    reasons.push(`domain "${domain}" is high-risk`);
  }
  if (HIGH_RISK_KEYWORDS.test(prompt)) {
    score += 2;
    reasons.push("prompt matches high-risk keyword pattern");
  }
  if (riskTolerance === "low") {
    score += 1;
    reasons.push("policy risk tolerance is low");
  }
  if (prompt.length > 1500) {
    score += 1;
    reasons.push("long/complex prompt");
  }

  const mode = score >= 3 ? "DEEP" : score >= 1 ? "STANDARD" : "FAST";
  if (reasons.length === 0) reasons.push("no elevated-risk signals detected");

  return { mode, reasons };
}
