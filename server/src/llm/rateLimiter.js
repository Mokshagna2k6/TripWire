// 4500ms (~13 RPM) turned out to sit above gemini-2.5-flash's actual free-tier cap in
// practice — every 429 forced a silent retry (spacing + backoff stacking to 15-20s+ with
// nothing logged, so it looked like unexplained latency rather than what it was: rate
// limiting). Dropped to ~8.6 RPM for real headroom.
const MIN_INTERVAL_MS = 7000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

// A per-day quota exhaustion (RequestsPerDay / PerDayPerProject) will not resolve itself
// within a few seconds of backoff — it resets on Google's clock, not ours. Retrying it is
// pure wasted latency that still ends in the same failure; fail fast instead.
function isDailyQuotaExhausted(err) {
  const msg = err?.message || "";
  return /PerDay/i.test(msg);
}

function isTransient(err) {
  const msg = err?.message || "";
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand/i.test(msg) && !isDailyQuotaExhausted(err);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an LLM provider so every `generate` call is serialized with a minimum
 * spacing between requests and retried with exponential backoff on transient
 * rate-limit/overload errors (429, 503, RESOURCE_EXHAUSTED, "high demand").
 * `embed` is untouched — it's local, no external call to throttle.
 */
export function withRateLimit(provider, { minIntervalMs = MIN_INTERVAL_MS, maxRetries = MAX_RETRIES, logger } = {}) {
  let chain = Promise.resolve();
  let lastCallAt = 0;

  function throttledCall(fn) {
    const run = chain.then(async () => {
      const wait = Math.max(0, lastCallAt + minIntervalMs - Date.now());
      if (wait > 0) await sleep(wait);
      lastCallAt = Date.now();
      return fn();
    });
    chain = run.catch(() => {}); // one call's failure shouldn't stall the queue for the next
    return run;
  }

  async function withRetry(fn) {
    let attempt = 0;
    for (;;) {
      try {
        return await throttledCall(fn);
      } catch (err) {
        if (isDailyQuotaExhausted(err)) {
          logger?.error({ err: err.message }, "Gemini daily free-tier quota exhausted — not retrying, won't resolve until Google's quota resets");
          throw err;
        }
        attempt++;
        if (attempt > maxRetries || !isTransient(err)) throw err;
        const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        logger?.warn({ attempt, maxRetries, backoffMs: backoff, err: err.message }, "LLM call hit a transient error, retrying");
        await sleep(backoff);
      }
    }
  }

  return {
    generate: (...args) => withRetry(() => provider.generate(...args)),
    transcribe: (...args) => withRetry(() => provider.transcribe(...args)),
    embed: (...args) => provider.embed(...args),
  };
}
