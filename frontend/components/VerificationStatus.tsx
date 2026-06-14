"use client";

import clsx from "clsx";
import type { VerificationChecks } from "@/lib/api";

const CHECK_LABELS: Record<keyof VerificationChecks, string> = {
  receipt_hash_valid: "Receipt untampered",
  merkle_proof_valid: "Merkle inclusion valid",
  signature_valid: "Signature valid",
  credit_recorded: "Billing rule matched",
  model_verified: "Model metadata verified",
};

export function VerificationStatus({
  checks,
  valid,
  reason,
  compact = false,
}: {
  checks: VerificationChecks;
  valid: boolean;
  reason?: string | null;
  compact?: boolean;
}) {
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
          <span
            className={clsx(
              "rounded px-2 py-0.5 text-xs font-medium normal-case",
              valid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400",
            )}
          >
            {valid ? "VERIFIED" : "FAILED"}
          </span>
        </div>
      )}
      <div className={clsx(compact ? "" : "panel-body")}>
        {valid && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            ✓ Receipt Verified Successfully
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
        {reason && !valid && (
          <p className="mt-4 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-300">{reason}</p>
        )}
      </div>
    </div>
  );
}
