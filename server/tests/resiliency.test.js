import { describe, it, expect } from "vitest";
import { withRateLimit } from "../src/llm/rateLimiter.js";

describe("Rate Limiter & Resiliency controls", () => {
  it("allows concurrent executions up to token capacity without serializing them", async () => {
    let activeCalls = 0;
    let maxConcurrent = 0;

    const mockProvider = {
      async generate() {
        activeCalls++;
        maxConcurrent = Math.max(maxConcurrent, activeCalls);
        await new Promise((resolve) => setTimeout(resolve, 20));
        activeCalls--;
        return { text: "ok", tokens: { input: 1, output: 1 } };
      },
    };

    // Instantiate rate limiter with 1ms interval to refill, so it refills very fast but doesn't block concurrency
    const rateLimited = withRateLimit(mockProvider, { minIntervalMs: 1, maxRetries: 0 });

    // Call generating concurrently
    await Promise.all([
      rateLimited.generate("a"),
      rateLimited.generate("b"),
      rateLimited.generate("c"),
    ]);

    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it("trips the circuit breaker after 5 consecutive failures and fails fast", async () => {
    let callCount = 0;
    const mockProvider = {
      async generate() {
        callCount++;
        throw new Error("503 Upstream error");
      },
    };

    const rateLimited = withRateLimit(mockProvider, {
      minIntervalMs: 1,
      maxRetries: 0,
      logger: {
        error: () => {},
        warn: () => {},
        info: () => {},
      },
    });

    // Make 5 failing calls
    for (let i = 0; i < 5; i++) {
      await expect(rateLimited.generate("fail")).rejects.toThrow("503 Upstream error");
    }

    // The 6th call should trip the circuit breaker and throw CIRCUIT_BREAKER_OPEN immediately
    await expect(rateLimited.generate("trip")).rejects.toThrow(/circuit breaker open/i);
    
    // Call count on mock provider should still be 5, meaning the 6th call was prevented/intercepted!
    expect(callCount).toBe(5);
  });
});
