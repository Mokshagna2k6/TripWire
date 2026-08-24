import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Info, CheckCircle, RefreshCw } from "lucide-react";
import { api } from "../api.js";
import { Card, Button } from "../components/ui.js";

interface Stats {
  total: number;
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  overrideRate: number;
}

export default function Feedback() {
  const [stats, setStats] = useState<Stats | null>(null);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Governance Telemetry & Model Feedback</h2>
          <p className="text-xs text-slate-500">
            Real-time verification accuracy, human override analytics, and confusion matrix benchmarking.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5 self-start">
          <RefreshCw className="h-3 w-3" />
          Refresh Stats
        </Button>
      </div>

      {/* Top Stat Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 border-slate-200">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Audited</span>
          <p className="text-xl font-bold text-slate-900 font-mono mt-1">{stats.total}</p>
          <span className="text-2xs text-slate-500">Human evaluations</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Precision</span>
          <p className="text-xl font-bold text-emerald-600 font-mono mt-1">
            {(stats.precision * 100).toFixed(1)}%
          </p>
          <span className="text-2xs text-slate-500">Accuracy ratio</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Recall</span>
          <p className="text-xl font-bold text-indigo-600 font-mono mt-1">
            {(stats.recall * 100).toFixed(1)}%
          </p>
          <span className="text-2xs text-slate-500">Coverage ratio</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">FPR</span>
          <p className="text-xl font-bold text-amber-600 font-mono mt-1">
            {(stats.falsePositiveRate * 100).toFixed(1)}%
          </p>
          <span className="text-2xs text-slate-500">False positive rate</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">FNR</span>
          <p className="text-xl font-bold text-rose-600 font-mono mt-1">
            {(stats.falseNegativeRate * 100).toFixed(1)}%
          </p>
          <span className="text-2xs text-slate-500">False negative rate</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Override Rate</span>
          <p className="text-xl font-bold text-purple-600 font-mono mt-1">
            {(stats.overrideRate * 100).toFixed(1)}%
          </p>
          <span className="text-2xs text-slate-500">Human overrides</span>
        </Card>
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
              <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
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
          <span className="text-2xs text-slate-400 font-mono">Sample size: {stats.total}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <p className="text-3xl font-extrabold text-emerald-700 font-mono">{stats.truePositive}</p>
            <p className="text-xs font-semibold text-emerald-900 mt-1">True Positive</p>
            <p className="text-2xs text-emerald-600">Correctly Flagged</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <p className="text-3xl font-extrabold text-emerald-700 font-mono">{stats.trueNegative}</p>
            <p className="text-xs font-semibold text-emerald-900 mt-1">True Negative</p>
            <p className="text-2xs text-emerald-600">Correctly Allowed</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-center">
            <p className="text-3xl font-extrabold text-rose-700 font-mono">{stats.falsePositive}</p>
            <p className="text-xs font-semibold text-rose-900 mt-1">False Positive</p>
            <p className="text-2xs text-rose-600">System ALLOW → Human BLOCK</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-center">
            <p className="text-3xl font-extrabold text-rose-700 font-mono">{stats.falseNegative}</p>
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
