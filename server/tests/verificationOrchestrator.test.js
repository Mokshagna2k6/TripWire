import { describe, it, expect } from "vitest";
import { runVerification } from "../src/orchestrator/verificationOrchestrator.js";

function makeProvider() {
  const calls = { generate: 0, embed: 0 };
  return {
    calls,
    async generate(prompt) {
      calls.generate++;
      // The Judge's own call is the only generate() call in this flow (no regenerate loop
      // here, and CBG needs a protected-attribute prompt none of these inputs contain).
      return { text: '{"hallucinationRisk":0,"safetySeverity":0,"rationale":"judge ran"}', tokens: { input: 1, output: 1 } };
    },
    async embed() {
      calls.embed++;
      return [1, 0];
    },
  };
}

const cleanEvidence = [{ text: "The capital of France is Paris.", authority: "high", similarity: 0.9 }];
const cleanResponse = "The capital of France is Paris.";

describe("DEEP mode Judge skip", () => {
  it("skips the Judge when Layer 1 safety is clean and local grounding is well above threshold", async () => {
    const provider = makeProvider();
    const { judgeOutput } = await runVerification(
      {
        domain: "general",
        requestId: "req-1",
        originalPrompt: "What is the capital of France?",
        responseText: cleanResponse,
        mode: "DEEP",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: cleanEvidence,
      },
      provider
    );

    expect(judgeOutput).toBeNull();
    expect(provider.calls.generate).toBe(0);
  });

  it("still calls the Judge when Layer 1 safety found something, even if grounding looks fine", async () => {
    const provider = makeProvider();
    const { judgeOutput } = await runVerification(
      {
        domain: "general",
        requestId: "req-2",
        originalPrompt: "Explain money laundering prevention.",
        responseText: "This article explains how banks launder money detection works to prevent financial crime.",
        mode: "DEEP",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: cleanEvidence,
      },
      provider
    );

    expect(judgeOutput).not.toBeNull();
    expect(provider.calls.generate).toBe(1);
  });

  it("still calls the Judge when there's no evidence corpus to confirm grounding (evidenceSupport 0.5, below threshold)", async () => {
    const provider = makeProvider();
    const { judgeOutput } = await runVerification(
      {
        domain: "general",
        requestId: "req-3",
        originalPrompt: "What is 2+2?",
        responseText: "2 + 2 = 4",
        mode: "DEEP",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [],
      },
      provider
    );

    expect(judgeOutput).not.toBeNull();
    expect(provider.calls.generate).toBe(1);
  });

  it("never calls the Judge outside DEEP mode regardless of grounding", async () => {
    const provider = makeProvider();
    const { judgeOutput } = await runVerification(
      {
        domain: "general",
        requestId: "req-4",
        originalPrompt: "Explain money laundering prevention.",
        responseText: "This article explains how banks launder money detection works.",
        mode: "STANDARD",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: cleanEvidence,
      },
      provider
    );

    expect(judgeOutput).toBeNull();
    expect(provider.calls.generate).toBe(0);
  });
});

describe("Gemini safety ratings OR'd with regex hard gate", () => {
  it("hard-gates on a Gemini-only signal even when the regex layer finds nothing", async () => {
    const provider = makeProvider();
    const { hardGate } = await runVerification(
      {
        domain: "general",
        requestId: "req-5",
        originalPrompt: "Tell me something",
        responseText: "This is a perfectly innocuous-looking sentence with no trigger phrases at all.",
        mode: "FAST",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [],
        geminiSafetyHits: [{ category: "dangerous_content", term: "gemini:dangerous_content", severity: 5 }],
      },
      provider
    );

    expect(hardGate.triggered).toBe(true);
  });

  it("still hard-gates on a regex-only signal when Gemini reports nothing", async () => {
    const provider = makeProvider();
    const { hardGate } = await runVerification(
      {
        domain: "general",
        requestId: "req-6",
        originalPrompt: "Tell me something",
        responseText: "Sure, here is how to make a weapon at home using common materials.",
        mode: "FAST",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [],
        geminiSafetyHits: [],
      },
      provider
    );

    expect(hardGate.triggered).toBe(true);
  });

  it("does not hard-gate when both sources agree the response is clean", async () => {
    const provider = makeProvider();
    const { hardGate } = await runVerification(
      {
        domain: "general",
        requestId: "req-7",
        originalPrompt: "What is the capital of France?",
        responseText: cleanResponse,
        mode: "FAST",
        regenerationCount: 0,
        maxRetries: 2,
        initialEvidence: [],
        geminiSafetyHits: [],
      },
      provider
    );

    expect(hardGate.triggered).toBe(false);
  });
});
