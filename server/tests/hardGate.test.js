import { describe, it, expect } from "vitest";
import { runFastDetectors, checkHardGate } from "../src/detectors/index.js";

describe("hard gate", () => {
  it("forces BLOCK on a confirmed credential leak regardless of other scores", () => {
    const text = "Here is your key: AKIAABCDEFGHIJKLMNOP — everything else about this response is fine.";
    const result = runFastDetectors(text);
    const gate = checkHardGate(result);
    expect(gate.triggered).toBe(true);
    expect(gate.reasons.some((r) => r.includes("credential leak"))).toBe(true);
  });

  it("forces BLOCK on severe PII (SSN)", () => {
    const result = runFastDetectors("The customer's SSN is 123-45-6789.");
    const gate = checkHardGate(result);
    expect(gate.triggered).toBe(true);
  });

  it("does not trigger on clean text", () => {
    const result = runFastDetectors("This is a perfectly normal, safe response with no issues.");
    const gate = checkHardGate(result);
    expect(gate.triggered).toBe(false);
    expect(gate.reasons).toHaveLength(0);
  });
});
