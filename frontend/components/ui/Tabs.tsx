"use client";

import clsx from "clsx";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            "px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px",
            active === tab.id
              ? "border-teal-500 text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-300",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
