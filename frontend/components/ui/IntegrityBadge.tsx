import clsx from "clsx";

export type ReceiptIntegrityStatus = "full" | "batch" | "failed" | "pending" | "none";
export type BatchIntegrityStatus = "verified" | "altered" | "pending" | "empty";

const RECEIPT_LABELS: Record<ReceiptIntegrityStatus, string> = {
  full: "Verified",
  batch: "Altered",
  failed: "Invalid",
  pending: "Pending",
  none: "No receipt",
};

const BATCH_LABELS: Record<BatchIntegrityStatus, string> = {
  verified: "Verified",
  altered: "Altered",
  pending: "Pending",
  empty: "Empty",
};

const RECEIPT_STYLES: Record<ReceiptIntegrityStatus, string> = {
  full: "bg-emerald-500/20 text-emerald-400",
  batch: "bg-amber-500/20 text-amber-300",
  failed: "bg-red-500/20 text-red-400",
  pending: "bg-slate-700/50 text-slate-400",
  none: "bg-slate-700/50 text-slate-500",
};

const BATCH_STYLES: Record<BatchIntegrityStatus, string> = {
  verified: "bg-emerald-500/20 text-emerald-400",
  altered: "bg-red-500/20 text-red-400",
  pending: "bg-amber-500/20 text-amber-300",
  empty: "bg-slate-700/50 text-slate-500",
};

export function IntegrityBadge({
  status,
  variant = "receipt",
  compact = false,
}: {
  status: string | null | undefined;
  variant?: "receipt" | "batch";
  compact?: boolean;
}) {
  if (variant === "batch") {
    const key = (status as BatchIntegrityStatus) || "pending";
    const label = BATCH_LABELS[key] ?? status ?? "—";
    const style = BATCH_STYLES[key] ?? BATCH_STYLES.pending;
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-full font-medium",
          compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs",
          style,
        )}
        title={`Batch integrity: ${label}`}
      >
        {label}
      </span>
    );
  }

  const key = (status as ReceiptIntegrityStatus) || "pending";
  const label = RECEIPT_LABELS[key] ?? status ?? "—";
  const style = RECEIPT_STYLES[key] ?? RECEIPT_STYLES.pending;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium",
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-xs",
        style,
      )}
      title={`Integrity: ${label}`}
    >
      {label}
    </span>
  );
}

export function GenerationStatusBadge({ status }: { status: string }) {
  const done = status === "completed";
  return (
    <span
      className={clsx(
        "text-xs",
        done ? "text-slate-400" : "text-amber-400",
      )}
      title="Generation job status"
    >
      {done ? "Done" : status}
    </span>
  );
}
