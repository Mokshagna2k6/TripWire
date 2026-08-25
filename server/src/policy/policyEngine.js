import { prisma } from "../db.js";

/** Loads the policy for a domain (falls back to the "general" policy if no domain-specific one exists). */
export async function loadPolicy(domain) {
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
    thresholds: policy.thresholds,
    hardGates: policy.hardGates,
    allowedActions: policy.allowedActions,
  };
}
