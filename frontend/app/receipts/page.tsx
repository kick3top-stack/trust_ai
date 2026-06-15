"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GenerationStatusBadge, IntegrityBadge } from "@/components/ui/IntegrityBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchReceiptsList, truncateHash, type ReceiptListItem } from "@/lib/api";

export default function ReceiptsPage() {
  const [requests, setRequests] = useState<ReceiptListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceiptsList(50)
      .then(setRequests)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const alteredCount = requests.filter(
    (r) => r.integrity_status === "failed" || r.integrity_status === "batch",
  ).length;

  return (
    <div>
      <PageHeader title="Receipts" subtitle="Browse issued execution receipts" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {alteredCount > 0 && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {alteredCount} receipt{alteredCount === 1 ? "" : "s"} show integrity problems — data may
          have been altered.
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
                <th>Integrity</th>
                <th>Generation</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No receipts yet
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Checking integrity…
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr
                  key={r.request_id}
                  className={
                    r.integrity_status === "failed" || r.integrity_status === "batch"
                      ? "bg-red-500/5"
                      : undefined
                  }
                >
                  <td className="font-mono text-xs">{truncateHash(r.request_id, 8)}</td>
                  <td>{r.model_name}</td>
                  <td>{r.credit_cost}</td>
                  <td>
                    <IntegrityBadge status={r.integrity_status} />
                  </td>
                  <td>
                    <GenerationStatusBadge status={r.status} />
                  </td>
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
