"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GenerationStatusBadge, IntegrityBadge } from "@/components/ui/IntegrityBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadJson, fetchAdminStats, fetchReceiptByRequest, truncateHash, type ReceiptListItem } from "@/lib/api";

export default function AuditPage() {
  const [rows, setRows] = useState<ReceiptListItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats()
      .then((s) => setRows(s.latest_requests || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.request_id.toLowerCase().includes(search.toLowerCase()) ||
      r.model_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Generation history with automatic integrity checks" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-body space-y-4">
          <div className="flex flex-wrap gap-4">
            <input
              className="input-field max-w-md"
              placeholder="Search receipt or model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Model</th>
                  <th>Credits</th>
                  <th>Integrity</th>
                  <th>Generation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Checking integrity…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No audit records
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.request_id}
                    className={
                      r.integrity_status === "failed" || r.integrity_status === "batch"
                        ? "bg-red-500/5"
                        : undefined
                    }
                  >
                    <td className="font-mono text-xs">{truncateHash(r.request_id, 6)}</td>
                    <td>{r.model_name}</td>
                    <td>{r.credit_cost}</td>
                    <td>
                      <IntegrityBadge status={r.integrity_status} compact />
                    </td>
                    <td>
                      <GenerationStatusBadge status={r.status} />
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      <button
                        className="text-teal-400 hover:underline"
                        onClick={async () => {
                          try {
                            const data = await fetchReceiptByRequest(r.request_id);
                            if (data?.receipt) {
                              downloadJson(
                                `receipt-${truncateHash(r.request_id, 6)}.json`,
                                data.receipt,
                              );
                            }
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        JSON
                      </button>
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
    </div>
  );
}
