import { Router } from "express";
import { prisma } from "../db.js";
import { computeFeedbackStats } from "../feedback/feedbackEngine.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const feedbackRouter = Router();

feedbackRouter.get("/stats", asyncHandler(async (_req, res) => {
  const records = await prisma.feedbackRecord.findMany();
  res.json(computeFeedbackStats(records));
}));

feedbackRouter.get("/", asyncHandler(async (_req, res) => {
  const records = await prisma.feedbackRecord.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(records);
}));
