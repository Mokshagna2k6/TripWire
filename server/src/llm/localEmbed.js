// Deterministic local embedding. No embeddings API is called anywhere in the
// system, so this is the only embedder — SchemaX evidence matching, SAS and CBG
// all rest on it.
//
// It stays a PURE function of its input text. Chunk embeddings are computed once
// at seed time and stored in Postgres, then compared against a query embedding
// computed at runtime; anything corpus-dependent (true IDF, a learned vocabulary)
// would drift between those two moments and silently degrade retrieval. So the
// common-word problem IDF solves is handled here with a static stopword list
// plus sublinear term frequency instead.
//
// ponytail: a real sentence-transformer (ONNX MiniLM) would beat this
// comfortably, at the cost of a ~90MB model download and a native dependency.
// Swap it in behind this same signature and re-seed.

export const DIMS = 256;

// Function words carry no topical signal but dominate raw term counts — they are
// the reason a 64-dim word-count embedding rated almost any two English
// sentences as similar.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "at", "by", "for", "with",
  "about", "to", "from", "in", "on", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "can", "could", "must", "this", "that", "these",
  "those", "it", "its", "as", "not", "no", "so", "than", "then", "there", "here",
  "you", "your", "we", "our", "they", "their", "he", "she", "his", "her",
]);

const SUFFIXES = ["ings", "ing", "ers", "er", "ed", "es", "s"];

/**
 * Light suffix stripping so "reimburse" / "reimbursed" / "reimbursing" collide
 * on purpose.
 *
 * The trailing-vowel pass is what makes it actually work: stripping "es" alone
 * turns "expenses" into "expens" while "expense" stays whole, so the pair never
 * collides — the exact failure this is meant to prevent. Normalising trailing
 * "e" on both forms lands them both on "expens".
 *
 * It does over-stem some pairs ("billing" and "bill" both reach "bill"). For
 * similarity scoring that's the cheap direction to err in: a false merge costs
 * a little precision, a missed merge costs the match entirely.
 */
function stem(word) {
  let out = word;
  if (out.length > 4) {
    for (const suffix of SUFFIXES) {
      if (out.endsWith(suffix) && out.length - suffix.length >= 4) {
        out = out.slice(0, out.length - suffix.length);
        break;
      }
    }
  }
  while (out.length > 4 && out.endsWith("e")) out = out.slice(0, -1);
  return out;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function tokenize(text) {
  return text.toLowerCase().split(/\W+/).filter(Boolean).map(stem);
}

export function localEmbed(text) {
  const tokens = tokenize(text);

  // Bigrams give the representation some word-order sensitivity, so "evidence
  // supports the claim" and "claim supports the evidence" stop being identical.
  const terms = [];
  for (const token of tokens) {
    if (!STOPWORDS.has(token)) terms.push(token);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    // Bigrams span stopwords rather than skipping them — "out of pocket" is a
    // phrase worth keeping intact.
    terms.push(`${tokens[i]}_${tokens[i + 1]}`);
  }

  const counts = new Map();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);

  const vec = new Array(DIMS).fill(0);
  for (const [term, count] of counts) {
    const h = hash(term);
    // Signed hashing: the sign bit makes colliding terms cancel on average
    // instead of always reinforcing, which keeps collisions from inventing
    // similarity that isn't there.
    const sign = (h & 1) === 0 ? 1 : -1;
    // Sublinear TF — a word repeated ten times is more relevant than one used
    // once, but not ten times more.
    const weight = 1 + Math.log(count);
    // Unigrams carry the topic; bigrams are corroboration, weighted lower.
    const termWeight = term.includes("_") ? 0.5 : 1;
    vec[h % DIMS] += sign * weight * termWeight;
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
