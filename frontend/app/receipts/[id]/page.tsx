"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MerkleProofViz } from "@/components/MerkleProofViz";
import { MarkdownContent } from "@/components/MarkdownContent";
import { VerificationStatus } from "@/components/VerificationStatus";
import { Tabs } from "@/components/ui/Tabs";
import {
  downloadJson,
  fetchReceiptById,
  fetchReceiptByRequest,
  truncateHash,
  verifyReceipt,
  type VerifyResult,
} from "@/lib/api";

interface PackageData {
  receipt: Record<string, unknown>;
  merkle_proof: Record<string, unknown> | null;
  root_signature: Record<string, unknown> | null;
  response?: string;
  receipt_id?: string;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "proof", label: "Proof" },
  { id: "raw", label: "Raw Data" },
];

export default function ReceiptDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [pkg, setPkg] = useState<PackageData | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    async function load() {
      try {
        const cached =
          sessionStorage.getItem(`receipt:${id}`) ||
          sessionStorage.getItem(`receipt:request:${id}`);
        if (cached) {
          setPkg(JSON.parse(cached));
          return;
        }
        let data = await fetchReceiptById(id);
        if (!data) data = await fetchReceiptByRequest(id);
        if (data) {
          setPkg(data);
          sessionStorage.setItem(`receipt:${id}`, JSON.stringify(data));
        } else {
          setError("Receipt not found");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load receipt");
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!pkg?.receipt || !pkg.merkle_proof || !pkg.root_signature) return;
    verifyReceipt(pkg.receipt, pkg.merkle_proof, pkg.root_signature)
      .then(setVerifyResult)
      .catch(() => {});
  }, [pkg]);

  const receipt = pkg?.receipt;
  const proof = pkg?.merkle_proof as {
    receipt_hash?: string;
    leaf_index?: number;
    merkle_root?: string;
    proof?: { hash: string; position: string }[];
  } | null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Receipt Detail</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {receipt ? truncateHash(String(receipt.receipt_hash), 16) : id}
          </p>
          {receipt?.timestamp != null && (
            <p className="mt-0.5 text-xs text-slate-600">{String(receipt.timestamp)}</p>
          )}
        </div>
        {verifyResult && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              verifyResult.valid
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {verifyResult.valid ? "✓ Verified" : "✗ Invalid"}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {receipt && (
        <>
          <div className="panel mb-6">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            <div className="panel-body">
              {tab === "overview" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <MetaRow label="Receipt Hash" value={String(receipt.receipt_hash || "—")} mono />
                    <MetaRow label="Request ID" value={String(receipt.request_id || "—")} mono />
                    <MetaRow label="Model" value={String(receipt.model_name || "—")} />
                    <MetaRow label="Model Version" value={String(receipt.model_version || "—")} />
                    <MetaRow label="Model Hash" value={truncateHash(String(receipt.model_hash), 16)} mono />
                    <MetaRow label="Prompt Hash" value={truncateHash(String(receipt.prompt_hash), 16)} mono />
                    <MetaRow label="Output Hash" value={truncateHash(String(receipt.response_hash), 16)} mono />
                    <MetaRow label="Credits" value={String(receipt.credit_cost ?? "—")} />
                    <MetaRow label="Seed" value={String(receipt.seed ?? "—")} />
                  </div>
                  <div className="space-y-4">
                    {verifyResult && (
                      <VerificationStatus
                        checks={verifyResult.checks}
                        valid={verifyResult.valid}
                        reason={verifyResult.reason}
                        compact
                      />
                    )}
                    {pkg?.response && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Model Response
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          <MarkdownContent>{pkg.response}</MarkdownContent>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "proof" && (
                <div className="space-y-6">
                  <div>
                    <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Merkle Inclusion Proof
                    </p>
                    {proof?.receipt_hash && proof.merkle_root && proof.proof ? (
                      <MerkleProofViz
                        receiptHash={proof.receipt_hash}
                        proof={proof.proof}
                        merkleRoot={proof.merkle_root}
                        leafIndex={proof.leaf_index}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">Proof not available for this receipt.</p>
                    )}
                  </div>
                  {pkg?.root_signature && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
                      <p className="mb-2 text-xs font-medium uppercase text-slate-500">Ed25519 Signature</p>
                      <p className="font-mono text-xs text-slate-400">
                        Key: {String((pkg.root_signature as Record<string, unknown>).signing_key_id || "—")}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        Batch #{String((pkg.root_signature as Record<string, unknown>).batch_number ?? "—")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {tab === "raw" && (
                <pre className="max-h-[480px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-400">
                  {JSON.stringify(
                    {
                      receipt: pkg.receipt,
                      merkle_proof: pkg.merkle_proof,
                      root_signature: pkg.root_signature,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => downloadJson("receipt.json", pkg.receipt)}>
              Download JSON
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                if (pkg.merkle_proof && pkg.root_signature) {
                  verifyReceipt(pkg.receipt, pkg.merkle_proof, pkg.root_signature).then(setVerifyResult);
                }
              }}
            >
              Verify Again
            </button>
            <Link href="/verify" className="btn-secondary">
              Share
            </Link>
            <Link href="/playground" className="btn-primary">
              New Generation
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-800/50 py-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={`max-w-[60%] truncate text-right ${mono ? "font-mono text-xs text-slate-300" : "text-slate-200"}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
