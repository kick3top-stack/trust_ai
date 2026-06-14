export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}
