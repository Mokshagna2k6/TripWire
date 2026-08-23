import type { PropsWithChildren, ButtonHTMLAttributes } from "react";

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`rounded-lg border border-slate-800 bg-slate-900 p-4 shadow-sm ${className}`}>{children}</div>;
}

const BADGE_COLORS: Record<string, string> = {
  low: "bg-emerald-900 text-emerald-300 border-emerald-700",
  medium: "bg-amber-900 text-amber-300 border-amber-700",
  high: "bg-orange-900 text-orange-300 border-orange-700",
  critical: "bg-red-900 text-red-300 border-red-700",
  ALLOW: "bg-emerald-900 text-emerald-300 border-emerald-700",
  EDIT_CLARIFY: "bg-sky-900 text-sky-300 border-sky-700",
  REGENERATE: "bg-amber-900 text-amber-300 border-amber-700",
  BLOCK: "bg-red-900 text-red-300 border-red-700",
  HUMAN_REVIEW: "bg-purple-900 text-purple-300 border-purple-700",
  default: "bg-slate-800 text-slate-300 border-slate-700",
};

export function Badge({ children, tone }: PropsWithChildren<{ tone?: string }>) {
  const color = (tone && BADGE_COLORS[tone]) ?? BADGE_COLORS.default;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>{children}</span>;
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400">
            {headers.map((h) => (
              <th key={h} className="py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/60">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
