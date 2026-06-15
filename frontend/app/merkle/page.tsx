"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntegrityBadge } from "@/components/ui/IntegrityBadge";
import { fetchBatch, loadBatchList, truncateHash, type BatchSummary } from "@/lib/api";

export default function MerkleExplorerPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staleBackend, setStaleBackend] = useState(false);

  useEffect(() => {
    loadBatchList()
      .then((r) => {
        setBatches(r.batches);
        setStaleBackend(!!r.staleBackend);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetchBatch(selectedId)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selectedId]);

  const current = batches.find((b) => b.status === "open");
  const alteredBatches = batches.filter((b) => b.integrity_status === "altered").length;

  return (
    <div>
      <PageHeader
        title="Merkle Explorer"
        subtitle="Browse batch trees and sealed roots"
      />

      {staleBackend && (
        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Showing limited batch data. For full history, stop the app (Ctrl+C), run{" "}
          <code className="text-amber-100">npm run free-port</code>, then{" "}
          <code className="text-amber-100">npm run dev</code>.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {alteredBatches > 0 && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {alteredBatches} batch{alteredBatches === 1 ? "" : "es"} contain altered or invalid
          receipts — Merkle integrity check failed.
        </div>
      )}

      {current && (
        <div className="panel mb-6">
          <div className="panel-header">Open Batch</div>
          <div className="panel-body grid gap-2 text-sm sm:grid-cols-4">
            <Stat label="Batch #" value={String(current.batch_number)} />
            <Stat label="Receipts" value={String(current.receipt_count)} />
            <Stat label="Status" value={current.status} />
            <Stat
              label="Root"
              value={current.merkle_root ? truncateHash(current.merkle_root, 8) : "pending"}
              mono
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header">Batch History</div>
          <div className="panel-body overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Seal</th>
                  <th>Integrity</th>
                  <th>Receipts</th>
                  <th>Root</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No batches yet
                    </td>
                  </tr>
                )}
                {batches.map((b) => (
                  <tr
                    key={b.batch_id}
                    className={b.integrity_status === "altered" ? "bg-red-500/5" : undefined}
                  >
                    <td>{b.batch_number}</td>
                    <td>
                      <span
                        className={
                          b.status === "signed" ? "text-slate-400" : "text-amber-400"
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <IntegrityBadge status={b.integrity_status} variant="batch" compact />
                    </td>
                    <td>{b.receipt_count}</td>
                    <td className="font-mono text-xs">
                      {b.merkle_root ? truncateHash(b.merkle_root, 6) : "—"}
                    </td>
                    <td>
                      <button
                        className="text-xs text-teal-400 hover:underline"
                        onClick={() => setSelectedId(b.batch_id)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Batch Detail</div>
          <div className="panel-body">
            {!detail ? (
              <p className="text-sm text-slate-500">Select a batch to inspect signature and root.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <Stat label="Batch ID" value={String(detail.batch_id)} mono />
                <Stat label="Number" value={String(detail.batch_number)} />
                <Stat label="Seal status" value={String(detail.status)} />
                {detail.integrity_status != null && (
                  <div>
                    <p className="text-xs text-slate-500">Integrity</p>
                    <div className="mt-1">
                      <IntegrityBadge
                        status={String(detail.integrity_status)}
                        variant="batch"
                      />
                    </div>
                  </div>
                )}
                <Stat label="Receipt count" value={String(detail.receipt_count)} />
                <Stat
                  label="Merkle root"
                  value={detail.merkle_root ? String(detail.merkle_root) : "—"}
                  mono
                />
                {detail.sealed_at != null && (
                  <Stat label="Sealed at" value={String(detail.sealed_at)} />
                )}
                {detail.root_signature != null && (
                  <pre className="max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-400">
                    {JSON.stringify(detail.root_signature, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Each sealed batch root is signed with Ed25519. Receipt proofs link leaves to these roots.{" "}
        <Link href="/verify" className="text-teal-400 hover:underline">
          Verify a receipt
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 ${mono ? "break-all font-mono text-xs text-slate-300" : "text-slate-200"}`}>
        {value}
      </p>
    </div>
  );
}
