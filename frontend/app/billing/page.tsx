"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchCreditStatement, truncateHash, type CreditTransaction } from "@/lib/api";
import { fetchBillingConfig, formatCreditRule, type BillingConfig } from "@/lib/credits";

function txnLabel(txn: CreditTransaction): string {
  if (txn.txn_type === "generation") return "Generation charge";
  if (txn.txn_type === "initial_grant") return "Welcome credits";
  if (txn.txn_type === "admin_adjustment") return txn.description || "Admin adjustment";
  return txn.description;
}

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshUser().catch(() => {});
    fetchBillingConfig().then(setBillingConfig).catch(() => {});
    fetchCreditStatement()
      .then((s) => setTransactions(s.transactions))
      .catch((e) => setError(e.message));
  }, [refreshUser]);

  const balance = user?.credit_balance ?? 0;
  const totalSpent = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div>
      <PageHeader title="Billing" subtitle="Your credit balance and activity" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="stat-card">
          <span className="text-xs uppercase tracking-wider text-slate-500">Credit Balance</span>
          <span className="text-3xl font-semibold text-teal-400">{balance}</span>
        </div>
        <div className="stat-card">
          <span className="text-xs uppercase tracking-wider text-slate-500">Charges (shown below)</span>
          <span className="text-3xl font-semibold text-white">{totalSpent}</span>
          <span className="text-xs text-slate-500">credits deducted in statement</span>
        </div>
      </div>

      <div className="panel mb-8">
        <div className="panel-header">Credit statement</div>
        <div className="panel-body overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Change</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No transactions yet. Generate in the Playground to see charges here.
                  </td>
                </tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap text-slate-400">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td>{txnLabel(t)}</td>
                  <td className={t.amount < 0 ? "text-red-400" : "text-emerald-400"}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                  <td className="font-mono text-slate-300">{t.balance_after}</td>
                  <td>
                    {t.request_id && (
                      <Link href={`/receipts/${t.request_id}`} className="text-teal-400 hover:underline">
                        Receipt
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">How credits work</div>
        <div className="panel-body space-y-3 text-sm text-slate-400">
          <p>
            Each generation costs credits based on how many tokens were used (prompt + response).
            The charge is <strong className="text-slate-300">at least 1 credit</strong>, then{" "}
            {billingConfig ? (
              <strong className="text-slate-300">{formatCreditRule(billingConfig)}</strong>
            ) : (
              <>
                roughly 1 credit per 100 tokens (rounded up)
              </>
            )}
            .
          </p>
          <p>
            You see the exact charge immediately after each generation. Every charge appears in your
            statement above with a link to the receipt.
          </p>
          <p>
            Think something is wrong? Open the receipt for that request or contact support with your
            request ID ({truncateHash("example-request-id", 6)}…).
          </p>
          <div className="flex gap-3 pt-2">
            <Link href="/playground" className="btn-primary">
              Generate
            </Link>
            <Link href="/receipts" className="btn-secondary">
              View receipts
            </Link>
          </div>
        </div>
      </div>

      {balance < 50 && (
        <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Low balance — you have {balance} credits remaining.
        </div>
      )}
    </div>
  );
}
