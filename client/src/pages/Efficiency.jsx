import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge, Layers, Coins, RefreshCw } from "lucide-react";
import { api } from "../api.js";
import { Card, Button, PageHeader, StatCard } from "../components/ui.jsx";

/**
 * Verification mode palette. The obvious choice was to reuse the mode badge
 * colors (teal/blue/indigo), but blue-500 and indigo-500 sit at ΔE 7.2 for
 * normal vision — indistinguishable as adjacent bars. Re-stepped to
 * teal-600 / blue-500 / violet-600, which clears the normal-vision floor.
 * CVD separation still lands in the 6–8 band, so every bar is direct-labeled
 * and axis-named — identity never rests on color alone.
 */
const MODE_COLORS = { FAST: "#0d9488", STANDARD: "#3b82f6", DEEP: "#7c3aed" };
const TOKEN_COLORS = { baseline: "#3b82f6", governance: "#7c3aed" };

function pct(value) {
  return `${((value ?? 0) * 100).toFixed(1)}%`;
}

function StatTile({ label, value, unit, sub, tone = "text-slate-900" }) {
  return <StatCard label={label} value={value} unit={unit} sub={sub} tone={tone} />;
}

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  fontSize: "12px",
};

export default function Efficiency() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .stats()
      .then(setStats)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading && !stats) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <Card>
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
            Loading efficiency telemetry…
          </div>
        </Card>
      </div>
    );
  }

  if (!stats || stats.empty) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <Card>
          <p className="text-sm text-slate-500 text-center py-4">
            No requests audited yet. Run a request from the Inspector to populate efficiency telemetry.
          </p>
        </Card>
      </div>
    );
  }

  const modeData = ["FAST", "STANDARD", "DEEP"].map((mode) => ({
    mode,
    count: stats.modeDistribution[mode] ?? 0,
  }));

  const tokenData = [
    { name: "Baseline", tokens: stats.tokens.baseline, key: "baseline" },
    { name: "Governance", tokens: stats.tokens.governance, key: "governance" },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <PageHeader
        title="Efficiency & Verification Cost"
        subtitle={`Latency percentiles, verification cost overhead, and how adaptively the gateway is spending compute. Window: last ${stats.total} of ${stats.sampleWindow} requests.`}
        actions={
          <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="P50 Latency" value={stats.latency.p50} unit="ms" sub="Median end-to-end" />
        <StatTile label="P95 Latency" value={stats.latency.p95} unit="ms" sub={`Max ${stats.latency.max}ms`} />
        <StatTile
          label="VCO"
          value={pct(stats.vco)}
          sub="Governance cost overhead"
          tone={stats.vco > 0.5 ? "text-rose-600" : stats.vco > 0.25 ? "text-amber-600" : "text-emerald-600"}
        />
        <StatTile label="Regeneration Rate" value={pct(stats.rates.regeneration)} sub="Responses corrected" />
        <StatTile label="Judge Invocation" value={pct(stats.rates.judgeInvocation)} sub="DEEP verifications" />
        <StatTile label="Block Rate" value={pct(stats.rates.block)} sub={`Escalation ${pct(stats.rates.escalation)}`} />
      </div>

      {/* Verification mode distribution — the evidence that verification depth actually
          varies with risk rather than running everything on every request (spec 23). */}
      <Card className="border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <Layers className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Verification Depth Distribution</h3>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modeData} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="mode"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22} name="Requests">
                {modeData.map((d) => (
                  <Cell key={d.mode} fill={MODE_COLORS[d.mode]} />
                ))}
                <LabelList dataKey="count" position="right" fontSize={12} fill="#475569" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-2xs text-slate-500 border-t border-slate-100 pt-3">
          A healthy distribution is weighted toward FAST — expensive DEEP verification should be reserved for
          genuinely high-risk traffic.
        </p>
      </Card>

      {/* Per-stage timing — where the wall-clock actually goes. */}
      {stats.stageAverages && (
        <Card className="border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Gauge className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Average Latency by Stage</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Retrieval", stats.stageAverages.retrievalMs],
              ["Generation", stats.stageAverages.generationMs],
              ["Verification", stats.stageAverages.verificationMs],
              ["Audit (blocking)", stats.stageAverages.auditMs],
            ].map(([label, ms]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center">
                <p className="text-2xl font-extrabold text-slate-800 font-mono">{ms}ms</p>
                <p className="text-2xs font-semibold text-slate-600 mt-1">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-2xs text-slate-500 border-t border-slate-100 pt-3 mt-3">
            Generation is the model call(s). Audit is only non-zero on the HUMAN_REVIEW path — every other
            outcome writes its trace after the response is already sent.
          </p>
        </Card>
      )}

      {/* Token split — the concrete answer to "what did governance actually cost?" */}
      <Card className="border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Token Cost: Baseline vs Governance</h3>
          </div>
          <span className="text-2xs text-slate-400 font-mono">
            VCO = governance ÷ baseline = {pct(stats.vco)}
          </span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokenData} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]} barSize={22} name="Tokens">
                {tokenData.map((d) => (
                  <Cell key={d.key} fill={TOKEN_COLORS[d.key]} />
                ))}
                <LabelList
                  dataKey="tokens"
                  position="right"
                  fontSize={12}
                  fill="#475569"
                  formatter={(v) => v.toLocaleString()}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-2xs text-slate-500 border-t border-slate-100 pt-3">
          <span className="font-semibold text-slate-700">Baseline</span> is what the model call would have cost with
          no gateway. <span className="font-semibold text-slate-700">Governance</span> is everything TripWire added —
          regenerate retries, the EDIT/CLARIFY pass, the AI Judge, and CBG counterfactuals.
        </p>
      </Card>

      {/* Action mix */}
      <Card className="border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <Gauge className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Gateway Action Mix</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(stats.actionDistribution).map(([action, count]) => (
            <div key={action} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center">
              <p className="text-2xl font-extrabold text-slate-800 font-mono">{count}</p>
              <p className="text-2xs font-semibold text-slate-600 mt-1">{action}</p>
              <p className="text-2xs text-slate-400">{pct(count / stats.total)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
