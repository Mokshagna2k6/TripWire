import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

const MODEL = "gemini-2.0-flash";
const EMBED_MODEL = "text-embedding-004";

export class GeminiProvider {
  constructor(apiKey = env.GEMINI_API_KEY) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(prompt, opts = {}) {
    const res = await this.client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: opts.systemInstruction,
        temperature: opts.temperature ?? 0.4,
      },
    });
    const text = res.text ?? "";
    const usage = res.usageMetadata;
    return {
      text,
      tokens: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
      },
    };
  }

  async embed(text) {
    const res = await this.client.models.embedContent({
      model: EMBED_MODEL,
      contents: text,
    });
    return res.embeddings?.[0]?.values ?? [];
  }
}
