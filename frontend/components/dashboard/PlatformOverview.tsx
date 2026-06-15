"use client";

import Link from "next/link";
import { IntegrityBadge } from "@/components/ui/IntegrityBadge";
import { StatCard } from "@/components/ui/StatCard";
import { truncateHash, type AdminStats } from "@/lib/api";
import { ChartsAndActivity } from "./PersonalDashboard";

type Props = {
  stats: AdminStats | null;
  error: string | null;
};

export function PlatformOverview({ stats, error }: Props) {
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

      <div className="mb-6 rounded-md border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
        <span className="font-semibold text-violet-300">Platform overview</span> · Aggregated
        metrics across every registered user. This is not your personal dashboard. For your own
        activity, open <Link href="/dashboard" className="text-violet-200 underline">Dashboard</Link>.
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={stats?.total_users ?? "-"} highlight />
        <StatCard label="Active users" value={stats?.active_users ?? "-"} />
        <StatCard label="Total generations" value={stats?.total_generations ?? "-"} />
        <StatCard label="Platform credits (7d)" value={stats ? creditsSpent7d : "-"} />
        <StatCard label="Signed batches" value={stats?.signed_batch_count ?? "-"} />
        <StatCard label="Open batch receipts" value={stats?.open_batch_receipt_count ?? 0} />
        <StatCard label="Verification rate" value={integrity} />
        <StatCard
          label="Your balance (admin)"
          value={stats?.viewer_credit_balance ?? "-"}
        />
      </div>

      {stats?.current_merkle_root && (
        <div className="panel mb-8">
          <div className="panel-header">Current Merkle root</div>
          <div className="panel-body font-mono text-xs text-slate-400">
            {stats.current_merkle_root}
            {stats.last_signature_at && (
              <span className="mt-2 block text-slate-500">
                Last sealed: {new Date(stats.last_signature_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      <ChartsAndActivity stats={stats} creditsSpent7d={creditsSpent7d} showUserColumn />

      {stats?.recent_batches && stats.recent_batches.length > 0 && (
        <div className="panel mt-8">
          <div className="panel-header">Recent batches</div>
          <div className="panel-body overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  <th>Receipts</th>
                  <th>Root</th>
                  <th>Integrity</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_batches.slice(0, 8).map((b) => (
                  <tr key={b.batch_id}>
                    <td>{b.batch_number}</td>
                    <td>{b.status}</td>
                    <td>{b.receipt_count}</td>
                    <td className="font-mono text-xs">
                      {b.merkle_root ? truncateHash(b.merkle_root, 8) : "-"}
                    </td>
                    <td>
                      <IntegrityBadge status={b.integrity_status} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
