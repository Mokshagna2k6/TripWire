/** Shared lexical-overlap helper used by several metrics (evidence support, CUR, RRE). */
export function wordSet(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

export function jaccard(a, b) {
  const sa = wordSet(a);
  const sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const w of sa) if (sb.has(w)) intersection++;
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
