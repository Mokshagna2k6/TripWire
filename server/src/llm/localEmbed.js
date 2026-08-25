// ponytail: deterministic 64-dim hashing embedding. xAI's API has no embeddings
// endpoint, so this is the only embedder in the system now (not just a fallback)
// — cosine similarity over evidence chunks still works fine on it.
const DIMS = 64;

export function localEmbed(text) {
  const vec = new Array(DIMS).fill(0);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    vec[hash % DIMS] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
