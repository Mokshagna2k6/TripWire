import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional().default(""),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  // The deployed client origin (e.g. https://tripwire.zone.id). When set, CORS is
  // pinned to it; when unset (local dev), any origin is allowed.
  CLIENT_ORIGIN: z.string().url().optional(),
});

export const env = schema.parse(process.env);
