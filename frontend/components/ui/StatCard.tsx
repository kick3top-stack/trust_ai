export function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="stat-card">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span
        className={`text-2xl font-semibold tabular-nums ${highlight ? "text-teal-400" : "text-white"}`}
      >
        {value}
      </span>
    </div>
  );
}
