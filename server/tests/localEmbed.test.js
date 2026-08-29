import { describe, it, expect } from "vitest";
import { localEmbed, DIMS } from "../src/llm/localEmbed.js";
import { cosineSimilarity } from "../src/evidence/store.js";

const sim = (a, b) => cosineSimilarity(localEmbed(a), localEmbed(b));

describe("localEmbed", () => {
  it("produces unit-length vectors of the declared dimensionality", () => {
    const vec = localEmbed("Employees may claim travel reimbursement.");
    expect(vec).toHaveLength(DIMS);
    expect(Math.sqrt(vec.reduce((s, v) => s + v * v, 0))).toBeCloseTo(1, 6);
  });

  it("is deterministic — the same text must embed identically at seed time and at query time", () => {
    expect(localEmbed("travel policy")).toEqual(localEmbed("travel policy"));
  });

  it("scores identical text at 1", () => {
    expect(sim("Revenue increased by 12 percent.", "Revenue increased by 12 percent.")).toBeCloseTo(1, 6);
  });

  it("separates topically related text from unrelated text by a wide margin", () => {
    const related = sim(
      "Employees may claim travel reimbursement for domestic flights.",
      "Travel reimbursement claims for flights must be submitted within 30 days."
    );
    const unrelated = sim(
      "Employees may claim travel reimbursement for domestic flights.",
      "The quarterly revenue increased by twelve percent year over year."
    );
    expect(related).toBeGreaterThan(0.4);
    expect(unrelated).toBeLessThan(0.2);
    expect(related).toBeGreaterThan(unrelated * 2);
  });

  it("collides singular and plural forms via stemming", () => {
    // Regression guard: stripping "es" without normalising the trailing "e" left
    // "expense"/"expenses" on different stems and scored this pair at 0.
    expect(sim("the employee reimbursed the expense", "employees reimburse expenses")).toBeGreaterThan(0.7);
  });

  it("gives function words no topical weight", () => {
    expect(sim("it is what it is and that is that", "this was the one that was there")).toBe(0);
  });

  it("distinguishes word order via bigrams", () => {
    // Same unigrams, different phrasing — must not be treated as identical.
    expect(sim("evidence supports the claim", "the claim supports evidence")).toBeLessThan(0.95);
  });
});
