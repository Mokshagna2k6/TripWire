import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Card } from "../components/ui.js";

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

  useEffect(() => {
    api.feedbackStats().then(setStats);
  }, []);

  if (!stats) return <Card><p className="text-sm text-slate-400">Loading…</p></Card>;

  const chartData = [
    { name: "Precision", value: stats.precision },
    { name: "Recall", value: stats.recall },
    { name: "FPR", value: stats.falsePositiveRate },
    { name: "FNR", value: stats.falseNegativeRate },
    { name: "Override rate", value: stats.overrideRate },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-2 text-xs text-slate-500">
          Reversed convention (explicit product requirement): system BLOCK + human ALLOW = false negative; system ALLOW + human
          BLOCK = false positive.
        </p>
        <p className="text-sm text-slate-300">{stats.total} human-reviewed feedback records collected.</p>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Precision / Recall / FPR / FNR / Override rate</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
            <YAxis domain={[0, 1]} stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Confusion counts</h3>
        <div className="grid grid-cols-4 gap-3 text-center text-sm">
          <div>
            <p className="text-2xl text-emerald-400">{stats.truePositive}</p>
            <p className="text-xs text-slate-500">True positive</p>
          </div>
          <div>
            <p className="text-2xl text-emerald-400">{stats.trueNegative}</p>
            <p className="text-xs text-slate-500">True negative</p>
          </div>
          <div>
            <p className="text-2xl text-red-400">{stats.falsePositive}</p>
            <p className="text-xs text-slate-500">False positive</p>
          </div>
          <div>
            <p className="text-2xl text-red-400">{stats.falseNegative}</p>
            <p className="text-xs text-slate-500">False negative</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
