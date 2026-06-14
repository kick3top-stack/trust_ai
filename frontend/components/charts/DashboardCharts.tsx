"use client";

const COLORS = ["#14b8a6", "#8b5cf6", "#f59e0b", "#3b82f6", "#ec4899"];

export function GenerationsChart({
  data,
}: {
  data: Array<{ date: string; count: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 480;
  const height = 180;
  const padX = 24;
  const padY = 16;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * chartW;
    const y = padY + chartH - (d.count / max) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + chartH * (1 - t);
          return (
            <line
              key={t}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="currentColor"
              className="text-slate-800"
              strokeWidth="1"
            />
          );
        })}
        <path d={linePath} fill="none" stroke="#14b8a6" strokeWidth="2.5" />
        {points.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r="4" fill="#14b8a6" />
            <text
              x={p.x}
              y={height - 2}
              textAnchor="middle"
              className="fill-slate-500 text-[9px]"
            >
              {p.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>Last 7 days</span>
        <span>Peak: {max} / day</span>
      </div>
    </div>
  );
}

export function ModelUsageChart({
  data,
}: {
  data: Array<{ model_name: string; count: number; credits: number }>;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <div className="space-y-3">
      {data.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No generations yet</p>
      )}
      {data.map((item, i) => {
        const pct = Math.round((item.count / total) * 100);
        const color = COLORS[i % COLORS.length];
        return (
          <div key={item.model_name}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{item.model_name}</span>
              <span className="text-slate-500">
                {item.count} ({pct}%) · {item.credits} credits
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
