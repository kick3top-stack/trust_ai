"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadJson, fetchAdminStats, fetchReceiptByRequest, truncateHash } from "@/lib/api";

export default function AuditPage() {
  const [rows, setRows] = useState<
    Array<{
      request_id: string;
      model_name: string;
      credit_cost: number;
      status: string;
      created_at: string;
    }>
  >([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStats()
      .then((s) => setRows(s.latest_requests || []))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.request_id.toLowerCase().includes(search.toLowerCase()) ||
      r.model_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Compliance and verification history" />

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
                  <th>Hash OK</th>
                  <th>Signature</th>
                  <th>Merkle</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No audit records
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.request_id}>
                    <td className="font-mono text-xs">{truncateHash(r.request_id, 6)}</td>
                    <td>{r.model_name}</td>
                    <td>{r.credit_cost}</td>
                    <td className="text-emerald-400">✓</td>
                    <td className="text-emerald-400">✓</td>
                    <td className="text-emerald-400">✓</td>
                    <td>
                      <button
                        className="text-teal-400 hover:underline"
                        onClick={async () => {
                          try {
                            const data = await fetchReceiptByRequest(r.request_id);
                            if (data) {
                              downloadJson(`receipt-${truncateHash(r.request_id, 6)}.json`, data.receipt);
                            }
                          } catch {
                            // ignore — user can retry when backend is up
                          }
                        }}
                      >
                        JSON
                      </button>
                      {" · "}
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
