import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { GeminiProvider } from "./llm/gemini.js";
import { generateRouter } from "./routes/generate.js";
import { policiesRouter } from "./routes/policies.js";
import { reviewRouter } from "./routes/review.js";
import { feedbackRouter } from "./routes/feedback.js";

const app = express();
const provider = new GeminiProvider();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/v1/generate", generateRouter(provider));
app.use("/api/v1/policies", policiesRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/feedback", feedbackRouter);

app.listen(env.PORT, () => {
  logger.info(`TripWire AI gateway listening on :${env.PORT}`);
});
