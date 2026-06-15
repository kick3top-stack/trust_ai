"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PersonalDashboard } from "@/components/dashboard/PersonalDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchAdminStats, type AdminStats } from "@/lib/api";

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshUser().catch(() => {});
    fetchAdminStats().then(setStats).catch((e) => setError(e.message));
  }, [refreshUser]);

  const creditBalance = stats?.credit_balance ?? user?.credit_balance ?? "-";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your personal activity and credit usage"
      />

      <PersonalDashboard
        stats={stats}
        error={error}
        displayName={user?.display_name}
        creditBalance={creditBalance}
      />
    </div>
  );
}
