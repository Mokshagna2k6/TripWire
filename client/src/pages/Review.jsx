import { useEffect, useState } from "react";
import { UserCheck, CheckCircle2, XCircle, Clock, ShieldAlert, Check, RefreshCw } from "lucide-react";
import { api } from "../api.js";
import { Card, Badge, Button } from "../components/ui.jsx";

export default function Review() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState(null);

  function load() {
    setLoading(true);
    api
      .listReviews()
      .then(setReviews)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function decide(id, decision) {
    await api.decideReview(id, decision);
    setActionSuccess(`Incident marked as ${decision}`);
    setTimeout(() => setActionSuccess(null), 3000);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Human Moderation & Review Queue</h2>
          <p className="text-xs text-slate-500">
            Escalated LLM outputs requiring manual verification and safety audit before release.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-1.5 self-start">
          <RefreshCw className="h-3 w-3" />
          Refresh Queue
        </Button>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-800 animate-fade-in">
          <Check className="h-4 w-4 text-emerald-600" />
          {actionSuccess}
        </div>
      )}

      {loading && reviews.length === 0 ? (
        <Card>
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
            Loading review queue…
          </div>
        </Card>
      ) : reviews.length === 0 ? (
        <Card className="border-slate-200 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <UserCheck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Queue is Clear</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no pending requests requiring human review. Incoming high-risk outputs will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id} className="border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Badge tone={r.risk} showDot>
                    {r.risk.toUpperCase()} RISK
                  </Badge>
                  <Badge tone={r.auditTrace?.action}>
                    System Action: {r.auditTrace?.action || "FLAGGED"}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-2xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  <ShieldAlert className="h-3 w-3 text-amber-500" />
                  Escalation Rationale:
                </div>
                <p className="text-xs font-medium text-slate-700">{r.reason}</p>
              </div>

              <div className="mb-4">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Held Response Content:
                </span>
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {r.response}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100/70 hover:border-rose-300"
                  onClick={() => decide(r.id, "BLOCK")}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
                  Reject & Confirm Block
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => decide(r.id, "ALLOW")}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Approve & Release Response
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
