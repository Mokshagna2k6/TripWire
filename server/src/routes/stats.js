import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const statsRouter = Router();

// Percentiles are computed in JS over a recent window rather than in SQL — same
// tradeoff the evidence store already makes with cosine similarity, and it keeps
// this working on any Postgres without extensions.
const WINDOW = 500;

/** Nearest-rank percentile over an ascending-sorted array. Exported for tests. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function rate(count, total) {
  return total === 0 ? 0 : count / total;
}

/**
 * Aggregate efficiency + governance KPIs for the dashboard's Efficiency panel
 * (spec 39): latency percentiles, VCO, and the rates that show adaptive
 * verification is actually being adaptive rather than running everything always.
 */
statsRouter.get("/", asyncHandler(async (_req, res) => {
  const traces = await prisma.auditTrace.findMany({
    orderBy: { createdAt: "desc" },
    take: WINDOW,
    select: {
      latencyMs: true,
      tokens: true,
      action: true,
      regenerationCount: true,
      judgeOutput: true,
      promptMeta: true,
      finalOutcome: true,
    },
  });

  const total = traces.length;
  if (total === 0) {
    return res.json({ total: 0, sampleWindow: WINDOW, empty: true });
  }

  const latencies = traces.map((t) => t.latencyMs).sort((a, b) => a - b);

  // Older traces predate the baseline/governance split and have flat {input, output}
  // only. Treat those as all-baseline (vco 0) rather than dropping them.
  let baselineTokens = 0;
  let governanceTokens = 0;
  const vcoValues = [];
  for (const t of traces) {
    const tk = t.tokens ?? {};
    const base = tk.baseline ? tk.baseline.input + tk.baseline.output : (tk.input ?? 0) + (tk.output ?? 0);
    const gov = tk.governance ? tk.governance.input + tk.governance.output : 0;
    baselineTokens += base;
    governanceTokens += gov;
    vcoValues.push(typeof tk.vco === "number" ? tk.vco : 0);
  }

  const modeDistribution = { FAST: 0, STANDARD: 0, DEEP: 0 };
  for (const t of traces) {
    const mode = t.promptMeta?.preRiskMode;
    if (mode in modeDistribution) modeDistribution[mode]++;
  }

  const actionDistribution = {};
  for (const t of traces) {
    actionDistribution[t.action] = (actionDistribution[t.action] ?? 0) + 1;
  }

  res.json({
    total,
    sampleWindow: WINDOW,
    latency: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      mean: Math.round(latencies.reduce((s, v) => s + v, 0) / total),
      max: latencies[latencies.length - 1],
    },
    tokens: {
      baseline: baselineTokens,
      governance: governanceTokens,
      total: baselineTokens + governanceTokens,
    },
    // Aggregate VCO from summed tokens, not a mean of per-request ratios — a
    // mean of ratios lets one tiny request skew the whole figure.
    vco: baselineTokens === 0 ? 0 : governanceTokens / baselineTokens,
    meanRequestVco: vcoValues.reduce((s, v) => s + v, 0) / total,
    rates: {
      regeneration: rate(traces.filter((t) => t.regenerationCount > 0).length, total),
      // judgeOutput is persisted non-null only when the Judge actually ran.
      judgeInvocation: rate(traces.filter((t) => t.judgeOutput !== null).length, total),
      block: rate(traces.filter((t) => t.action === "BLOCK").length, total),
      escalation: rate(traces.filter((t) => t.action === "HUMAN_REVIEW").length, total),
    },
    modeDistribution,
    actionDistribution,
  });
}));
