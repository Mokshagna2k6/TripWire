import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Card, Badge, Button } from "../components/ui.js";

interface PendingReview {
  id: string;
  risk: string;
  reason: string;
  response: string;
  createdAt: string;
  auditTrace: { action: string };
}

export default function Review() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);

  function load() {
    api.listReviews().then(setReviews);
  }
  useEffect(load, []);

  async function decide(id: string, decision: "ALLOW" | "BLOCK") {
    await api.decideReview(id, decision);
    load();
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">No pending human reviews.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <Card key={r.id}>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={r.risk}>{r.risk} risk</Badge>
            <Badge tone={r.auditTrace.action}>system: {r.auditTrace.action}</Badge>
            <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
          </div>
          <p className="mb-2 text-xs text-slate-400">{r.reason}</p>
          <p className="mb-3 whitespace-pre-wrap rounded bg-slate-800 p-2 text-sm text-slate-200">{r.response}</p>
          <div className="flex gap-2">
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => decide(r.id, "ALLOW")}>
              Allow
            </Button>
            <Button className="bg-red-600 hover:bg-red-500" onClick={() => decide(r.id, "BLOCK")}>
              Block
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
