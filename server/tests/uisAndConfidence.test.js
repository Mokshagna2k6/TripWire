import { describe, it, expect } from "vitest";
import { computeUIS } from "../src/metrics/uis.js";
import { estimateConfidence } from "../src/metrics/ceg.js";

function claim(text) {
  return { text, hasNumber: false, hasCitation: false };
}

describe("UIS — widened inference detection", () => {
  it("still catches the original explicit-connector phrasing", () => {
    const structured = { claims: [claim("Therefore, the customer is definitely at fault.")], keySpans: [] };
    const uis = computeUIS(structured, []);
    expect(uis).toBeGreaterThan(0);
  });

  it("now catches an inference with no explicit logical connector (the original gap)", () => {
    const structured = {
      claims: [claim("The customer cancelled their subscription."), claim("They must be unhappy with the service.")],
      keySpans: [],
    };
    const uis = computeUIS(structured, []);
    expect(uis).toBeGreaterThan(0);
  });

  it("catches implication phrasing (\"this suggests\", \"which means\")", () => {
    const structured = { claims: [claim("Revenue dropped 40%, which means the product failed.")], keySpans: [] };
    expect(computeUIS(structured, [])).toBeGreaterThan(0);
  });

  it("does not flag a plain factual statement with no inference language at all", () => {
    const structured = { claims: [claim("The store opens at 9am and closes at 6pm.")], keySpans: [] };
    expect(computeUIS(structured, [])).toBe(0);
  });
});

describe("confidence estimation — 'will' false-signal removed, normalized by sentence count", () => {
  it("no longer treats plain future-tense 'will' as an assertive/certainty marker", () => {
    // Old behavior: 3 uses of "will" would have pushed confidence toward 1.0 as if highly
    // certain, despite this being ordinary future-tense prose with zero real certainty markers.
    const text = "The tax will be calculated next month. The refund will be issued. The report will follow.";
    expect(estimateConfidence(text)).toBe(0.6); // neutral default — no real signal present
  });

  it("still detects genuine hedging language", () => {
    const text = "This might be correct, but it could possibly be wrong. It's unclear.";
    expect(estimateConfidence(text)).toBeLessThan(0.6);
  });

  it("still detects genuine assertive/certainty language", () => {
    const text = "This is definitely correct. It is certainly true. There is no doubt about it.";
    expect(estimateConfidence(text)).toBeGreaterThan(0.6);
  });

  it("normalizes by sentence count instead of raw hit count (a longer neutral response isn't penalized)", () => {
    const shortHedge = "This might be true.";
    const longHedge = "This might be true. " + "This is a normal sentence. ".repeat(10);
    // Same single hedge word, but diluted across far more sentences — should read as less
    // uncertain overall than the short version where that one hedge dominates the whole text.
    expect(estimateConfidence(longHedge)).toBeGreaterThan(estimateConfidence(shortHedge));
  });
});
