"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AdminUserDashboard } from "@/components/dashboard/AdminUserDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchAdminUserStats, type AdminStats } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = String(params.id);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [targetUser, setTargetUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    setError(null);
    fetchAdminUserStats(userId)
      .then((data) => {
        setStats(data);
        if (data.user) {
          setTargetUser(data.user);
        } else if (data.subject_email) {
          setTargetUser({
            id: data.subject_user_id || userId,
            email: data.subject_email,
            display_name: data.subject_display_name || data.subject_email,
            role: data.subject_role || "user",
            is_active: data.subject_is_active ?? true,
            credit_balance: data.credit_balance ?? 0,
            created_at: "",
            last_login_at: null,
          });
        }
      })
      .catch((e) => setError(e.message));
  }, [user, userId]);

  if (loading || !user || user.role !== "admin") return null;

  return (
    <div>
      <PageHeader
        title={targetUser ? targetUser.display_name : "User detail"}
        subtitle={
          targetUser
            ? `${targetUser.email} · administrator view`
            : "Loading user profile…"
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="btn-secondary py-2 text-sm">
          Back to users
        </Link>
        <Link href="/admin/overview" className="btn-secondary py-2 text-sm">
          Platform overview
        </Link>
        {targetUser && (
          <Link
            href={`/admin/support?email=${encodeURIComponent(targetUser.email)}`}
            className="btn-secondary py-2 text-sm"
          >
            Support lookup
          </Link>
        )}
      </div>

      <AdminUserDashboard stats={stats} user={targetUser} error={error} />
    </div>
  );
}
