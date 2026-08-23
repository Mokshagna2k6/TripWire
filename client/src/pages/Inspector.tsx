import { useState } from "react";
import { api, type GenerateResult } from "../api.js";
import { Card, Badge, Button } from "../components/ui.js";

const DOMAINS = ["general", "finance_india", "medical", "enterprise"];

export default function Inspector() {
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [prompt, setPrompt] = useState("What is the GST filing deadline for small businesses in India?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.generate(domain, prompt);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <select
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button onClick={submit} disabled={loading || !prompt.trim()}>
              {loading ? "Running pipeline…" : "Submit"}
            </Button>
          </div>
          <textarea
            className="min-h-24 rounded-md border border-slate-700 bg-slate-800 p-2 text-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt to send through the Trust Gateway…"
          />
        </div>
      </Card>

      {error && (
        <Card className="border-red-800">
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      )}

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Decision</h3>
            <div className="flex flex-wrap gap-2">
              <Badge tone={result.action}>{result.action}</Badge>
              <Badge tone={result.riskLevel}>{result.riskLevel} risk</Badge>
              <Badge>{result.preRiskMode} mode</Badge>
              <Badge>{result.regenerationCount} regenerations</Badge>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-400">
              {result.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Response</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-200">
              {result.response ?? "(withheld — action was BLOCK or pending HUMAN_REVIEW)"}
            </p>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Metrics</h3>
            <pre className="overflow-x-auto text-xs text-slate-400">{JSON.stringify(result.metrics, null, 2)}</pre>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Evidence retrieved</h3>
            {result.evidence.length === 0 ? (
              <p className="text-xs text-slate-500">No evidence retrieved (FAST mode or hard-gated).</p>
            ) : (
              <ul className="space-y-2 text-xs text-slate-400">
                {result.evidence.map((e, i) => (
                  <li key={i} className="border-l-2 border-slate-700 pl-2">
                    <span className="text-slate-500">[{e.source}, sim={e.similarity.toFixed(2)}]</span> {e.text}
                  </li>
                ))}
              </ul>
            )}
            {result.judgeOutput && (
              <div className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-400">
                <p>AI Judge: hallucinationRisk={result.judgeOutput.hallucinationRisk.toFixed(2)}, safetySeverity={result.judgeOutput.safetySeverity}</p>
                <p className="italic">{result.judgeOutput.rationale}</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
