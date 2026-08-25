import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { bodySchema } from "../src/routes/generate.js";

const mockProvider = {
  async generate() {
    return { text: "This is a fine, safe test response.", tokens: { input: 5, output: 8 } };
  },
  async embed() {
    return [0.1, 0.2, 0.3];
  },
};

describe("API surface (health + request validation, no DB needed)", () => {
  const app = createApp(mockProvider);

  it("GET /health returns ok", async () => {
    const res = await supertest(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("POST /api/v1/generate rejects a request missing required fields", async () => {
    const res = await supertest(app).post("/api/v1/generate").send({});
    expect(res.status).toBe(400);
  });

});

describe("generate request schema (attachments)", () => {
  it("rejects an attachment with an unsupported mime type (e.g. .docx)", () => {
    const result = bodySchema.safeParse({
      domain: "general",
      prompt: "describe this file",
      attachments: [{ mimeType: "application/msword", data: "AAAA" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a supported image attachment", () => {
    const result = bodySchema.safeParse({
      domain: "general",
      prompt: "describe this image",
      attachments: [{ mimeType: "image/png", data: "AAAA" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 5 attachments", () => {
    const result = bodySchema.safeParse({
      domain: "general",
      prompt: "describe these",
      attachments: Array.from({ length: 6 }, () => ({ mimeType: "image/png", data: "AAAA" })),
    });
    expect(result.success).toBe(false);
  });
});
