"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { VerificationStatus } from "@/components/VerificationStatus";
import { FileDropZone } from "@/components/FileDropZone";
import { parseVerifyFiles } from "@/lib/parseVerifyPackage";
import { fetchReceiptByRequest, verifyReceipt, type VerifyResult } from "@/lib/api";

export default function VerifyPage() {
  const [jsonText, setJsonText] = useState(
    '{\n  "request_id": "",\n  "receipt_hash": "",\n  "model_hash": "",\n  "prompt_hash": "",\n  "credit_cost": 0\n}',
  );
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileHint, setFileHint] = useState<string | null>(null);

  async function runVerify(
    receipt: Record<string, unknown>,
    proof: Record<string, unknown> | null,
    signature: Record<string, unknown> | null,
  ) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let merkleProof = proof;
      let rootSignature = signature;
      const requestId = String(receipt.request_id || "");

      if ((!merkleProof || !rootSignature) && requestId) {
        const pkg = await fetchReceiptByRequest(requestId);
        if (pkg) {
          merkleProof = pkg.merkle_proof as Record<string, unknown>;
          rootSignature = pkg.root_signature as Record<string, unknown>;
        }
      }

      if (!merkleProof || !rootSignature) {
        throw new Error("Include merkle_proof and root_signature in the package or a valid request_id");
      }

      const verifyResult = await verifyReceipt(receipt, merkleProof, rootSignature);
      setResult(verifyResult);
      setJsonText(JSON.stringify(receipt, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const receipt = JSON.parse(jsonText) as Record<string, unknown>;
    await runVerify(receipt, null, null);
  }

  async function handleFiles(files: FileList) {
    setError(null);
    setFileHint(null);
    try {
      const pkg = await parseVerifyFiles(files);
      setFileHint(`Loaded package (${files.length} file${files.length > 1 ? "s" : ""})`);
      await runVerify(pkg.receipt, pkg.merkle_proof, pkg.root_signature);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse files");
    }
  }

  return (
    <div>
      <PageHeader title="Verification" subtitle="Independently verify receipt integrity" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header">Upload Package</div>
            <div className="panel-body">
              <FileDropZone onFiles={handleFiles} disabled={loading} />
              {fileHint && <p className="mt-3 text-xs text-emerald-400">{fileHint}</p>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Or Paste Receipt JSON</div>
            <div className="panel-body space-y-4">
              <textarea
                className="input-field min-h-[200px] resize-y font-mono text-xs"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
              />
              {error && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              <button className="btn-primary w-full" onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying..." : "Verify Receipt"}
              </button>
            </div>
          </div>
        </div>

        <div>
          {result ? (
            <VerificationStatus
              checks={result.checks}
              valid={result.valid}
              reason={result.reason}
              userMessage={result.user_message}
              trustLevel={result.trust_level}
            />
          ) : (
            <div className="panel">
              <div className="panel-header">Result</div>
              <div className="panel-body space-y-2 text-sm text-slate-500">
                <p>Drop a receipt ZIP or JSON files to verify offline-style packages.</p>
                <p>
                  Or paste receipt JSON with a <code className="text-slate-400">request_id</code> to
                  fetch proof and signature from your account.
                </p>
                <Link href="/merkle" className="text-teal-400 hover:underline">
                  Browse sealed batches →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
