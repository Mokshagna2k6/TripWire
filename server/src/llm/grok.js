import { env } from "../config/env.js";
import { localEmbed } from "./localEmbed.js";

const MODEL = "grok-4-fast";
const API_URL = "https://api.x.ai/v1/chat/completions";

export class GrokProvider {
  constructor(apiKey = env.XAI_API_KEY) {
    this.apiKey = apiKey;
  }

  async generate(prompt, opts = {}) {
    const messages = [];
    if (opts.systemInstruction) messages.push({ role: "system", content: opts.systemInstruction });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: opts.temperature ?? 0.4,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`xAI request failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      tokens: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  async embed(text) {
    // xAI has no embeddings API — use the local hashing embedder for all RAG comparisons.
    return localEmbed(text);
  }
}
