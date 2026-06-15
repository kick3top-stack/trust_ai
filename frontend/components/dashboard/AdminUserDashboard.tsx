"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import type { AdminStats } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { ChartsAndActivity } from "./PersonalDashboard";

type Props = {
  stats: AdminStats | null;
  user: AuthUser | null;
  error: string | null;
};

export function AdminUserDashboard({ stats, user, error }: Props) {
  const creditsSpent7d =
    stats?.credits_spent_7d ??
    stats?.generations_by_day.reduce((sum, d) => sum + (d.credits ?? 0), 0) ??
    0;
  const integrity = stats
    ? `${(stats.verification_success_rate * 100).toFixed(1)}%`
    : "-";

  return (
    <>
      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          {error.includes("Not Found") && (
            <span className="mt-1 block text-red-200/80">
              Restart the backend on your VPS so it includes the latest admin API routes, then try
              again.
            </span>
          )}
        </div>
      )}

      {user && (
        <div className="panel mb-6">
          <div className="panel-header">Account</div>
          <div className="panel-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Name</p>
              <p className="text-white">{user.display_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Email</p>
              <p className="text-slate-300">{user.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Role</p>
              <p className={user.role === "admin" ? "text-violet-400" : "text-slate-300"}>
                {user.role}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
              <p className={user.is_active ? "text-emerald-400" : "text-red-400"}>
                {user.is_active ? "Active" : "Disabled"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Joined</p>
              <p className="text-slate-400">{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">User ID</p>
              <p className="font-mono text-xs text-slate-500">{user.id}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
        Viewing <strong>{user?.display_name || "this user"}</strong>&apos;s data only. Platform-wide
        totals are on{" "}
        <Link href="/admin/overview" className="text-amber-200 underline">
          Platform overview
        </Link>
        .
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="User credit balance"
          value={stats?.credit_balance ?? user?.credit_balance ?? "-"}
          highlight
        />
        <StatCard label="User credits spent (7d)" value={stats ? creditsSpent7d : "-"} />
        <StatCard label="User generations" value={stats?.total_generations ?? "-"} />
        <StatCard label="User integrity rate" value={integrity} />
      </div>

      <ChartsAndActivity stats={stats} creditsSpent7d={creditsSpent7d} showUserColumn={false} />
    </>
  );
}
