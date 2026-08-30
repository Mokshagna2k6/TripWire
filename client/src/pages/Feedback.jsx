import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Info, CheckCircle, RefreshCw } from "lucide-react";
import { api } from "../api.js";
import { Card, Button, PageHeader, StatCard } from "../components/ui.jsx";

export default function Feedback() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .feedbackStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading && !stats) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
          Loading analytics & feedback metrics…
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <p className="text-sm text-slate-500 text-center py-4">No feedback telemetry available.</p>
      </Card>
    );
  }

  const chartData = [
    { name: "Precision", value: Number((stats.precision * 100).toFixed(1)) },
    { name: "Recall", value: Number((stats.recall * 100).toFixed(1)) },
    { name: "FPR", value: Number((stats.falsePositiveRate * 100).toFixed(1)) },
    { name: "FNR", value: Number((stats.falseNegativeRate * 100).toFixed(1)) },
    { name: "Override Rate", value: Number((stats.overrideRate * 100).toFixed(1)) },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <PageHeader
        title="Governance Telemetry & Model Feedback"
        subtitle="Real-time verification accuracy, human override analytics, and confusion matrix benchmarking."
        actions={
          <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Refresh Stats
          </Button>
        }
      />

      {/* Top Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Audited" value={stats.total} sub="Human evaluations" accent />
        <StatCard
          label="Precision"
          value={`${(stats.precision * 100).toFixed(1)}%`}
          sub="Accuracy ratio"
          tone="text-emerald-600"
        />
        <StatCard
          label="Recall"
          value={`${(stats.recall * 100).toFixed(1)}%`}
          sub="Coverage ratio"
          tone="text-brand-700"
        />
        <StatCard
          label="FPR"
          value={`${(stats.falsePositiveRate * 100).toFixed(1)}%`}
          sub="False positive rate"
          tone="text-amber-600"
        />
        <StatCard
          label="FNR"
          value={`${(stats.falseNegativeRate * 100).toFixed(1)}%`}
          sub="False negative rate"
          tone="text-rose-600"
        />
        <StatCard
          label="Override Rate"
          value={`${(stats.overrideRate * 100).toFixed(1)}%`}
          sub="Human overrides"
          tone="text-purple-600"
        />
      </div>

      {/* Chart Section */}
      <Card className="border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Evaluation Metrics Overview (%)</h3>
        </div>
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} unit="%" />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill="#c53678" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Confusion Matrix Section */}
      <Card className="border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Confusion Counts & Classification Matrix</h3>
          </div>
          <span className="text-2xs tabular-nums text-slate-400">Sample size: {stats.total}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-emerald-700">{stats.truePositive}</p>
            <p className="text-xs font-semibold text-emerald-900 mt-1">True Positive</p>
            <p className="text-2xs text-emerald-600">Correctly Flagged</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-emerald-700">{stats.trueNegative}</p>
            <p className="text-xs font-semibold text-emerald-900 mt-1">True Negative</p>
            <p className="text-2xs text-emerald-600">Correctly Allowed</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-rose-700">{stats.falsePositive}</p>
            <p className="text-xs font-semibold text-rose-900 mt-1">False Positive</p>
            <p className="text-2xs text-rose-600">System ALLOW → Human BLOCK</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-rose-700">{stats.falseNegative}</p>
            <p className="text-xs font-semibold text-rose-900 mt-1">False Negative</p>
            <p className="text-2xs text-rose-600">System BLOCK → Human ALLOW</p>
          </div>
        </div>

        {/* Convention note */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-600">
          <Info className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
          <p className="text-2xs leading-relaxed text-slate-500">
            <strong className="text-slate-700 font-semibold">Domain Convention:</strong> System BLOCK + Human ALLOW = False Negative (over-blocking safe content). System ALLOW + Human BLOCK = False Positive (missed violation).
          </p>
        </div>
      </Card>
    </div>
  );
}
