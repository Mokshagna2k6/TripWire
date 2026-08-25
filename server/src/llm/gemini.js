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

  /** Transcribes a voice clip via Gemini's multimodal audio input. Counts against the same request quota as generate(). */
  async transcribe(base64Audio, mimeType) {
    const res = await this.client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this audio verbatim. Output only the spoken words as plain text, nothing else — no commentary, no quotes." },
            { inlineData: { mimeType, data: base64Audio } },
          ],
        },
      ],
      config: { temperature: 0 },
    });
    return (res.text ?? "").trim();
  }

  async embed(text) {
    // Local hashing embedder, not the Gemini embeddings API — avoids burning a second
    // quota-metered call per request on top of the generation call.
    return localEmbed(text);
  }
}
