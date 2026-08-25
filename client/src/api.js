const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok && res.status !== 202 && res.status !== 403) {
    throw new Error(`request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  generate: (domain, prompt) =>
    request("/generate", { method: "POST", body: JSON.stringify({ domain, prompt }) }),

  listPolicies: () => request("/policies"),
  updatePolicy: (id, data) => request(`/policies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listReviews: () => request("/review"),
  decideReview: (id, decision) =>
    request(`/review/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }),

  feedbackStats: () => request("/feedback/stats"),
};
