"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { adminUpdateUser, fetchUsers, type AuthUser } from "@/lib/auth";
import { adjustUserCredits } from "@/lib/api";
import { promptNumber, promptText } from "@/lib/sweetAlert";

export default function AdminUsersPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    fetchUsers(token)
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, [token, user]);

  async function toggleActive(target: AuthUser) {
    if (!token) return;
    setBusyId(target.id);
    try {
      const updated = await adminUpdateUser(token, target.id, { is_active: !target.is_active });
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRole(target: AuthUser) {
    if (!token) return;
    setBusyId(target.id);
    try {
      const nextRole = target.role === "admin" ? "user" : "admin";
      const updated = await adminUpdateUser(token, target.id, { role: nextRole });
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function addCredits(target: AuthUser) {
    if (!token) return;
    const amount = await promptNumber({
      title: "Adjust credits",
      text: `Change balance for ${target.email}. Use a negative number to deduct.`,
      inputValue: 100,
      allowNegative: true,
      allowZero: false,
    });
    if (amount === null) return;
    const reason = await promptText({
      title: "Adjustment reason",
      text: "This note appears in the user's billing statement.",
      inputValue: "Support credit adjustment",
      required: true,
    });
    if (!reason) return;
    setBusyId(target.id);
    try {
      await adjustUserCredits(token, target.id, amount, reason);
      const users = await fetchUsers(token);
      setUsers(users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user || user.role !== "admin") return null;

  return (
    <div>
      <PageHeader title="User Management" subtitle="Admin — manage accounts and roles" />

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">Users ({users.length})</div>
        <div className="panel-body overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Credits</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name}</td>
                  <td className="text-slate-400">{u.email}</td>
                  <td>
                    <span className={u.role === "admin" ? "text-violet-400" : "text-slate-300"}>
                      {u.role}
                    </span>
                  </td>
                  <td className="font-mono text-teal-400">{u.credit_balance ?? "—"}</td>
                  <td>
                    <span className={u.is_active ? "text-emerald-400" : "text-red-400"}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button
                      className="btn-secondary py-1 text-xs"
                      disabled={busyId === u.id}
                      onClick={() => addCredits(u)}
                    >
                      Adjust credits
                    </button>
                    <button
                      className="btn-secondary py-1 text-xs"
                      disabled={busyId === u.id || u.id === user.id}
                      onClick={() => toggleRole(u)}
                    >
                      {u.role === "admin" ? "Make user" : "Make admin"}
                    </button>
                    <button
                      className="btn-secondary py-1 text-xs"
                      disabled={busyId === u.id || u.id === user.id}
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
