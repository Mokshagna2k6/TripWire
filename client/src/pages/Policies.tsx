import { useEffect, useState } from "react";
import { Sliders, ShieldAlert, Check, RefreshCw, Layers } from "lucide-react";
import { api } from "../api.js";
import { Card, Badge, Button } from "../components/ui.js";

interface ThresholdRule {
  metric: string;
  operator: string;
  value: number;
  action: string;
}

interface Policy {
  id: string;
  name: string;
  domain: string;
  riskTolerance: string;
  thresholds: ThresholdRule[];
  hardGates: Record<string, number>;
}

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .listPolicies()
      .then(setPolicies)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveThreshold(policy: Policy, index: number, newValue: number) {
    const key = `${policy.id}:th:${index}`;
    const thresholds = policy.thresholds.map((t, i) => (i === index ? { ...t, value: newValue } : t));
    await api.updatePolicy(policy.id, { thresholds });
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
    load();
  }

  async function saveHardGate(policy: Policy, metric: string, newValue: number) {
    const key = `${policy.id}:hg:${metric}`;
    await api.updatePolicy(policy.id, { hardGates: { ...policy.hardGates, [metric]: newValue } });
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
    load();
  }

  if (loading && policies.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
          Loading policy rulesets…
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Governance Policies & Thresholds</h2>
          <p className="text-xs text-slate-500">
            Define domain-specific risk tolerance, instant hard-gate kill switches, and adaptive action triggers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5 self-start">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      <div className="space-y-5">
        {policies.map((p) => (
          <Card key={p.id} className="border-slate-200 shadow-2xs">
            {/* Policy Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                  <span className="font-mono text-2xs text-slate-400">ID: {p.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge tone={p.domain}>Domain: {p.domain}</Badge>
                <Badge tone={p.riskTolerance} showDot>
                  Tolerance: {p.riskTolerance}
                </Badge>
              </div>
            </div>

            {/* Hard Gates Section */}
            <div className="mb-5 rounded-lg bg-rose-50/40 border border-rose-100 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-900 mb-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Hard Gates (Immediate Short-Circuit BLOCK)
              </div>
              <p className="text-2xs text-rose-700/80 mb-3">
                If metric exceeds these critical boundaries, response is immediately blocked with zero scoring delay.
              </p>

              <div className="flex flex-wrap gap-3">
                {Object.entries(p.hardGates).map(([metric, value]) => {
                  const key = `${p.id}:hg:${metric}`;
                  const isSaved = savedKey === key;
                  return (
                    <div
                      key={metric}
                      className="flex items-center gap-2 rounded-lg bg-white border border-rose-200/80 px-3 py-1.5 shadow-2xs"
                    >
                      <span className="font-mono text-xs font-semibold text-slate-700">{metric}</span>
                      <span className="text-xs text-rose-600 font-bold">≥</span>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={value}
                        className="w-16 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-mono font-medium text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
                        onChange={(e) => setEditing((s) => ({ ...s, [key]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant={isSaved ? "success" : "secondary"}
                        className="px-2 py-0.5 text-2xs"
                        onClick={() => saveHardGate(p, metric, Number(editing[key] ?? value))}
                      >
                        {isSaved ? <Check className="h-3 w-3" /> : "Save"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Adaptive Threshold Rules Section */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                Adaptive Metric Rules & Action Triggers
              </div>

              <div className="space-y-2">
                {p.thresholds.map((t, i) => {
                  const key = `${p.id}:th:${i}`;
                  const isSaved = savedKey === key;
                  return (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="font-mono font-bold text-slate-900 w-28">{t.metric}</span>
                        <span className="font-mono text-slate-500 font-semibold">{t.operator}</span>
                        <span className="rounded bg-white border border-slate-200 px-2 py-0.5 font-mono text-slate-800 font-semibold">
                          {t.value}
                        </span>
                        <span className="text-slate-400 font-mono">→</span>
                        <Badge tone={t.action} showDot>
                          {t.action}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-slate-400 font-medium">Edit:</span>
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={t.value}
                          className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                          onChange={(e) => setEditing((s) => ({ ...s, [key]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant={isSaved ? "success" : "primary"}
                          className="px-2.5 py-1 text-2xs"
                          onClick={() => saveThreshold(p, i, Number(editing[key] ?? t.value))}
                        >
                          {isSaved ? <Check className="h-3 w-3" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
