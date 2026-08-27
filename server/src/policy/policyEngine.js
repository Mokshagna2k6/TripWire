import { prisma } from "../db.js";

// In-memory cache for policy objects scoped to domains.
const policyCache = new Map();

export function clearPolicyCache() {
  policyCache.clear();
}

/** Loads the policy for a domain (falls back to the "general" policy if no domain-specific one exists). */
export async function loadPolicy(domain) {
  if (policyCache.has(domain)) {
    return policyCache.get(domain);
  }

  const policy = (await prisma.policy.findFirst({ where: { domain } })) ?? (await prisma.policy.findUnique({ where: { name: "general" } }));

  if (!policy) {
    throw new Error(`no policy found for domain "${domain}" and no "general" fallback policy exists`);
  }

  const result = {
    id: policy.id,
    name: policy.name,
    domain: policy.domain,
    geography: policy.geography,
    riskTolerance: policy.riskTolerance,
    thresholds: policy.thresholds,
    hardGates: policy.hardGates,
    allowedActions: policy.allowedActions,
  };

  policyCache.set(domain, result);
  return result;
}
