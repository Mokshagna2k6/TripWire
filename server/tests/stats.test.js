import { describe, it, expect } from "vitest";
import { percentile } from "../src/routes/stats.js";

describe("latency percentiles", () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it("returns the nearest-rank value", () => {
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(100);
    expect(percentile(sorted, 10)).toBe(10);
  });

  it("never indexes past the end at p100", () => {
    expect(percentile(sorted, 100)).toBe(100);
  });

  it("handles a single sample", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it("returns 0 rather than undefined on an empty window", () => {
    expect(percentile([], 50)).toBe(0);
  });
});
