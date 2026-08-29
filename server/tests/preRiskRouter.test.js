import { describe, it, expect } from "vitest";
import { classifyPreRisk } from "../src/orchestrator/preRiskRouter.js";

describe("pre-risk routing", () => {
  it("routes an ordinary general-domain prompt to FAST", () => {
    expect(classifyPreRisk("general", "Write a haiku about autumn.", "medium").mode).toBe("FAST");
  });

  it("routes a corpus-backed domain to at least STANDARD so its evidence is actually retrieved", () => {
    // FAST skips retrieval entirely. hr_travel has seeded documents, so routing it
    // FAST would leave that corpus permanently unread.
    const { mode, reasons } = classifyPreRisk("hr_travel", "What flight class can I book?", "medium");
    expect(mode).toBe("STANDARD");
    expect(reasons.join(" ")).toMatch(/curated evidence corpus/);
  });

  it("routes high-risk domains to DEEP", () => {
    expect(classifyPreRisk("medical", "What dosage should they take?", "low").mode).toBe("DEEP");
    expect(classifyPreRisk("finance_india", "How do I file GSTR-3B?", "low").mode).toBe("DEEP");
  });

  it("escalates on high-risk keywords regardless of domain", () => {
    expect(classifyPreRisk("general", "Give me a medical dosage for this.", "medium").mode).toBe("STANDARD");
  });

  it("always explains its routing decision", () => {
    expect(classifyPreRisk("general", "hello", "medium").reasons).not.toHaveLength(0);
  });
});
