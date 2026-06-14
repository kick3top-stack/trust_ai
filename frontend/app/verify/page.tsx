"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VerificationStatus } from "@/components/VerificationStatus";
import { fetchReceiptByRequest, verifyReceipt, type VerifyResult } from "@/lib/api";

export default function VerifyPage() {
  const [jsonText, setJsonText] = useState(
    '{\n  "request_id": "",\n  "receipt_hash": "",\n  "model_hash": "",\n  "prompt_hash": "",\n  "credit_cost": 0\n}',
  );
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const receipt = JSON.parse(jsonText) as Record<string, unknown>;
      const requestId = String(receipt.request_id || "");

      let proof: Record<string, unknown> | null = null;
      let signature: Record<string, unknown> | null = null;

      if (requestId) {
        const pkg = await fetchReceiptByRequest(requestId);
        if (pkg) {
          proof = pkg.merkle_proof;
          signature = pkg.root_signature;
        }
      }

      if (!proof || !signature) {
        throw new Error(
          "Include a valid request_id to auto-fetch proof/signature, or paste a full package JSON.",
        );
      }

      const verifyResult = await verifyReceipt(receipt, proof, signature);
      setResult(verifyResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Verification" subtitle="Independently verify receipt integrity" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header">Paste Receipt JSON</div>
          <div className="panel-body space-y-4">
            <textarea
              className="input-field min-h-[280px] resize-y font-mono text-xs"
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

        <div>
          {result ? (
            <VerificationStatus
              checks={result.checks}
              valid={result.valid}
              reason={result.reason}
            />
          ) : (
            <div className="panel">
              <div className="panel-header">Result</div>
              <div className="panel-body text-sm text-slate-500">
                Paste a receipt JSON with a valid <code className="text-slate-400">request_id</code>{" "}
                to verify against stored proof and signature.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
