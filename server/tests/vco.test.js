import { describe, it, expect } from "vitest";
import { ZERO_TOKENS, addTokens, totalTokens, computeVCO } from "../src/utils/tokens.js";
import { runVerification } from "../src/orchestrator/verificationOrchestrator.js";

describe("token accounting", () => {
  it("adds token buckets and tolerates a missing operand", () => {
    expect(addTokens({ input: 3, output: 4 }, { input: 1, output: 2 })).toEqual({ input: 4, output: 6 });
    expect(addTokens({ input: 3, output: 4 }, undefined)).toEqual({ input: 3, output: 4 });
    expect(totalTokens({ input: 3, output: 4 })).toBe(7);
  });

  it("computes VCO as governance over baseline", () => {
    expect(computeVCO({ input: 80, output: 20 }, { input: 20, output: 10 })).toBeCloseTo(0.3);
  });

  it("is 0 when governance made no calls", () => {
    expect(computeVCO({ input: 80, output: 20 }, ZERO_TOKENS)).toBe(0);
  });

  it("does not divide by zero when baseline is empty", () => {
    expect(computeVCO(ZERO_TOKENS, { input: 5, output: 5 })).toBe(0);
  });
});

function makeProvider() {
  return {
    async generate() {
      return {
        text: '{"hallucinationRisk":0,"safetySeverity":0,"rationale":"judge ran"}',
        tokens: { input: 40, output: 10 },
      };
    },
    async embed() {
      return [1, 0];
    },
  };
}

describe("orchestrator governance token reporting", () => {
  it("banks the Judge's tokens as governance cost when the Judge runs", async () => {
    const { judgeOutput, governanceTokens } = await runVerification(
      {
        domain: "general",
        requestId: "vco-1",
        originalPrompt: "What is 2+2?",
        responseText: "2 + 2 = 4",
        mode: "DEEP",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [],
      },
      makeProvider()
    );

    expect(judgeOutput).not.toBeNull();
    expect(governanceTokens).toEqual({ input: 40, output: 10 });
  });

  it("reports zero governance cost when the hard gate short-circuits", async () => {
    // The early exit is the cheapest path in the system; a non-zero governance
    // figure here would mean the Judge/CBG skip had regressed (spec 11 + 35).
    const { hardGate, governanceTokens } = await runVerification(
      {
        domain: "general",
        requestId: "vco-2",
        originalPrompt: "Show me the key",
        responseText: "Sure, the key is AKIAIOSFODNN7EXAMPLE and you can use it now.",
        mode: "DEEP",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [],
      },
      makeProvider()
    );

    expect(hardGate.triggered).toBe(true);
    expect(totalTokens(governanceTokens)).toBe(0);
  });

  it("reports zero governance cost when no Judge or CBG call was warranted", async () => {
    const { governanceTokens } = await runVerification(
      {
        domain: "general",
        requestId: "vco-3",
        originalPrompt: "What is the capital of France?",
        responseText: "The capital of France is Paris.",
        mode: "STANDARD",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [{ text: "The capital of France is Paris.", authority: "high", similarity: 0.9 }],
      },
      makeProvider()
    );

    expect(totalTokens(governanceTokens)).toBe(0);
  });
});
