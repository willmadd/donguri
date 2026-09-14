"use client";

import { AnimatePresence, motion } from "framer-motion";

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

type XpCounterProps = {
  value: number;
  className?: string;
};

export function XpCounter({ value, className = "" }: XpCounterProps) {
  // Reversed so each array index is a stable place value (ones, tens,
  // hundreds, ...) — when the digit count grows (9 -> 10), a new place is
  // added rather than every existing digit's key shifting and re-animating.
  const reversedDigits = String(Math.max(0, Math.trunc(value)))
    .split("")
    .reverse();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl bg-sumi px-4 py-2 text-washi shadow-inner ${className}`}
    >
      <span className="text-xs font-semibold tracking-wide text-washi/70 uppercase">XP</span>
      <div className="flex flex-row-reverse font-mono text-2xl font-bold tabular-nums">
        {reversedDigits.map((char, index) => (
          <XpDigit key={index} char={char} />
        ))}
      </div>
    </div>
  );
}
