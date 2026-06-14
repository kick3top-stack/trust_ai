"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GenerationsChart, ModelUsageChart } from "@/components/charts/DashboardCharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { fetchAdminStats, truncateHash, type AdminStats } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const verified = stats
    ? Math.round(stats.total_receipts * stats.verification_success_rate)
    : 0;
  const pending = stats?.open_batch_receipt_count ?? 0;
  const failed = stats ? Math.max(0, stats.total_receipts - verified - pending) : 0;
  const integrity = stats ? `${(stats.verification_success_rate * 100).toFixed(1)}%` : "—";

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="AI execution receipt overview" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error} — ensure backend is running at the configured API URL.
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Requests" value={stats?.total_generations ?? "—"} />
        <StatCard label="Verified" value={verified || "—"} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Failed" value={failed} />
        <StatCard label="Integrity" value={integrity} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header">Generations Over Time</div>
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
                <th>Status</th>
                <th>Receipt ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!stats?.latest_requests?.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No activity yet.{" "}
                    <Link href="/playground" className="text-teal-400 hover:underline">
                      Generate a receipt
                    </Link>
                  </td>
                </tr>
              )}
              {stats?.latest_requests?.map((r) => (
                <tr key={r.request_id}>
                  <td className="whitespace-nowrap text-slate-400">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </td>
                  <td>{r.model_name}</td>
                  <td>{r.credit_cost}</td>
                  <td>
                    <span className="text-emerald-400">
                      {r.status === "completed" ? "✓" : r.status}
                    </span>
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
