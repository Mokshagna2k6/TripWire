import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const auditRouter = Router();

/** List recent audit traces. Optional ?action=BLOCK filter, ?q=keyword full-text search over the raw response. */
auditRouter.get("/", asyncHandler(async (req, res) => {
  const { action, q } = req.query;
  const traces = await prisma.auditTrace.findMany({
    where: {
      ...(action ? { action: String(action) } : {}),
      ...(q ? { rawResponse: { contains: String(q), mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(traces);
}));

auditRouter.get("/:id", asyncHandler(async (req, res) => {
  const trace = await prisma.auditTrace.findUnique({ where: { id: req.params.id } });
  if (!trace) return res.status(404).json({ error: "not found" });
  res.json(trace);
}));
