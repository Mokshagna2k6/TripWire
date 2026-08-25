const MIN_INTERVAL_MS = 4500; // ~13 requests/min — stays under typical Gemini free-tier RPM caps
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

function isTransient(err) {
  const msg = err?.message || "";
  return /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand/i.test(msg);
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
export function withRateLimit(provider, { minIntervalMs = MIN_INTERVAL_MS, maxRetries = MAX_RETRIES } = {}) {
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
        attempt++;
        if (attempt > maxRetries || !isTransient(err)) throw err;
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }
  }

  return {
    generate: (...args) => withRetry(() => provider.generate(...args)),
    embed: (...args) => provider.embed(...args),
  };
}
