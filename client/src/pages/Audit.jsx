import { useEffect, useState } from "react";
import { FileSearch, RefreshCw, Search, X } from "lucide-react";
import { api } from "../api.js";
import { Card, Badge, Button, Table } from "../components/ui.jsx";
import MetricsPanel from "../components/MetricsPanel.jsx";

const ACTIONS = ["ALLOW", "EDIT_CLARIFY", "REGENERATE", "BLOCK", "HUMAN_REVIEW"];

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

function Pre({ value }) {
  return (
    <pre className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-2xs text-slate-600 overflow-x-auto whitespace-pre-wrap break-words">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

/**
 * Audit trace explorer (spec 32). The trace is what answers "why did TripWire
 * block this answer?" — every input to the decision, in the order the gateway
 * saw it, reconstructed after the fact.
 */
export default function Audit() {
  const [traces, setTraces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .listAudit({ action, q: query })
      .then((rows) => {
        setTraces(rows);
        // Drop a stale selection that the new filter no longer includes.
        setSelected((prev) => (prev && rows.some((r) => r.id === prev.id) ? prev : null));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [action]);

  const rows = traces.map((t) => [
    <span className="font-mono text-2xs text-slate-500">{t.requestId.slice(0, 8)}</span>,
    <span className="text-2xs text-slate-500">{new Date(t.createdAt).toLocaleString()}</span>,
    <Badge tone={t.action}>{t.action}</Badge>,
    <Badge tone={t.riskLevel}>{t.riskLevel}</Badge>,
    <span className="text-2xs font-mono text-slate-500">{t.promptMeta?.preRiskMode ?? "—"}</span>,
    <span className="text-2xs font-mono text-slate-500">{t.latencyMs}ms</span>,
  ]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Audit & Execution Trace</h2>
          <p className="text-xs text-slate-500">
            Every request creates a trace. Select one to reconstruct exactly why the gateway decided what it did.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5 self-start">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Filters live in one row above the table. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search response text…"
            className="w-56 border-0 p-0 text-xs text-slate-700 outline-hidden placeholder:text-slate-400"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600" title="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <Button variant="secondary" size="sm" onClick={load}>
          Apply
        </Button>
        <span className="text-2xs text-slate-400 font-mono">{traces.length} traces</span>
      </div>

      {loading && traces.length === 0 ? (
        <Card>
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
            Loading audit traces…
          </div>
        </Card>
      ) : traces.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 text-center py-4">
            No audit traces match. Run a request from the Inspector to generate one.
          </p>
        </Card>
      ) : (
        <Table
          headers={["Request", "Time", "Action", "Risk", "Mode", "Latency"]}
          rows={rows}
          onRowClick={(i) => setSelected(traces[i])}
          selectedIndex={selected ? traces.findIndex((t) => t.id === selected.id) : undefined}
        />
      )}

      {selected && (
        <Card className="border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reconstructed Decision</h3>
                <p className="font-mono text-2xs text-slate-400">{selected.requestId}</p>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={selected.action} showDot>
              {selected.action}
            </Badge>
            <Badge tone={selected.riskLevel}>{selected.riskLevel} risk</Badge>
            <span className="text-2xs font-mono text-slate-400">
              {selected.model} · mode {selected.promptMeta?.preRiskMode ?? "—"} · domain{" "}
              {selected.promptMeta?.domain ?? "—"} · {selected.latencyMs}ms · {selected.regenerationCount} regen ·
              outcome {selected.finalOutcome}
            </span>
          </div>

          {selected.promptMeta?.preRiskReasons?.length > 0 && (
            <Section title="Pre-Risk Routing">
              <ul className="text-2xs text-slate-600 space-y-0.5">
                {selected.promptMeta.preRiskReasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Raw Model Response (held before delivery)">
            <Pre value={selected.rawResponse} />
          </Section>

          <MetricsPanel metrics={selected.metrics} />

          {selected.tokens && (
            <Section title="Verification Cost">
              <Pre value={selected.tokens} />
            </Section>
          )}

          {selected.evidence?.length > 0 && (
            <Section title="Retrieved Evidence">
              <div className="space-y-1.5">
                {selected.evidence.map((ev, i) => (
                  <div key={i} className="rounded-lg bg-white border border-slate-200 p-2 text-2xs text-slate-600">
                    <div className="flex items-center justify-between font-mono text-slate-400 mb-1">
                      <span>[{ev.source}]</span>
                      <span className="text-indigo-600 font-semibold">sim={ev.similarity?.toFixed(2)}</span>
                    </div>
                    <p>{ev.text}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {selected.judgeOutput && (
            <Section title="AI Judge">
              <Pre value={selected.judgeOutput} />
            </Section>
          )}

          {selected.structuredRepresentation && (
            <Section title="Structured Representation">
              <Pre value={selected.structuredRepresentation} />
            </Section>
          )}
        </Card>
      )}
    </div>
  );
}
