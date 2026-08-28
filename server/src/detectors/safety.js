/**
 * Layer 1 of SHS (Safety/Harm Score): deterministic keyword/rule based classification.
 * Categories follow the MLCommons hazard taxonomy (the standard Llama Guard / most safety
 * classifiers are benchmarked against), scoped to what's realistic for a general-purpose +
 * finance/medical enterprise gateway — defamation/IP/elections dropped as lower priority.
 * Layer 2 (AI-Judge) lives in judge/judge.js and only runs in DEEP verification mode.
 */
const RULES = [
  // Hard-gate tier (severity >= 4) — catastrophic/irreversible if the content is genuine.
  {
    category: "violent_crimes",
    severity: 5,
    terms: /\b(kill (?:him|her|them|someone)|commit murder|carry out (?:a )?mass shooting|plan(?:ning)? an attack|how to (?:assassinate|kidnap))\b/gi,
  },
  {
    category: "self_harm",
    severity: 5,
    terms: /\b(suicide method|how to (?:self[- ]harm|end my life|kill myself)|ways to (?:overdose|self[- ]harm))\b/gi,
  },
  {
    category: "indiscriminate_weapons",
    severity: 5,
    terms: /\b(build a bomb|synthesize (?:sarin|nerve gas|anthrax)|make (?:a bioweapon|chemical weapon|nuclear device))\b/gi,
  },
  {
    category: "child_exploitation",
    severity: 5,
    terms: /\b(child (?:sexual abuse|exploitation|pornography)|csam)\b/gi,
  },
  {
    category: "weapons",
    severity: 4,
    terms: /\b(build (?:an )?untraceable (?:gun|firearm)|3d[- ]print(?:ed)? (?:gun|firearm)|make a weapon|convert (?:a )?semi[- ]automatic)\b/gi,
  },
  {
    category: "hate_speech",
    severity: 4,
    terms: /\b(racial slur|ethnic cleansing|genocide (?:of|against)|subhuman (?:race|people))\b/gi,
  },
  {
    category: "sex_crimes",
    severity: 4,
    terms: /\b(human trafficking (?:route|method)|how to (?:groom|traffic) (?:a )?(?:child|minor|person))\b/gi,
  },

  // Soft-score tier (severity 1-3) — contextual, feeds SHS, never hard-gates alone.
  {
    category: "non_violent_crimes",
    severity: 3,
    terms: /\b(launder money|synthesize meth|hack into (?:someone|a system) without authorization|how to (?:pick a lock|bypass security) to steal)\b/gi,
  },
  {
    category: "specialized_advice",
    severity: 2,
    terms: /\b(guaranteed returns?|stop taking your (?:medication|prescription)|self[- ]diagnose without a doctor|invest your (?:life savings|retirement) in)\b/gi,
  },
  {
    category: "privacy_violation",
    severity: 3,
    terms: /\b(find (?:someone'?s|their) (?:home address|current location)|track (?:someone|a person) without (?:consent|knowing)|dox(?:x)?ing)\b/gi,
  },
  { category: "profanity", severity: 1, terms: /\b(damn|hell)\b/gi },
];

// A trigger phrase immediately preceded by a refusal ("I cannot provide...", "I won't explain...")
// describes what the model declined to do, not an actual violation — the literal phrase still
// matches, but the surrounding text flips its meaning entirely. Regex can't understand that on
// its own, so explicitly check for a refusal preamble in the window right before each match and
// drop it rather than flagging a safe refusal as the thing it refused to do.
const REFUSAL_GUARD = /\b(?:cannot|can't|won't|will not|refuse to|unable to|don't|shouldn't|avoid)\s+(?:provide|explain|share|give|tell|help\s+with|generate|answer)\b[\s\S]{0,40}$/i;
const GUARD_WINDOW = 60;

function isNegated(text, matchIndex) {
  const preceding = text.slice(Math.max(0, matchIndex - GUARD_WINDOW), matchIndex);
  return REFUSAL_GUARD.test(preceding);
}

export function detectSafety(text) {
  const hits = [];
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.terms)) {
      if (isNegated(text, match.index)) continue;
      hits.push({ category: rule.category, term: match[0], severity: rule.severity });
    }
  }
  return hits;
}
