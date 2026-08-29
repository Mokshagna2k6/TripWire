const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

// Long enough to cover a genuine cold start + a DEEP verification pass, short
// enough that a truly hung request surfaces an error instead of spinning forever.
const REQUEST_TIMEOUT_MS = 75_000;

async function request(path, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "The gateway didn't respond in time. It may be waking from idle — wait a moment and try again."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok && res.status !== 202 && res.status !== 403) {
    throw new Error(`request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  generate: (domain, prompt, attachments, expectedFormat) =>
    request("/generate", { method: "POST", body: JSON.stringify({ domain, prompt, attachments, expectedFormat }) }),

  listPolicies: () => request("/policies"),
  updatePolicy: (id, data) => request(`/policies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listReviews: () => request("/review"),
  decideReview: (id, decision) =>
    request(`/review/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }),

  feedbackStats: () => request("/feedback/stats"),

  stats: () => request("/stats"),

  listAudit: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString();
    return request(`/audit${query ? `?${query}` : ""}`);
  },
  getAudit: (id) => request(`/audit/${id}`),

  transcribe: (audio, mimeType) =>
    request("/transcribe", { method: "POST", body: JSON.stringify({ audio, mimeType }) }),
};
