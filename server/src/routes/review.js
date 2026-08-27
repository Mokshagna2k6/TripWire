import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { classifyFeedback } from "../feedback/feedbackEngine.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const decisionSchema = z.object({ decision: z.enum(["ALLOW", "BLOCK"]) });

export const reviewRouter = Router();

reviewRouter.get("/", asyncHandler(async (_req, res) => {
  const pending = await prisma.humanReview.findMany({
    where: { decision: null },
    orderBy: { createdAt: "asc" },
    include: { auditTrace: true },
  });
  res.json(pending);
}));

reviewRouter.post("/:id/decision", asyncHandler(async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid request" });

  const review = await prisma.humanReview.findUnique({ where: { id: req.params.id }, include: { auditTrace: true } });
  if (!review) return res.status(404).json({ error: "not found" });
  if (review.decision) return res.status(409).json({ error: "already decided" });

  const { updated, feedback } = await prisma.$transaction(async (tx) => {
    const updated = await tx.humanReview.update({
      where: { id: req.params.id },
      data: { decision: parsed.data.decision, reviewedAt: new Date() },
    });
    const feedback = await tx.feedbackRecord.create({
      data: {
        auditTraceId: review.auditTraceId,
        systemAction: review.auditTrace.action,
        humanDecision: parsed.data.decision,
        classification: classifyFeedback(review.auditTrace.action, parsed.data.decision),
      },
    });
    return { updated, feedback };
  });

  res.json({ review: updated, feedback });
}));
