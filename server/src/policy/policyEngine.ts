import { prisma } from "../db.js";

export type ThresholdAction = "ALLOW" | "EDIT_CLARIFY" | "REGENERATE" | "BLOCK" | "HUMAN_REVIEW";

export interface ThresholdRule {
  metric: string;
  operator: ">=" | ">" | "<=" | "<";
  value: number;
  action: ThresholdAction;
}

export interface LoadedPolicy {
  id: string;
  name: string;
  domain: string;
  geography: string;
  riskTolerance: string;
  thresholds: ThresholdRule[];
  hardGates: Record<string, number>;
  allowedActions: ThresholdAction[];
}

/** Loads the policy for a domain (falls back to the "general" policy if no domain-specific one exists). */
export async function loadPolicy(domain: string): Promise<LoadedPolicy> {
  const policy = (await prisma.policy.findFirst({ where: { domain } })) ?? (await prisma.policy.findUnique({ where: { name: "general" } }));

  if (!policy) {
    throw new Error(`no policy found for domain "${domain}" and no "general" fallback policy exists`);
  }

  return {
    id: policy.id,
    name: policy.name,
    domain: policy.domain,
    geography: policy.geography,
    riskTolerance: policy.riskTolerance,
    thresholds: policy.thresholds as unknown as ThresholdRule[],
    hardGates: policy.hardGates as unknown as Record<string, number>,
    allowedActions: policy.allowedActions as unknown as ThresholdAction[],
  };
}
