"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { GenerationsChart, ModelUsageChart } from "@/components/charts/DashboardCharts";
import { GenerationStatusBadge, IntegrityBadge } from "@/components/ui/IntegrityBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { fetchAdminStats, truncateHash, type AdminStats } from "@/lib/api";

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshUser().catch(() => {});
    fetchAdminStats().then(setStats).catch((e) => setError(e.message));
  }, [refreshUser]);

  const verified = stats
    ? Math.round(stats.total_receipts * stats.verification_success_rate)
    : 0;
  const pending = stats?.open_batch_receipt_count ?? 0;
  const failed = stats ? Math.max(0, stats.total_receipts - verified - pending) : 0;
  const integrity = stats ? `${(stats.verification_success_rate * 100).toFixed(1)}%` : "—";
  const creditBalance = stats?.credit_balance ?? user?.credit_balance ?? "—";
  const creditsSpent7d = stats?.credits_spent_7d ?? stats?.generations_by_day.reduce((sum, d) => sum + (d.credits ?? 0), 0) ?? 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="AI execution receipt overview" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error} — ensure backend is running at the configured API URL.
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/billing" className="transition hover:opacity-90">
          <StatCard label="Credit Balance" value={creditBalance} highlight />
        </Link>
        <StatCard label="Credits Spent (7d)" value={stats ? creditsSpent7d : "—"} />
        <StatCard label="Total Requests" value={stats?.total_generations ?? "—"} />
        <StatCard label="Verified" value={verified || "—"} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Failed" value={failed} />
        <StatCard label="Integrity" value={integrity} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>Credit Usage Over Time</span>
            {stats && (
              <span className="normal-case tracking-normal text-teal-400">
                {creditsSpent7d} credits spent
              </span>
            )}
          </div>
          <div className="panel-body">
            <GenerationsChart data={stats?.generations_by_day ?? []} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">Model Usage</div>
          <div className="panel-body">
            <ModelUsageChart data={stats?.model_usage ?? []} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Recent Activity</div>
        <div className="panel-body overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Credits</th>
                <th>Integrity</th>
                <th>Generation</th>
                <th>Receipt ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!stats?.latest_requests?.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No activity yet.{" "}
                    <Link href="/playground" className="text-teal-400 hover:underline">
                      Generate a receipt
                    </Link>
                  </td>
                </tr>
              )}
              {stats?.latest_requests?.map((r) => (
                <tr
                  key={r.request_id}
                  className={
                    r.integrity_status === "failed" || r.integrity_status === "batch"
                      ? "bg-red-500/5"
                      : undefined
                  }
                >
                  <td className="whitespace-nowrap text-slate-400">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </td>
                  <td>{r.model_name}</td>
                  <td>{r.credit_cost}</td>
                  <td>
                    <IntegrityBadge status={r.integrity_status} compact />
                  </td>
                  <td>
                    <GenerationStatusBadge status={r.status} />
                  </td>
                  <td className="font-mono text-xs">{truncateHash(r.request_id, 6)}</td>
                  <td>
                    <Link
                      href={`/receipts/${r.request_id}`}
                      className="btn-secondary inline-block py-1 text-xs"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
