import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional().default(""),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
});

export const env = schema.parse(process.env);
