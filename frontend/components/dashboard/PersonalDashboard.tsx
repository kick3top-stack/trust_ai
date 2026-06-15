"use client";

import Link from "next/link";
import { GenerationsChart, ModelUsageChart } from "@/components/charts/DashboardCharts";
import { GenerationStatusBadge, IntegrityBadge } from "@/components/ui/IntegrityBadge";
import { StatCard } from "@/components/ui/StatCard";
import { truncateHash, type AdminStats } from "@/lib/api";

type Props = {
  stats: AdminStats | null;
  error: string | null;
  displayName?: string;
  creditBalance: number | string;
};

export function PersonalDashboard({ stats, error, displayName, creditBalance }: Props) {
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
        </div>
      )}

      <div className="mb-6 rounded-md border border-teal-500/25 bg-teal-500/5 px-4 py-3 text-sm text-teal-100">
        <span className="font-medium text-teal-300">Your account</span>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/billing" className="transition hover:opacity-90">
          <StatCard label="My credit balance" value={creditBalance} highlight />
        </Link>
        <StatCard label="My credits spent (7d)" value={stats ? creditsSpent7d : "-"} />
        <StatCard label="My generations" value={stats?.total_generations ?? "-"} />
        <StatCard label="My integrity rate" value={integrity} />
      </div>

      <ChartsAndActivity
        stats={stats}
        creditsSpent7d={creditsSpent7d}
        showUserColumn={false}
        emptyHint="playground"
      />
    </>
  );
}

type ChartsProps = {
  stats: AdminStats | null;
  creditsSpent7d: number | string;
  showUserColumn: boolean;
  emptyHint?: "playground" | "none";
};

export function ChartsAndActivity({
  stats,
  creditsSpent7d,
  showUserColumn,
  emptyHint = "none",
}: ChartsProps) {
  return (
    <>
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>Credit usage over time</span>
            {stats && (
              <span className="normal-case tracking-normal text-teal-400">
                {creditsSpent7d} credits
              </span>
            )}
          </div>
          <div className="panel-body">
            <GenerationsChart data={stats?.generations_by_day ?? []} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">Model usage</div>
          <div className="panel-body">
            <ModelUsageChart data={stats?.model_usage ?? []} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Recent activity</div>
        <div className="panel-body overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                {showUserColumn && <th>User</th>}
                <th>Model</th>
                <th>Credits</th>
                <th>Integrity</th>
                <th>Generation</th>
                <th>Receipt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!stats?.latest_requests?.length && (
                <tr>
                  <td
                    colSpan={showUserColumn ? 8 : 7}
                    className="py-8 text-center text-slate-500"
                  >
                    No activity yet.
                    {emptyHint === "playground" && (
                      <>
                        {" "}
                        <Link href="/playground" className="text-teal-400 hover:underline">
                          Generate a receipt
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              )}
              {stats?.latest_requests?.map((r) => (
                <tr key={r.request_id}>
                  <td className="whitespace-nowrap text-slate-400">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  {showUserColumn && (
                    <td>
                      {r.user_id ? (
                        <Link
                          href={`/admin/users/${r.user_id}`}
                          className="text-violet-300 hover:underline"
                        >
                          {r.user_display_name || r.user_email || truncateHash(r.user_id, 6)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
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
    </>
  );
}
