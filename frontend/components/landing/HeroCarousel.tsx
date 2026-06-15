"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";

const SLIDES = [
  {
    src: "/asset/images/slider1.png",
    alt: "AI brain, secure servers, and verified shield connected in a trust network",
    caption: "Every AI run tied to model identity, parameters, and billing.",
  },
  {
    src: "/asset/images/slider2.png",
    alt: "Shield with checkmark anchored to a blockchain verification chain",
    caption: "Signed receipts and Merkle proofs anyone can verify independently.",
  },
  {
    src: "/asset/images/slider3.png",
    alt: "Neural network feeding a shield that seals locked cryptographic receipts",
    caption: "Tamper-evident execution records for audit-grade AI pipelines.",
  },
] as const;

const INTERVAL_MS = 5000;

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const advance = useCallback(() => {
    setActive((index) => (index + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(advance, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, advance]);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-teal-500/20 via-transparent to-violet-600/20 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0d1117] shadow-2xl shadow-black/40">
        <div className="relative aspect-[16/10] w-full">
          {SLIDES.map((slide, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className={clsx(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out",
                index === active ? "opacity-100" : "opacity-0",
              )}
            />
          ))}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a0e14] via-[#0a0e14]/80 to-transparent px-5 pb-5 pt-16">
            <p className="text-sm leading-relaxed text-slate-300">{SLIDES[active].caption}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show slide ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => setActive(index)}
            className={clsx(
              "h-2 rounded-full transition-all duration-300",
              index === active ? "w-7 bg-teal-500" : "w-2 bg-slate-600 hover:bg-slate-500",
            )}
          />
        ))}
      </div>
    </div>
  );
}
