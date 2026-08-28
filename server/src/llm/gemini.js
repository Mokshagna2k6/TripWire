import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { localEmbed } from "./localEmbed.js";
import { mapGeminiSafetyRatings } from "./geminiSafety.js";

const MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2_048;

function withTimeout(promise, timeoutMs, operation) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class GeminiProvider {
  constructor(apiKey = env.GEMINI_API_KEY) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(prompt, opts = {}) {
    // Plain text stays a plain string content (cheapest path); attachments switch to the
    // multimodal parts shape so the actual file bytes reach the model, not just a filename.
    const contents = opts.attachments?.length
      ? [{ role: "user", parts: [{ text: prompt }, ...opts.attachments.map((a) => ({ inlineData: { mimeType: a.mimeType, data: a.data } }))] }]
      : prompt;

    const res = await withTimeout(this.client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: opts.systemInstruction,
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      },
    }), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, "Gemini generation");
    const text = res.text ?? "";
    const usage = res.usageMetadata;
    return {
      text,
      tokens: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
      },
      // Free — already computed by Google on every call, we're just reading it now.
      geminiSafetyHits: mapGeminiSafetyRatings(res.candidates?.[0]?.safetyRatings),
    };
  }

  /** Transcribes a voice clip via Gemini's multimodal audio input. Counts against the same request quota as generate(). */
  async transcribe(base64Audio, mimeType) {
    const res = await withTimeout(this.client.models.generateContent({
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
    }), DEFAULT_TIMEOUT_MS, "Gemini transcription");
    return (res.text ?? "").trim();
  }

  async embed(text) {
    // Always local, never the real Gemini embeddings API. embed() is called far more often
    // than generate() — once per response, once per retrieved evidence chunk, twice more for
    // CBG, on every verification pass including regenerate retries — so routing it through a
    // metered call turns a handful of quota-relevant requests into dozens per user message.
    // SAS/CUR/CBG only need embeddings that are internally consistent with each other, not
    // "real" semantic ones, so the free local hash is the right tool here, not a downgrade.
    return localEmbed(text);
  }
}
