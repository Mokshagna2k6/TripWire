import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { GeminiProvider } from "./llm/gemini.js";
import { createApp } from "./app.js";

const app = createApp(new GeminiProvider());

app.listen(env.PORT, () => {
  logger.info(`TripWire AI gateway listening on :${env.PORT}`);
});
