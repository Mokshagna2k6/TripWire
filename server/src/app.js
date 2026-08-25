import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./logger.js";
import { generateRouter } from "./routes/generate.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { policiesRouter } from "./routes/policies.js";
import { reviewRouter } from "./routes/review.js";
import { feedbackRouter } from "./routes/feedback.js";

/** Builds the Express app (no .listen) so it can be exercised directly in tests via Supertest. */
export function createApp(provider) {
  const app = express();

  app.use(cors());
  // 15mb: base64-encoded short voice clips for /transcribe are the largest payloads this API accepts.
  app.use(express.json({ limit: "15mb" }));
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/v1/generate", generateRouter(provider));
  app.use("/api/v1/transcribe", transcribeRouter(provider));
  app.use("/api/v1/policies", policiesRouter);
  app.use("/api/v1/review", reviewRouter);
  app.use("/api/v1/feedback", feedbackRouter);

  return app;
}
