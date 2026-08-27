import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { clearPolicyCache } from "../policy/policyEngine.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const metricName = z.enum(["pls", "shs", "uis", "ceg", "errorDensity", "cur", "ro", "rre", "sas", "cbg", "schemaX", "hallucinationRisk"]);
const actionName = z.enum(["ALLOW", "EDIT_CLARIFY", "REGENERATE", "HUMAN_REVIEW", "BLOCK"]);
const updateSchema = z.object({
  thresholds: z.array(z.object({ metric: metricName, operator: z.enum([">=", ">", "<=", "<"]), value: z.number().finite(), action: actionName })).optional(),
  hardGates: z.record(metricName, z.number().finite()).optional(),
  allowedActions: z.array(actionName).min(1).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).optional(),
}).strict();

export const policiesRouter = Router();

policiesRouter.get("/", asyncHandler(async (_req, res) => {
  const policies = await prisma.policy.findMany({ orderBy: { name: "asc" } });
  res.json(policies);
}));

policiesRouter.get("/:id", asyncHandler(async (req, res) => {
  const policy = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!policy) return res.status(404).json({ error: "not found" });
  res.json(policy);
}));

policiesRouter.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request", details: parsed.error.flatten() });

  const policy = await prisma.policy.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  clearPolicyCache();

  res.json(policy);
}));
