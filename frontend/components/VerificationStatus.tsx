"use client";

import clsx from "clsx";
import type { VerificationChecks } from "@/lib/api";

const CHECK_LABELS: Record<keyof VerificationChecks, string> = {
  receipt_hash_valid: "Receipt matches its fingerprint",
  merkle_proof_valid: "Recorded in signed batch",
  signature_valid: "Batch signature valid",
  credit_recorded: "Credit charge recorded",
  model_verified: "Model details recorded",
};

export function VerificationStatus({
  checks,
  valid,
  reason,
  userMessage,
  trustLevel,
  compact = false,
}: {
  checks: VerificationChecks;
  valid: boolean;
  reason?: string | null;
  userMessage?: string | null;
  trustLevel?: "full" | "batch" | "failed";
  compact?: boolean;
}) {
  const batchTrusted = trustLevel === "batch";
  const displayMessage = userMessage || reason;
  const statusLabel = valid ? "VERIFIED" : batchTrusted ? "BATCH VERIFIED" : "FAILED";
  const statusClass = valid
    ? "bg-emerald-500/20 text-emerald-400"
    : batchTrusted
      ? "bg-amber-500/20 text-amber-400"
      : "bg-red-500/20 text-red-400";

  return (
    <div
      className={clsx(
        compact
          ? "rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          : "panel",
      )}
    >
      {!compact && (
        <div className="panel-header flex items-center justify-between">
          <span>Verification Result</span>
          <span className={clsx("rounded px-2 py-0.5 text-xs font-medium normal-case", statusClass)}>
            {statusLabel}
          </span>
        </div>
      )}
      <div className={clsx(compact ? "" : "panel-body")}>
        {valid && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            This receipt is valid. Your charge is recorded and the batch signature checks out.
          </div>
        )}
        {batchTrusted && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Your charge is recorded in the signed batch. The receipt copy shown here did not pass
            every integrity check. Support can confirm using your request ID.
          </div>
        )}
        <ul className="space-y-2">
          {(Object.keys(CHECK_LABELS) as Array<keyof VerificationChecks>).map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className={checks[key] ? "text-emerald-400" : "text-red-400"}>
                {checks[key] ? "✓" : "✗"}
              </span>
              <span className="text-slate-300">{CHECK_LABELS[key]}</span>
            </li>
          ))}
        </ul>
        {displayMessage && !valid && (
          <p
            className={clsx(
              "mt-4 rounded-md px-4 py-3 text-sm",
              batchTrusted ? "bg-amber-500/10 text-amber-200" : "bg-red-500/10 text-red-300",
            )}
          >
            {displayMessage}
          </p>
        )}
        {!valid && reason && reason !== displayMessage && (
          <p className="mt-2 font-mono text-xs text-slate-500">{reason}</p>
        )}
      </div>
    </div>
  );
}
