"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { adjustUserCredits, fetchSupportDisputes, supportLookup, updateDispute, truncateHash, type Dispute, type SupportGeneration } from "@/lib/api";
import { promptNumber, promptText } from "@/lib/sweetAlert";

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved_refund: "Resolved (refund)",
  resolved_denied: "Resolved (denied)",
  closed: "Closed",
};

export default function AdminSupportPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [requestId, setRequestId] = useState("");
  const [generations, setGenerations] = useState<SupportGeneration[]>([]);
  const [targetBalance, setTargetBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchSupportDisputes()
      .then(setDisputes)
      .catch(() => {});
  }, [user]);

  async function runLookup() {
    if (!email.trim() && !requestId.trim()) {
      setError("Enter a user email or request ID");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await supportLookup({
        email: email.trim() || undefined,
        request_id: requestId.trim() || undefined,
      });
      setGenerations(data.generations);
      setTargetBalance(
        typeof data.user?.credit_balance === "number" ? data.user.credit_balance : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function refundCredits(gen: SupportGeneration) {
    if (!token || !gen.user_id) return;
    const amount = await promptNumber({
      title: "Refund credits",
      text: `How many credits should be added for ${gen.user_email || "this user"}?`,
      inputValue: gen.credit_cost,
    });
    if (amount === null) return;
    const reason = await promptText({
      title: "Refund reason",
      text: "This note appears in the user's billing statement.",
      inputValue: `Refund for request ${gen.request_id.slice(0, 8)}`,
      required: true,
    });
    if (!reason) return;
    setBusy(true);
    try {
      await adjustUserCredits(token, gen.user_id, amount, reason);
      await runLookup();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveDispute(d: Dispute, status: string) {
    const note = await promptText({
      title: "Resolution note",
      text: "Optional message for the user about this dispute.",
      inputValue: d.resolution_note || "",
      required: false,
      inputType: "textarea",
      confirmText: "Save",
    });
    if (note === null) return;
    setBusy(true);
    try {
      const updated = await updateDispute(d.id, status, note || undefined);
      setDisputes((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || user.role !== "admin") return null;

  return (
    <div>
      <PageHeader
        title="Support Console"
        subtitle="Look up generations, review charges, and issue credit adjustments"
      />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel mb-6">
        <div className="panel-header">Lookup</div>
        <div className="panel-body flex flex-wrap gap-4">
          <input
            className="input-field min-w-[220px] flex-1"
            placeholder="User email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input-field min-w-[220px] flex-1 font-mono text-sm"
            placeholder="Request ID (optional)"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
          />
          <button className="btn-primary" onClick={runLookup} disabled={busy}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>
        {targetBalance != null && (
          <p className="border-t border-slate-800 px-5 py-3 text-sm text-slate-400">
            User balance: <span className="font-mono text-teal-400">{targetBalance}</span> credits
          </p>
        )}
      </div>

      <div className="panel mb-6">
        <div className="panel-header">Open disputes ({disputes.filter((d) => d.status === "open" || d.status === "investigating").length})</div>
        <div className="panel-body space-y-3">
          {disputes.length === 0 && (
            <p className="text-sm text-slate-500">No disputes filed yet.</p>
          )}
          {disputes.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">
                    {d.user_email || "User"} ·{" "}
                    <span className="text-teal-400">{d.credit_cost} credits</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{d.request_id}</p>
                  <p className="mt-2 text-slate-300">{d.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {DISPUTE_STATUS_LABELS[d.status] || d.status} ·{" "}
                    {new Date(d.created_at).toLocaleString()}
                  </p>
                  {d.resolution_note && (
                    <p className="mt-1 text-xs text-slate-400">Note: {d.resolution_note}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/receipts/${d.request_id}`} className="btn-secondary py-1 text-xs">
                    Receipt
                  </Link>
                  {(d.status === "open" || d.status === "investigating") && (
                    <>
                      <button
                        className="btn-secondary py-1 text-xs"
                        disabled={busy}
                        onClick={() => resolveDispute(d, "investigating")}
                      >
                        Investigate
                      </button>
                      <button
                        className="btn-secondary py-1 text-xs"
                        disabled={busy}
                        onClick={() => resolveDispute(d, "resolved_refund")}
                      >
                        Resolve + refund
                      </button>
                      <button
                        className="btn-secondary py-1 text-xs"
                        disabled={busy}
                        onClick={() => resolveDispute(d, "resolved_denied")}
                      >
                        Deny
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Generations ({generations.length})</div>
        <div className="panel-body space-y-4">
          {generations.length === 0 && (
            <p className="text-sm text-slate-500">No results. Search by email or request ID.</p>
          )}
          {generations.map((g) => (
            <div key={g.request_id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium text-white">
                    {g.user_display_name || "Unknown user"}
                    {g.user_email && (
                      <span className="ml-2 text-slate-500">{g.user_email}</span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{g.request_id}</p>
                  <p className="mt-1 text-slate-400">
                    {new Date(g.created_at).toLocaleString()} · {g.model_name} ·{" "}
                    <span className="text-teal-400">{g.credit_cost} credits</span>
                    {" · "}
                    {g.prompt_tokens + g.completion_tokens} tokens
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary py-1 text-xs"
                    onClick={() => setExpanded(expanded === g.request_id ? null : g.request_id)}
                  >
                    {expanded === g.request_id ? "Hide" : "Details"}
                  </button>
                  <Link href={`/receipts/${g.request_id}`} className="btn-secondary py-1 text-xs">
                    Receipt
                  </Link>
                  {g.user_id && (
                    <button
                      className="btn-secondary py-1 text-xs"
                      disabled={busy}
                      onClick={() => refundCredits(g)}
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
              {expanded === g.request_id && (
                <div className="mt-4 grid gap-4 border-t border-slate-800 pt-4 text-sm lg:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs uppercase text-slate-500">Prompt</p>
                    <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-slate-300">
                      {g.prompt_text || "(not stored for older requests)"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs uppercase text-slate-500">Response</p>
                    <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-slate-300">
                      {g.response_text || "(not stored for older requests)"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
