"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchAdminStats, truncateHash } from "@/lib/api";

export default function ReceiptsPage() {
  const [requests, setRequests] = useState<
    Array<{
      request_id: string;
      created_at: string;
      model_name: string;
      credit_cost: number;
      status: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStats()
      .then((s) => setRequests(s.latest_requests || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader title="Receipts" subtitle="Browse issued execution receipts" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <span>All Receipts</span>
          <Link href="/playground" className="btn-primary py-1 text-xs normal-case">
            + Generate
          </Link>
        </div>
        <div className="panel-body overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Model</th>
                <th>Credits</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No receipts yet
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.request_id}>
                  <td className="font-mono text-xs">{truncateHash(r.request_id, 8)}</td>
                  <td>{r.model_name}</td>
                  <td>{r.credit_cost}</td>
                  <td className="text-emerald-400">{r.status === "completed" ? "✓" : r.status}</td>
                  <td className="text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    <Link href={`/receipts/${r.request_id}`} className="text-teal-400 hover:underline">
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
