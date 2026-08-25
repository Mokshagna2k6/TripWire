import { Router } from "express";
import { z } from "zod";
import { runPipeline } from "../pipeline.js";
import { logger } from "../logger.js";

const bodySchema = z.object({
  domain: z.string().min(1),
  prompt: z.string().min(1),
  expectedFormat: z
    .object({
      format: z.literal("json").optional(),
      requiredFields: z.array(z.string()).optional(),
    })
    .optional(),
});

export function generateRouter(provider) {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid request", details: parsed.error.flatten() });
    }

    try {
      const result = await runPipeline(parsed.data, provider);
      const httpStatus = result.action === "BLOCK" ? 403 : result.action === "HUMAN_REVIEW" ? 202 : 200;
      return res.status(httpStatus).json(result);
    } catch (err) {
      logger.error({ err }, "pipeline failed");
      return res.status(500).json({ error: "internal error running trust gateway pipeline" });
    }
  });

  return router;
}
