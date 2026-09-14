"use client";

import { useEffect, useRef, useState } from "react";

// A small "?" affordance that explains what XP is for — click to toggle
// (not hover-only, so it works on touch devices too), dismissed by clicking
// anywhere else.
export function XpInfoTooltip() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="What is XP for?"
        aria-expanded={open}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-washi/20 text-[10px] font-bold text-washi/90 transition hover:bg-washi/30"
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute top-full right-0 z-20 mt-2 w-64 rounded-xl border border-sumi/10 bg-washi p-3 text-left text-xs leading-relaxed text-sumi normal-case shadow-lg"
        >
          <p>
            Earn XP by answering quiz questions correctly (+1 each, +5 for a perfect
            quiz), plus a growing bonus for every consecutive day you keep your
            streak going.
          </p>
          <p className="mt-1.5">
            Level up to upgrade your Donguri character — unlocking new outfits, and
            more content to come.
          </p>
        </div>
      )}
    </div>
  );
}
