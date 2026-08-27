const MIN_INTERVAL_MS = 7000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;
const MAX_QUEUE_DEPTH = 50;

class TokenBucket {
  constructor(capacity, refillIntervalMs) {
    this.capacity = capacity;
    this.refillIntervalMs = refillIntervalMs;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.waitingQueue = [];
    this.timer = null;
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.refillIntervalMs);
    if (newTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + newTokens);
      this.lastRefill = now - (elapsed % this.refillIntervalMs);
    }
  }

  async acquire() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
      this.scheduleNextRefill();
    });
  }

  scheduleNextRefill() {
    if (this.timer || this.waitingQueue.length === 0) return;
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const nextRefillIn = Math.max(0, this.refillIntervalMs - elapsed);

    this.timer = setTimeout(() => {
      this.timer = null;
      this.refill();
      while (this.tokens >= 1 && this.waitingQueue.length > 0) {
        this.tokens--;
        const resolve = this.waitingQueue.shift();
        resolve();
      }
      this.scheduleNextRefill();
    }, nextRefillIn);
  }
}

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

export function withRateLimit(provider, { minIntervalMs = MIN_INTERVAL_MS, maxRetries = MAX_RETRIES, maxQueueDepth = MAX_QUEUE_DEPTH, logger } = {}) {
  const bucket = new TokenBucket(5, minIntervalMs);
  let queueDepth = 0;

  // Circuit Breaker state
  let failureCount = 0;
  const failureThreshold = 5;
  const cooldownMs = 30000;
  let circuitState = "CLOSED"; // CLOSED, OPEN, HALF-OPEN
  let lastStateChange = 0;

  function checkCircuitBreaker() {
    const now = Date.now();
    if (circuitState === "OPEN") {
      if (now - lastStateChange >= cooldownMs) {
        circuitState = "HALF-OPEN";
        lastStateChange = now;
        logger?.warn("Circuit breaker entering HALF-OPEN state, testing upstream service");
      } else {
        const err = new Error("Upstream LLM service is temporarily unavailable (circuit breaker open)");
        err.code = "CIRCUIT_BREAKER_OPEN";
        throw err;
      }
    }
  }

  function recordSuccess() {
    failureCount = 0;
    if (circuitState === "HALF-OPEN") {
      circuitState = "CLOSED";
      lastStateChange = Date.now();
      logger?.info("Circuit breaker reset to CLOSED");
    }
  }

  function recordFailure(err) {
    if (isDailyQuotaExhausted(err) || err.code === "LLM_QUEUE_FULL" || err.code === "CIRCUIT_BREAKER_OPEN") {
      return;
    }
    failureCount++;
    if (failureCount >= failureThreshold && circuitState !== "OPEN") {
      circuitState = "OPEN";
      lastStateChange = Date.now();
      logger?.error(`Circuit breaker tripped to OPEN due to ${failureCount} consecutive failures. Cooldown is 30s.`);
    }
  }

  async function throttledCall(fn) {
    if (queueDepth >= maxQueueDepth) {
      const err = new Error("LLM queue is full; try again shortly");
      err.code = "LLM_QUEUE_FULL";
      throw err;
    }
    checkCircuitBreaker();
    queueDepth++;
    try {
      await bucket.acquire();
      const res = await fn();
      recordSuccess();
      return res;
    } catch (err) {
      recordFailure(err);
      throw err;
    } finally {
      queueDepth--;
    }
  }

  async function withRetry(fn) {
    let attempt = 0;
    for (;;) {
      try {
        return await throttledCall(fn);
      } catch (err) {
        if (isDailyQuotaExhausted(err) || err.code === "CIRCUIT_BREAKER_OPEN") {
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
