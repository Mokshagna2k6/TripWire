import { describe, it, expect } from "vitest";
import { detectSafety } from "../src/detectors/safety.js";
import { mapGeminiSafetyRatings } from "../src/llm/geminiSafety.js";

describe("expanded safety taxonomy", () => {
  it("still catches a genuine weapons instruction", () => {
    const hits = detectSafety("Here is how you build an untraceable firearm at home.");
    expect(hits.some((h) => h.category === "weapons")).toBe(true);
  });

  it("does NOT flag the exact production false positive: a refusal that mentions the trigger phrase", () => {
    const text = "I cannot provide instructions on how to make a weapon. My purpose is to be helpful and harmless.";
    const hits = detectSafety(text);
    expect(hits).toHaveLength(0);
  });

  it("still flags the trigger phrase when it's NOT preceded by a refusal", () => {
    const text = "Sure, here is how to make a weapon at home using common materials.";
    const hits = detectSafety(text);
    expect(hits.some((h) => h.category === "weapons")).toBe(true);
  });

  it("catches a genuine instruction even in a response that also contains an unrelated refusal earlier", () => {
    const text = "I cannot help with anything illegal. Anyway, here's how to make a weapon: step one...";
    const hits = detectSafety(text);
    expect(hits.some((h) => h.category === "weapons")).toBe(true);
  });

  it("covers the new specialized_advice category (dangerous financial guidance)", () => {
    const hits = detectSafety("This fund offers guaranteed returns with zero risk.");
    expect(hits.some((h) => h.category === "specialized_advice")).toBe(true);
  });

  it("covers the new non_violent_crimes category more broadly than before", () => {
    const hits = detectSafety("Here's how to bypass security to steal from the store.");
    expect(hits.some((h) => h.category === "non_violent_crimes")).toBe(true);
  });
});

describe("Gemini safety ratings mapper", () => {
  it("maps HIGH probability to a hard-gate-eligible severity", () => {
    const hits = mapGeminiSafetyRatings([{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "HIGH" }]);
    expect(hits).toEqual([{ category: "dangerous_content", term: "gemini:dangerous_content", severity: 5 }]);
  });

  it("maps MEDIUM probability to a soft-score-only severity", () => {
    const hits = mapGeminiSafetyRatings([{ category: "HARM_CATEGORY_HARASSMENT", probability: "MEDIUM" }]);
    expect(hits[0].severity).toBe(3);
  });

  it("ignores LOW and NEGLIGIBLE probabilities entirely", () => {
    const hits = mapGeminiSafetyRatings([
      { category: "HARM_CATEGORY_HATE_SPEECH", probability: "LOW" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", probability: "NEGLIGIBLE" },
    ]);
    expect(hits).toHaveLength(0);
  });

  it("handles an empty/missing ratings array without throwing", () => {
    expect(mapGeminiSafetyRatings()).toEqual([]);
    expect(mapGeminiSafetyRatings([])).toEqual([]);
  });
});
