"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PlatformOverview } from "@/components/dashboard/PlatformOverview";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchPlatformStats, type AdminStats } from "@/lib/api";

export default function AdminOverviewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchPlatformStats().then(setStats).catch((e) => setError(e.message));
  }, [user]);

  if (loading || !user || user.role !== "admin") return null;

  return (
    <div>
      <PageHeader
        title="Platform overview"
        subtitle="System-wide metrics for all users"
      />
      <PlatformOverview stats={stats} error={error} />
    </div>
  );
}
