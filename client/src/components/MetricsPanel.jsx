/**
 * Explicit metric registry for the 10 core metrics + auxiliary detectors.
 *
 * Replaces a blind `Object.entries(metrics)` loop that rendered SchemaX (an
 * object) as "[object Object]" and an unsampled CBG (null) as the string
 * "null". Every metric now declares its own scale, direction and formatter,
 * grouped by the spec's own Performance / Efficiency / Responsibility split.
 */

/** 0-5 scales are severities (lower is better); 0-1 scales vary — `higherIsBetter` says which. */
const GROUPS = [
  {
    title: "Performance",
    metrics: [
      { key: "schemaX", label: "SchemaX", max: 1, higherIsBetter: true, accessor: (m) => m.schemaX?.score },
      { key: "errorDensity", label: "Error Density", max: 5, higherIsBetter: false },
      { key: "uis", label: "UIS", hint: "Unsupported Inference", max: 5, higherIsBetter: false },
      { key: "ceg", label: "CEG", hint: "Confidence–Evidence Gap", max: 5, higherIsBetter: false },
    ],
  },
  {
    title: "Efficiency",
    metrics: [
      { key: "cur", label: "CUR", hint: "Context Utilization", max: 1, higherIsBetter: true },
      { key: "ro", label: "RO", hint: "Rework Overhead", max: 1, higherIsBetter: false },
      { key: "rre", label: "RRE", hint: "Retrieval Retention", max: 1, higherIsBetter: true },
    ],
  },
  {
    title: "Responsibility",
    metrics: [
      { key: "pls", label: "PLS", hint: "PII / Secret Leakage", max: 5, higherIsBetter: false },
      { key: "cbg", label: "CBG", hint: "Counterfactual Bias Gap", max: 1, higherIsBetter: false },
      { key: "shs", label: "SHS", hint: "Safety / Harm", max: 5, higherIsBetter: false },
    ],
  },
  {
    title: "Auxiliary",
    metrics: [
      { key: "sas", label: "SAS", hint: "Semantic Anomaly", max: 1, higherIsBetter: false },
      { key: "hallucinationRisk", label: "Hallucination Risk", max: 1, higherIsBetter: false },
    ],
  },
];

/** Green / amber / rose by how far the value sits from the good end of its own scale. */
function toneFor(value, max, higherIsBetter) {
  const normalized = higherIsBetter ? 1 - value / max : value / max;
  if (normalized <= 0.3) return "text-emerald-600";
  if (normalized <= 0.6) return "text-amber-600";
  return "text-rose-600";
}

function MetricTile({ def, metrics }) {
  const raw = def.accessor ? def.accessor(metrics) : metrics[def.key];

  // CBG is deliberately sampled (8% of traffic, 30% in DEEP) rather than run on
  // every response — spec point 18. Null means "not sampled", not "zero bias".
  if (raw === null || raw === undefined) {
    return (
      <div className="rounded-lg bg-white border border-dashed border-slate-200 px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-2xs font-bold text-slate-500">{def.label}</span>
          <span className="text-2xs text-slate-400 italic shrink-0">not sampled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 shadow-2xs" title={def.hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-2xs font-bold text-slate-700">{def.label}</span>
        <span className={`font-mono text-xs font-semibold shrink-0 ${toneFor(raw, def.max, def.higherIsBetter)}`}>
          {raw.toFixed(2)}
          <span className="text-slate-300 font-normal">/{def.max}</span>
        </span>
      </div>
      {def.hint && <div className="text-2xs text-slate-400 truncate">{def.hint}</div>}
    </div>
  );
}

/** SchemaX = 0.5(ES) + 0.25(SQ) + 0.25(SC) — the spec's headline formula, shown rather than hidden. */
function SchemaXBreakdown({ schemaX }) {
  if (!schemaX || typeof schemaX.score !== "number") return null;
  const parts = [
    ["ES", schemaX.evidenceSupport, "0.5"],
    ["SQ", schemaX.sourceQuality, "0.25"],
    ["SC", schemaX.schemaCompliance, "0.25"],
  ];
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 shadow-2xs">
      <div className="flex items-center justify-between text-2xs text-slate-400 mb-1.5">
        <span className="font-mono">SchemaX = 0.5(ES) + 0.25(SQ) + 0.25(SC)</span>
        <span className="font-mono text-slate-500">
          {schemaX.supportedClaims}/{schemaX.totalClaims} claims supported
        </span>
      </div>
      <div className="flex gap-3">
        {parts.map(([name, value, weight]) => (
          <div key={name} className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xs font-bold text-slate-600">{name}</span>
              <span className="font-mono text-2xs text-slate-300">×{weight}</span>
            </div>
            <div className="font-mono text-xs font-semibold text-indigo-600">{value.toFixed(2)}</div>
            <div className="mt-0.5 h-1 rounded-full bg-slate-100">
              <div className="h-1 rounded-full bg-indigo-500" style={{ width: `${value * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MetricsPanel({ metrics }) {
  if (!metrics) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
        10 Core Governance Metrics + Auxiliary
      </h4>
      <SchemaXBreakdown schemaX={metrics.schemaX} />
      {GROUPS.map((group) => (
        <div key={group.title}>
          <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{group.title}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {group.metrics.map((def) => (
              <MetricTile key={def.key} def={def} metrics={metrics} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
