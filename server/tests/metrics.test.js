import { describe, expect, it } from "vitest";
import { computeMetrics } from "../src/metrics/index.js";
import { computeSchemaX } from "../src/metrics/schemaX.js";
import { stableSample } from "../src/metrics/cbg.js";

const input = {
  responseText: "The answer is certainly supported.",
  structured: { claims: [{ text: "The answer is certainly supported." }], keySpans: [] },
  evidence: [{ text: "The answer is supported.", authority: "high", similarity: 0.9 }],
  fastDetectors: { pii: [], secrets: [], safety: [], schema: { applicable: false, valid: true } },
  regenerationCount: 0,
  maxRetries: 2,
  responseEmbedding: [1, 0],
  evidenceEmbeddings: [[0, 1]],
  judgeOutput: { safetySeverity: 0, hallucinationRisk: 0.8 },
};

describe("metric integrity", () => {
  it("uses supplied embeddings for SAS and propagates judge hallucination risk", () => {
    const metrics = computeMetrics(input);
    expect(metrics.sas).toBe(1);
    expect(metrics.hallucinationRisk).toBe(0.8);
  });

  it("marks a response without evidence as unverified rather than fully supported", () => {
    const result = computeSchemaX(input.structured, [], input.fastDetectors.schema);
    expect(result.evidenceSupport).toBe(0.5);
  });

  it("makes CBG sampling reproducible for a request id", () => {
    expect(stableSample("request-123")).toBe(stableSample("request-123"));
  });

  it("falls back to a local hallucinationRisk estimate outside DEEP mode instead of a misleading 0", () => {
    const { judgeOutput, ...noJudge } = input;
    const metrics = computeMetrics(noJudge);
    // evidenceSupport for this input's fully-matching claim/evidence pair is 1, so the local
    // estimate (1 - evidenceSupport) should be 0 here too — but for the right reason: it was
    // computed, not defaulted.
    expect(metrics.hallucinationRisk).toBe(1 - metrics.schemaX.evidenceSupport);
  });

  it("local hallucinationRisk estimate is non-zero when evidence doesn't support the claim", () => {
    const unsupported = {
      ...input,
      judgeOutput: undefined,
      structured: { claims: [{ text: "Something completely unrelated to the evidence." }], keySpans: [] },
    };
    const metrics = computeMetrics(unsupported);
    expect(metrics.hallucinationRisk).toBeGreaterThan(0);
  });
});
