import { describe, it, expect } from "vitest";
import { classifyFeedback, computeFeedbackStats } from "../src/feedback/feedbackEngine.js";

describe("feedback engine (reversed FP/FN convention, explicit product requirement)", () => {
  it("classifies system BLOCK + human ALLOW as false_negative", () => {
    expect(classifyFeedback("BLOCK", "ALLOW")).toBe("false_negative");
  });

  it("classifies system ALLOW + human BLOCK as false_positive", () => {
    expect(classifyFeedback("ALLOW", "BLOCK")).toBe("false_positive");
  });

  it("classifies system BLOCK + human BLOCK as true_positive", () => {
    expect(classifyFeedback("BLOCK", "BLOCK")).toBe("true_positive");
  });

  it("classifies system ALLOW + human ALLOW as true_negative", () => {
    expect(classifyFeedback("ALLOW", "ALLOW")).toBe("true_negative");
  });

  it("treats HUMAN_REVIEW/REGENERATE as 'flagged' for classification purposes", () => {
    expect(classifyFeedback("HUMAN_REVIEW", "ALLOW")).toBe("false_negative");
    expect(classifyFeedback("REGENERATE", "BLOCK")).toBe("true_positive");
  });

  it("computes precision/recall/FPR/FNR/override-rate from mixed records", () => {
    const stats = computeFeedbackStats([
      { classification: "true_positive" },
      { classification: "true_positive" },
      { classification: "false_positive" },
      { classification: "false_negative" },
      { classification: "true_negative" },
    ]);
    expect(stats.total).toBe(5);
    expect(stats.precision).toBeCloseTo(2 / 3);
    expect(stats.recall).toBeCloseTo(2 / 3);
    expect(stats.falsePositiveRate).toBeCloseTo(1 / 2);
    expect(stats.falseNegativeRate).toBeCloseTo(1 / 3);
    expect(stats.overrideRate).toBeCloseTo(2 / 5);
  });
});
