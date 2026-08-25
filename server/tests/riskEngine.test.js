import { describe, it, expect } from "vitest";
import { evaluateRisk } from "../src/risk/riskEngine.js";

const policy = {
  id: "p1",
  name: "general",
  domain: "general",
  geography: "global",
  riskTolerance: "medium",
  hardGates: { pls: 4, shs: 4 },
  thresholds: [
    { metric: "uis", operator: ">=", value: 4, action: "REGENERATE" },
    { metric: "ceg", operator: ">=", value: 4, action: "HUMAN_REVIEW" },
  ],
  allowedActions: ["ALLOW", "EDIT_CLARIFY", "REGENERATE", "BLOCK", "HUMAN_REVIEW"],
};

function baseMetrics(overrides = {}) {
  return {
    schemaX: { score: 0.9, evidenceSupport: 0.9, sourceQuality: 0.9, schemaCompliance: 1, supportedClaims: 1, totalClaims: 1 },
    uis: 0,
    ceg: 0,
    errorDensity: 0,
    cur: 1,
    ro: 0,
    rre: 1,
    pls: 0,
    shs: 0,
    sas: 0,
    cbg: null,
    ...overrides,
  };
}

describe("policy/risk engine threshold selection", () => {
  it("picks ALLOW when all metrics are within thresholds", () => {
    const decision = evaluateRisk(baseMetrics(), policy, { triggered: false, reasons: [] });
    expect(decision.action).toBe("ALLOW");
  });

  it("picks REGENERATE when UIS crosses its threshold", () => {
    const decision = evaluateRisk(baseMetrics({ uis: 4.5 }), policy, { triggered: false, reasons: [] });
    expect(decision.action).toBe("REGENERATE");
  });

  it("picks HUMAN_REVIEW when CEG crosses its threshold, even if higher severity than UIS breach", () => {
    const decision = evaluateRisk(baseMetrics({ uis: 4.5, ceg: 4.2 }), policy, { triggered: false, reasons: [] });
    expect(decision.action).toBe("HUMAN_REVIEW");
  });

  it("forces BLOCK via policy hard gate (PLS) regardless of other thresholds", () => {
    const decision = evaluateRisk(baseMetrics({ pls: 4.5 }), policy, { triggered: false, reasons: [] });
    expect(decision.action).toBe("BLOCK");
    expect(decision.riskLevel).toBe("critical");
  });

  it("forces BLOCK via the fast-detector hard gate, skipping policy thresholds entirely", () => {
    const decision = evaluateRisk(baseMetrics({ uis: 0, ceg: 0 }), policy, {
      triggered: true,
      reasons: ["confirmed credential leak: aws_access_key"],
    });
    expect(decision.action).toBe("BLOCK");
    expect(decision.reasons).toContain("confirmed credential leak: aws_access_key");
  });
});
