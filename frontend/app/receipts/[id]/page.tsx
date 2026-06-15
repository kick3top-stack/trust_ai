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
  downloadReceiptPackage,
  fetchReceiptById,
  fetchReceiptByRequest,
  truncateHash,
  verifyStoredReceipt,
  createDispute,
  type GenerationSummary,
  type ReceiptPackage,
  type VerifyResult,
} from "@/lib/api";
import { promptText, showError, showSuccess } from "@/lib/sweetAlert";

const TABS = [
  { id: "overview", label: "Summary" },
  { id: "proof", label: "Technical proof" },
  { id: "raw", label: "Raw data" },
];

function mergePackage(authoritative: ReceiptPackage, cached: ReceiptPackage | null): ReceiptPackage {
  if (!cached) return authoritative;
  const gen = authoritative.generation ?? cached.generation;
  return {
    ...authoritative,
    generation: gen,
    response: gen?.response_text ?? cached.response ?? authoritative.response,
  };
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [pkg, setPkg] = useState<ReceiptPackage | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [verifying, setVerifying] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        let cached: ReceiptPackage | null = null;
        const cachedRaw =
          sessionStorage.getItem(`receipt:${id}`) ||
          sessionStorage.getItem(`receipt:request:${id}`);
        if (cachedRaw) {
          try {
            cached = JSON.parse(cachedRaw) as ReceiptPackage;
          } catch {
            cached = null;
          }
        }

        let data = await fetchReceiptById(id);
        if (!data) data = await fetchReceiptByRequest(id);

        if (data?.receipt) {
          const merged = mergePackage(data as ReceiptPackage, cached);
          setPkg(merged);
          sessionStorage.setItem(`receipt:${id}`, JSON.stringify(merged));
          if (merged.receipt?.request_id) {
            sessionStorage.setItem(
              `receipt:request:${merged.receipt.request_id}`,
              JSON.stringify(merged),
            );
          }
        } else if (cached?.receipt) {
          setPkg(cached);
        } else {
          setError("Receipt not found");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load receipt");
      }
    }
    load();
  }, [id]);

  async function runVerify() {
    setVerifying(true);
    try {
      const result = await verifyStoredReceipt(id);
      setVerifyResult(result);
    } catch {
      setVerifyResult(null);
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (!pkg?.receipt) return;
    runVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.receipt_id, pkg?.receipt?.request_id]);

  const receipt = pkg?.receipt;
  const gen = pkg?.generation;
  const responseText = gen?.response_text || pkg?.response;
  const storedPrompt = gen?.prompt_text;
  const proof = pkg?.merkle_proof as {
    receipt_hash?: string;
    leaf_index?: number;
    merkle_root?: string;
    proof?: { hash: string; position: string }[];
  } | null;

  const trustLevel = verifyResult?.trust_level;
  const badge =
    verifyResult?.valid
      ? { text: "✓ Verified", className: "bg-emerald-500/20 text-emerald-400" }
      : trustLevel === "batch"
        ? { text: "✓ Charge recorded", className: "bg-amber-500/20 text-amber-400" }
        : verifyResult
          ? { text: "✗ Invalid", className: "bg-red-500/20 text-red-400" }
          : null;

  return (
    <div>
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
        {badge && (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
            {verifying ? "Checking…" : badge.text}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {disputeMsg && (
        <div className="mb-6 rounded-md border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
          {disputeMsg}
        </div>
      )}

      {receipt && (
        <>
          <div className="panel mb-6">
            <Tabs tabs={TABS} active={tab} onChange={setTab} />
            <div className="panel-body">
              {tab === "overview" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4 text-sm">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                        What you were charged
                      </p>
                      <p className="text-2xl font-semibold text-teal-400">
                        {String(receipt.credit_cost ?? gen?.credit_cost ?? "-")} credits
                      </p>
                      {(gen?.prompt_tokens != null || gen?.completion_tokens != null) && (
                        <p className="mt-1 text-slate-400">
                          {gen?.prompt_tokens ?? 0} prompt + {gen?.completion_tokens ?? 0} response
                          tokens
                        </p>
                      )}
                    </div>
                    <MetaRow label="Model" value={String(receipt.model_name || gen?.model_name || "-")} />
                    <MetaRow label="When" value={String(receipt.timestamp || gen?.created_at || "-")} />
                    <MetaRow label="Request ID" value={String(receipt.request_id || "-")} mono />
                    {verifyResult && (
                      <VerificationStatus
                        checks={verifyResult.checks}
                        valid={verifyResult.valid}
                        reason={verifyResult.reason}
                        userMessage={verifyResult.user_message}
                        trustLevel={verifyResult.trust_level}
                        compact
                      />
                    )}
                  </div>
                  <div className="space-y-4">
                    {storedPrompt && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Your prompt
                        </p>
                        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-slate-300">
                          {storedPrompt}
                        </p>
                      </div>
                    )}
                    {responseText && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Model response
                        </p>
                        <div className="max-h-80 overflow-y-auto pr-1">
                          <MarkdownContent>{responseText}</MarkdownContent>
                        </div>
                      </div>
                    )}
                    {!storedPrompt && !responseText && (
                      <p className="text-sm text-slate-500">
                        Prompt and response text are only stored for generations after this update.
                        Cryptographic hashes below still prove integrity.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tab === "proof" && (
                <div className="space-y-6">
                  <div className="grid gap-3 text-sm lg:grid-cols-2">
                    <MetaRow label="Receipt Hash" value={String(receipt.receipt_hash || "-")} mono />
                    <MetaRow label="Model Hash" value={truncateHash(String(receipt.model_hash), 16)} mono />
                    <MetaRow label="Prompt Hash" value={truncateHash(String(receipt.prompt_hash), 16)} mono />
                    <MetaRow label="Output Hash" value={truncateHash(String(receipt.response_hash), 16)} mono />
                    <MetaRow label="Seed" value={String(receipt.seed ?? "-")} />
                  </div>
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
                        Key: {String((pkg.root_signature as Record<string, unknown>).signing_key_id || "-")}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        Batch #{String((pkg.root_signature as Record<string, unknown>).batch_number ?? "-")}
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

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => downloadJson("receipt.json", pkg.receipt)}>
              Download JSON
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                const rid = pkg.receipt_id || id;
                downloadReceiptPackage(rid).catch((e) =>
                  showError("Download failed", e instanceof Error ? e.message : "Unknown error"),
                );
              }}
            >
              Download Package (.zip)
            </button>
            <button
              className="btn-secondary"
              onClick={async () => {
                const requestId = String(receipt.request_id || "");
                if (!requestId) return;
                const reason = await promptText({
                  title: "Report billing issue",
                  text: "Tell us what looks wrong with this charge. Support will review your request.",
                  inputValue: "I believe this charge is incorrect because…",
                  inputType: "textarea",
                  minLength: 10,
                  placeholder: "Describe the issue in at least 10 characters…",
                });
                if (!reason) return;
                try {
                  await createDispute(requestId, reason);
                  setDisputeMsg("Dispute submitted. Support will review your request.");
                  await showSuccess("Dispute submitted", "Support will review your request soon.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Dispute failed");
                }
              }}
            >
              Report billing issue
            </button>
            <button className="btn-secondary" onClick={runVerify} disabled={verifying}>
              {verifying ? "Verifying…" : "Verify Again"}
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
