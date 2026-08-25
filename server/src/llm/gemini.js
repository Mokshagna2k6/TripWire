import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { localEmbed } from "./localEmbed.js";

const MODEL = "gemini-2.5-flash";

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
    // Local hashing embedder, not the Gemini embeddings API — avoids burning a second
    // quota-metered call per request on top of the generation call.
    return localEmbed(text);
  }
}
