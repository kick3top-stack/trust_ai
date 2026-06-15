"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { API_DOCS_URL } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { href: "/playground", label: "Playground", icon: "▶" },
  { href: "/dashboard", label: "Dashboard", icon: "◫" },
  { href: "/receipts", label: "Receipts", icon: "☰" },
  { href: "/verify", label: "Verify", icon: "✓" },
  { href: "/merkle", label: "Merkle", icon: "◎" },
  { href: "/audit", label: "Audit Log", icon: "≡" },
  { href: "/billing", label: "Billing", icon: "¤" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

const AUTH_ROUTES = ["/login", "/register"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/playground",
  "/receipts",
  "/verify",
  "/merkle",
  "/billing",
  "/audit",
  "/settings",
  "/profile",
  "/admin",
];

function isProtectedRoute(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const protectedRoute = isProtectedRoute(pathname);

  useEffect(() => {
    if (!loading && protectedRoute && !user) {
      router.replace("/login");
    }
  }, [loading, protectedRoute, user, router]);

  if (isAuthRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1117] p-6">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    );
  }

  if (!loading && protectedRoute && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d1117] text-slate-500">
        Redirecting to sign in…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-[#0d1117]">
        <div className="border-b border-slate-800 px-5 py-5">
          <Link href={user ? "/dashboard" : "/login"} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-sm font-bold text-white">
              T
            </span>
            <span className="text-base font-semibold text-white">TrustAI</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {user &&
            NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                  )}
                >
                  <span className="w-4 text-center text-xs opacity-70">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          {user?.role === "admin" && (
            <>
              <Link
                href="/admin/support"
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  pathname.startsWith("/admin/support")
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                )}
              >
                <span className="w-4 text-center text-xs opacity-70">?</span>
                Support
              </Link>
              <Link
                href="/admin/users"
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  pathname.startsWith("/admin/users")
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                )}
              >
                <span className="w-4 text-center text-xs opacity-70">👤</span>
                Users
              </Link>
            </>
          )}
        </nav>

        <div className="space-y-0.5 border-t border-slate-800 px-3 py-4">
          {user && (
            <a
              href={API_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
            >
              <span className="w-4 text-center text-xs opacity-70">⎘</span>
              API Docs
            </a>
          )}
          {loading ? (
            <div className="px-3 py-2.5 text-sm text-slate-500">Loading…</div>
          ) : user ? (
            <>
              <Link
                href="/profile"
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  pathname === "/profile"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                  {user.display_name.charAt(0).toUpperCase()}
                </span>
                {user.display_name}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300"
              >
                <span className="w-4 text-center text-xs opacity-70">↩</span>
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-teal-400 transition hover:bg-slate-800/60"
            >
              <span className="w-4 text-center text-xs opacity-70">→</span>
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
