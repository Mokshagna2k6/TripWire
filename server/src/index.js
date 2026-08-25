import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { GrokProvider } from "./llm/grok.js";
import { createApp } from "./app.js";

const app = createApp(new GrokProvider());

app.listen(env.PORT, () => {
  logger.info(`TripWire AI gateway listening on :${env.PORT}`);
});
