import { Router } from "express";
import { z } from "zod";
import { logger } from "../logger.js";

const bodySchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().min(1),
});

export function transcribeRouter(provider) {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid request", details: parsed.error.flatten() });
    }

    try {
      const text = await provider.transcribe(parsed.data.audio, parsed.data.mimeType);
      return res.json({ text });
    } catch (err) {
      logger.error({ err }, "transcription failed");
      if (/PerDay/i.test(err?.message ?? "")) {
        return res.status(503).json({ error: "The Gemini free-tier daily request quota is exhausted. Try again after it resets, or add billing to raise the limit." });
      }
      return res.status(500).json({ error: "transcription failed" });
    }
  });

  return router;
}
