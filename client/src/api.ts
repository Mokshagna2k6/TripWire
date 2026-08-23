const BASE = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok && res.status !== 202 && res.status !== 403) {
    throw new Error(`request failed: ${res.status}`);
  }
  return res.json();
}

export interface GenerateResult {
  requestId: string;
  action: string;
  riskLevel: string;
  reasons: string[];
  response: string | null;
  regenerationCount: number;
  humanReviewId?: string;
  metrics: Record<string, unknown>;
  evidence: { text: string; source: string; similarity: number }[];
  judgeOutput: { hallucinationRisk: number; safetySeverity: number; rationale: string } | null;
  preRiskMode: string;
}

export const api = {
  generate: (domain: string, prompt: string) =>
    request<GenerateResult>("/generate", { method: "POST", body: JSON.stringify({ domain, prompt }) }),

  listPolicies: () => request<any[]>("/policies"),
  updatePolicy: (id: string, data: object) => request<any>(`/policies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listReviews: () => request<any[]>("/review"),
  decideReview: (id: string, decision: "ALLOW" | "BLOCK") =>
    request<any>(`/review/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }),

  feedbackStats: () => request<any>("/feedback/stats"),
};
