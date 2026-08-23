import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const updateSchema = z.object({
  thresholds: z.array(z.object({ metric: z.string(), operator: z.enum([">=", ">", "<=", "<"]), value: z.number(), action: z.string() })).optional(),
  hardGates: z.record(z.string(), z.number()).optional(),
  allowedActions: z.array(z.string()).optional(),
  riskTolerance: z.string().optional(),
});

export const policiesRouter = Router();

policiesRouter.get("/", async (_req, res) => {
  const policies = await prisma.policy.findMany({ orderBy: { name: "asc" } });
  res.json(policies);
});

policiesRouter.get("/:id", async (req, res) => {
  const policy = await prisma.policy.findUnique({ where: { id: req.params.id } });
  if (!policy) return res.status(404).json({ error: "not found" });
  res.json(policy);
});

policiesRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request", details: parsed.error.flatten() });

  const policy = await prisma.policy.update({
    where: { id: req.params.id },
    data: parsed.data as unknown as Record<string, object>,
  });
  res.json(policy);
});
