import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";

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
