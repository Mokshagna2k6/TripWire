/** Rework Overhead (0-1): how much of the regeneration budget this request has already consumed. */
export function computeRO(regenerationCount: number, maxRetries: number): number {
  if (maxRetries <= 0) return 0;
  return Math.min(1, regenerationCount / maxRetries);
}
