"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ProfilePage() {
  const { user, loading, updateUserProfile, logout } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) setDisplayName(user.display_name);
  }, [user]);

  if (loading || !user) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    if (!user) return;
    try {
      await updateUserProfile(
        displayName !== user.display_name ? displayName : undefined,
        password || undefined,
      );
      setPassword("");
      setMessage("Profile updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your account" />

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="panel">
          <div className="panel-header">Account</div>
          <div className="panel-body space-y-4">
            {error && <p className="text-sm text-red-300">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}

            <div className="text-sm text-slate-400">
              Email: <span className="text-slate-200">{user.email}</span>
            </div>
            <div className="text-sm text-slate-400">
              Role: <span className="text-slate-200">{user.role}</span>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Display name</span>
              <input
                className="input-field w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">New password</span>
              <input
                type="password"
                className="input-field w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                minLength={6}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <div className="panel">
          <div className="panel-header">Session</div>
          <div className="panel-body space-y-4 text-sm text-slate-400">
            <p>Member since {new Date(user.created_at).toLocaleDateString()}</p>
            {user.last_login_at && (
              <p>Last login {new Date(user.last_login_at).toLocaleString()}</p>
            )}
            <button type="button" className="btn-secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
