"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { HeroCarousel } from "@/components/landing/HeroCarousel";
import { Logo } from "@/components/Logo";

const FEATURES = [
  {
    title: "Cryptographic receipts",
    description:
      "Every AI run produces a signed receipt with model identity, parameters, and credit charge. Tamper-evident by design.",
  },
  {
    title: "Independent verification",
    description:
      "Upload receipt packages or verify online. Confirm hashes, Merkle proofs, and Ed25519 signatures without trusting the UI alone.",
  },
  {
    title: "Merkle batch sealing",
    description:
      "Receipts are batched into Merkle trees and sealed with platform signing keys for audit-grade inclusion proofs.",
  },
  {
    title: "Transparent billing",
    description:
      "Credit ledger tracks every generation charge. Users can dispute; admins resolve from a dedicated support console.",
  },
];

const STEPS = [
  { step: "1", title: "Generate", text: "Run inference in the Playground with full parameter control." },
  { step: "2", title: "Receipt", text: "Receive a cryptographic proof tied to your request and credit cost." },
  { step: "3", title: "Verify", text: "Validate integrity anytime, online or offline with exported packages." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e14] text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-slate-100">
      <header className="border-b border-slate-800/80 bg-[#0d1117]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo href="/" height={40} />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary py-2">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary py-2">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-800/80">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(20,184,166,0.12),_transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(124,58,237,0.1),_transparent_50%)]" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div className="max-w-xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-teal-400">
                Verifiable AI execution
              </p>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white lg:text-5xl">
                Prove what your AI generated, with receipts anyone can verify
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-slate-400">
                TrustAI issues cryptographic execution receipts for every model run: model fingerprint,
                parameters, billing, and Merkle batch inclusion. Built for teams that need audit trails,
                not black-box outputs.
              </p>

              <ul className="mb-10 space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs text-teal-400">
                    ✓
                  </span>
                  Ed25519-signed receipts with model and parameter fingerprints
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs text-teal-400">
                    ✓
                  </span>
                  Merkle batch sealing for audit-grade inclusion proofs
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs text-teal-400">
                    ✓
                  </span>
                  Online and offline verification without trusting the UI alone
                </li>
              </ul>

              <div className="flex flex-wrap gap-4">
                <Link href="/register" className="btn-primary px-8 py-3 text-base">
                  Start free pilot
                </Link>
                <Link href="/login" className="btn-secondary px-8 py-3 text-base">
                  Sign in to dashboard
                </Link>
              </div>
            </div>

            <HeroCarousel />
          </div>
        </section>

        <section className="border-y border-slate-800 bg-[#0d1117] py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
              How it works
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((item) => (
                <div key={item.step} className="panel p-6 text-center">
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 text-lg font-bold text-teal-400">
                    {item.step}
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-12 text-2xl font-semibold text-white">Why TrustAI</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel p-6">
                <h3 className="mb-2 text-lg font-medium text-teal-400">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-800 bg-gradient-to-br from-teal-950/40 to-violet-950/30 py-16">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="mb-4 text-2xl font-semibold text-white">Ready to verify your AI pipeline?</h2>
            <p className="mx-auto mb-8 max-w-xl text-slate-400">
              Create an account, run your first generation, and download a receipt package in minutes.
            </p>
            <Link href="/register" className="btn-primary px-10 py-3 text-base">
              Create account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-500">
        TrustAI: cryptographic execution receipts for AI generations
      </footer>
    </div>
  );
}
