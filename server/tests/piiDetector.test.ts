import { describe, it, expect } from "vitest";
import { detectPii } from "../src/detectors/pii.js";
import { detectSecrets } from "../src/detectors/secrets.js";

describe("PII/secrets fast detectors", () => {
  it("catches an email address", () => {
    const matches = detectPii("Contact me at jane.doe@example.com for details.");
    expect(matches.some((m) => m.type === "email" && m.value === "jane.doe@example.com")).toBe(true);
  });

  it("catches a Google API key pattern", () => {
    const matches = detectSecrets("Use this key: AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY in your config.");
    expect(matches.some((m) => m.type === "google_api_key")).toBe(true);
  });

  it("misses clean text with no PII or secrets", () => {
    expect(detectPii("The quick brown fox jumps over the lazy dog.")).toHaveLength(0);
    expect(detectSecrets("The quick brown fox jumps over the lazy dog.")).toHaveLength(0);
  });
});
