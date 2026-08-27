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

  it("GET /some/unknown/path returns a JSON 404, not Express's default HTML page", async () => {
    const res = await supertest(app).get("/some/unknown/path");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not found" });
  });

  // No DATABASE_URL is set in this test environment, so any DB-backed route throws —
  // exactly the failure mode asyncHandler + the error middleware exist to catch cleanly.
  it("a DB-backed route that throws still returns a clean JSON 500, not a hang or HTML", async () => {
    const res = await supertest(app).get("/api/v1/policies");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal server error" });
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
