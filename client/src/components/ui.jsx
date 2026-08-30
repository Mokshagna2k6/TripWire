export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 transition-colors ${className}`}>
      {children}
    </div>
  );
}

/**
 * Page title block. The reference design system leads every screen with a large
 * geometric (Outfit) headline plus a muted body-lg subtitle — see
 * vivid_architectural_minimal/DESIGN.md ("Maximum Breathing Room"). Every page
 * routes its header through here so the type scale stays consistent.
 */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px] sm:leading-9">
          {title}
        </h1>
        {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Stat / KPI tile. Matches the reference "Metric Cards" — uppercase tracked
 * label, a big Outfit value with an optional smaller unit suffix, a muted
 * sub-line, and the ghost-border hover ("Interaction Depth"). One tile per grid
 * can be `accent` (solid brand fill) as a focal point.
 */
export function StatCard({ label, value, unit, sub, tone, accent = false, className = "" }) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        accent
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-200 bg-white hover:border-brand-400"
      } ${className}`}
    >
      <span
        className={`text-[11px] font-bold uppercase tracking-wider ${
          accent ? "text-white/80" : "text-slate-400"
        }`}
      >
        {label}
      </span>
      <p
        className={`mt-1.5 font-display text-2xl font-bold leading-none ${
          accent ? "text-white" : tone || "text-slate-900"
        }`}
      >
        {value}
        {unit && (
          <span className={`ml-1 text-base font-semibold ${accent ? "text-white/70" : "text-slate-400"}`}>
            {unit}
          </span>
        )}
      </p>
      {sub && (
        <span className={`mt-1.5 block text-[11px] ${accent ? "text-white/70" : "text-slate-500"}`}>{sub}</span>
      )}
    </div>
  );
}

const BADGE_STYLES = {
  // Risk levels
  low: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  medium: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  high: { bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  critical: { bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },

  // Actions
  ALLOW: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  EDIT_CLARIFY: { bg: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  REGENERATE: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  BLOCK: { bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  HUMAN_REVIEW: { bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },

  // Pre-risk modes
  FAST: { bg: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  STANDARD: { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  DEEP: { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },

  default: { bg: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

/**
 * Status pill. The reference uses fully-round, uppercase, letter-spaced chips
 * with an optional LED dot — "high-contrast tags with 0.05em letter spacing for
 * maximum readability at small sizes."
 */
export function Badge({ children, tone, showDot = false }) {
  const style = (tone && BADGE_STYLES[tone]) ? BADGE_STYLES[tone] : BADGE_STYLES.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${style.bg}`}
    >
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
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-xs border border-brand-600 active:scale-[0.99]",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200",
    outline: "bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 border border-slate-300",
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
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600/25 disabled:cursor-not-allowed disabled:opacity-50 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3.5">
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
                selectedIndex === i ? "bg-brand-50" : "hover:bg-slate-50"
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
                <td key={j} className="px-4 py-3.5 text-slate-700">
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
