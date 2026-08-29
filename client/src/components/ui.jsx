export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all ${className}`}>
      {children}
    </div>
  );
}

const BADGE_STYLES = {
  // Risk levels
  low: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80", dot: "bg-emerald-500" },
  medium: { bg: "bg-amber-50 text-amber-700 border-amber-200/80", dot: "bg-amber-500" },
  high: { bg: "bg-orange-50 text-orange-700 border-orange-200/80", dot: "bg-orange-500" },
  critical: { bg: "bg-rose-50 text-rose-700 border-rose-200/80", dot: "bg-rose-500" },

  // Actions
  ALLOW: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80", dot: "bg-emerald-500" },
  EDIT_CLARIFY: { bg: "bg-sky-50 text-sky-700 border-sky-200/80", dot: "bg-sky-500" },
  REGENERATE: { bg: "bg-amber-50 text-amber-700 border-amber-200/80", dot: "bg-amber-500" },
  BLOCK: { bg: "bg-rose-50 text-rose-700 border-rose-200/80", dot: "bg-rose-500" },
  HUMAN_REVIEW: { bg: "bg-purple-50 text-purple-700 border-purple-200/80", dot: "bg-purple-500" },

  // Pre-risk modes
  FAST: { bg: "bg-teal-50 text-teal-700 border-teal-200/80", dot: "bg-teal-500" },
  STANDARD: { bg: "bg-blue-50 text-blue-700 border-blue-200/80", dot: "bg-blue-500" },
  DEEP: { bg: "bg-indigo-50 text-indigo-700 border-indigo-200/80", dot: "bg-indigo-500" },

  default: { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
};

export function Badge({ children, tone, showDot = false }) {
  const style = (tone && BADGE_STYLES[tone]) ? BADGE_STYLES[tone] : BADGE_STYLES.default;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${style.bg}`}>
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      {children}
    </span>
  );
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  children,
  ...props
}) {
  const variantStyles = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-xs border border-slate-900 active:scale-[0.99]",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/80",
    outline: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs",
    destructive: "bg-rose-600 text-white hover:bg-rose-500 shadow-xs border border-rose-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs border border-emerald-600",
  };

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * `onRowClick` receives the row index and makes rows keyboard-selectable —
 * needed by the audit list, where a row is the entry point into a full trace.
 * `selectedIndex` highlights the active row.
 */
export function Table({ headers, rows, onRowClick, selectedIndex }) {
  const interactive = typeof onRowClick === "function";
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`transition-colors ${interactive ? "cursor-pointer" : ""} ${
                selectedIndex === i ? "bg-indigo-50/70" : "hover:bg-slate-50/50"
              }`}
              onClick={interactive ? () => onRowClick(i) : undefined}
              tabIndex={interactive ? 0 : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(i);
                      }
                    }
                  : undefined
              }
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-slate-700">
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
