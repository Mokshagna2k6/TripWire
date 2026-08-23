import { useEffect, useState } from "react";
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

  function load() {
    api.listPolicies().then(setPolicies);
  }
  useEffect(load, []);

  async function saveThreshold(policy: Policy, index: number, newValue: number) {
    const thresholds = policy.thresholds.map((t, i) => (i === index ? { ...t, value: newValue } : t));
    await api.updatePolicy(policy.id, { thresholds });
    load();
  }

  async function saveHardGate(policy: Policy, metric: string, newValue: number) {
    await api.updatePolicy(policy.id, { hardGates: { ...policy.hardGates, [metric]: newValue } });
    load();
  }

  return (
    <div className="space-y-4">
      {policies.map((p) => (
        <Card key={p.id}>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{p.name}</h3>
            <Badge>{p.domain}</Badge>
            <Badge>tolerance: {p.riskTolerance}</Badge>
          </div>

          <p className="mb-1 text-xs uppercase text-slate-500">Hard gates (immediate BLOCK)</p>
          <div className="mb-3 flex flex-wrap gap-3">
            {Object.entries(p.hardGates).map(([metric, value]) => (
              <label key={metric} className="flex items-center gap-1 text-xs text-slate-400">
                {metric} ≥
                <input
                  type="number"
                  step="0.1"
                  defaultValue={value}
                  className="w-16 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-200"
                  onChange={(e) => setEditing((s) => ({ ...s, [`${p.id}:hg:${metric}`]: e.target.value }))}
                />
                <Button
                  className="px-2 py-0.5"
                  onClick={() => saveHardGate(p, metric, Number(editing[`${p.id}:hg:${metric}`] ?? value))}
                >
                  Save
                </Button>
              </label>
            ))}
          </div>

          <p className="mb-1 text-xs uppercase text-slate-500">Threshold rules</p>
          <div className="space-y-2">
            {p.thresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-64">
                  {t.metric} {t.operator} <span className="text-slate-200">{t.value}</span> → <Badge tone={t.action}>{t.action}</Badge>
                </span>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={t.value}
                  className="w-16 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-200"
                  onChange={(e) => setEditing((s) => ({ ...s, [`${p.id}:${i}`]: e.target.value }))}
                />
                <Button className="px-2 py-0.5" onClick={() => saveThreshold(p, i, Number(editing[`${p.id}:${i}`] ?? t.value))}>
                  Save
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
