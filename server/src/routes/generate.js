import { Router } from "express";
import { z } from "zod";
import { runPipeline } from "../pipeline.js";
import { logger } from "../logger.js";

// Mime types Gemini actually understands as an inlineData part. doc/docx and other office
// formats aren't in this list — Gemini's inlineData doesn't parse them, so those still fall
// back to filename-only context on the client rather than silently sending bytes it can't read.
const SUPPORTED_ATTACHMENT_MIME_TYPES = /^(image\/(png|jpeg|jpg|webp|heic|heif)|application\/pdf|text\/(plain|csv))$/;

export const bodySchema = z.object({
  domain: z.string().min(1),
  prompt: z.string().min(1),
  attachments: z
    .array(z.object({ mimeType: z.string().regex(SUPPORTED_ATTACHMENT_MIME_TYPES), data: z.string().min(1) }))
    .max(5)
    .optional(),
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
      if (/PerDay/i.test(err?.message ?? "")) {
        return res.status(503).json({ error: "The Gemini free-tier daily request quota is exhausted. Try again after it resets, or add billing to raise the limit." });
      }
      if (err?.code === "LLM_QUEUE_FULL") return res.status(429).json({ error: "The gateway is busy; retry shortly." });
      if (err?.code === "CIRCUIT_BREAKER_OPEN" || /circuit breaker/i.test(err?.message ?? "")) return res.status(503).json({ error: "The upstream model is temporarily unavailable; retry shortly." });
      if (/timed out/i.test(err?.message ?? "")) return res.status(504).json({ error: "The upstream model timed out; retry shortly." });
      return res.status(500).json({ error: "internal error running trust gateway pipeline" });
    }
  });

  return router;
}
