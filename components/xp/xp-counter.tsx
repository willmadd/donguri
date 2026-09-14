"use client";

import { AnimatePresence, motion } from "framer-motion";
import { levelForXp, xpRangeForLevel } from "@/lib/levels";
import { XpInfoTooltip } from "@/components/xp/xp-info-tooltip";

// One digit position of the counter — when its character changes, the old
// one flips/slides out upward while the new one slides in from below, the
// way a mechanical ticket-counter or split-flap board rolls over.
function XpDigit({ char }: { char: string }) {
  return (
    <span className="relative inline-block h-[1.15em] w-[0.62em] overflow-hidden text-center align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={char}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// A row of flipping digits for one number — reversed so each array index is
// a stable place value (ones, tens, hundreds, ...): when the digit count
// grows (9 -> 10), a new place is added rather than every existing digit's
// key shifting and re-animating.
function AnimatedDigits({ value }: { value: number }) {
  const reversedDigits = String(Math.max(0, Math.trunc(value)))
    .split("")
    .reverse();

  return (
    <div className="flex flex-row-reverse font-mono text-2xl font-bold tabular-nums">
      {reversedDigits.map((char, index) => (
        <XpDigit key={index} char={char} />
      ))}
    </div>
  );
}

type XpCounterProps = {
  value: number;
  className?: string;
};

export function XpCounter({ value, className = "" }: XpCounterProps) {
  const level = levelForXp(value);
  const { max } = xpRangeForLevel(level);
  // The number itself is always the running total — it never resets at a
  // level boundary, just keeps climbing. Only the "/target" denominator
  // changes, to whatever the next level's threshold is (absent once
  // there's no next level to work toward).
  const whole = Math.trunc(Math.max(0, value));
  // XP only ever lands on a whole number or a half (the streak bonus awards
  // 0.5 at a time) — the flipping digits show the whole part, and this
  // small static ".5" covers the rest, so a redesign of the flip mechanism
  // for a decimal point isn't needed.
  const hasHalf = value - whole >= 0.25;

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl bg-sumi px-4 py-2 text-washi shadow-inner ${className}`}
    >
      <span className="rounded-full bg-washi/15 px-2 py-1 text-xs font-bold whitespace-nowrap">
        Lv {level}
      </span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-baseline">
          <AnimatedDigits value={whole} />
          {hasHalf && <span className="text-base font-bold">.5</span>}
        </div>
        {max !== null && <span className="text-sm font-medium text-washi/70">/{max}</span>}
        <span className="text-xs font-semibold tracking-wide text-washi/70 uppercase">XP</span>
      </div>
      <XpInfoTooltip />
    </div>
  );
}
