"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { WordImage } from "@/components/ui/word-image";
import { isComplete } from "@/components/vocab/deck-list";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LanguageDeckSummary } from "@/lib/definitions";
import { getContrastTextClass } from "@/lib/utils";

const TAPE_COLORS = [
  "var(--shu)",
  "var(--ai)",
  "var(--matcha)",
  "var(--sakura)",
  "var(--kin)",
];

type TapePiece = {
  id: number;
  left: number;
  width: number;
  height: number;
  sway: number;
  spin: number;
  duration: number;
  delay: number;
  color: string;
};

function randomTape(count: number): TapePiece[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    width: 6 + Math.random() * 5,
    height: 26 + Math.random() * 30,
    sway: 20 + Math.random() * 60,
    spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540),
    duration: 3 + Math.random() * 2.5,
    delay: Math.random() * 3,
    color: TAPE_COLORS[index % TAPE_COLORS.length],
  }));
}

// Which completed decks have already been celebrated, per course. Kept in
// the browser rather than the database — a missed or repeated celebration
// is harmless, and it needs no schema change.
function storageKey(slug: string) {
  return `donguri:celebrated-decks:${slug}`;
}

function readCelebrated(slug: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeCelebrated(slug: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode etc.) — worst case it celebrates again.
  }
}

// Lives on the course page: once a deck is fully learnt, the next visit
// celebrates it with a ticker-tape modal — once per deck, one deck at a time
// if several finished together. A deck that stops being complete (restarted,
// or new words added) is forgotten, so finishing it again celebrates again.
export function DeckCompleteCelebration({
  slug,
  decks,
}: {
  slug: string;
  decks: LanguageDeckSummary[];
}) {
  const [queue, setQueue] = useState<LanguageDeckSummary[]>([]);

  useEffect(() => {
    const completed = decks.filter(isComplete);
    const completedIds = new Set(completed.map((deck) => deck.id));
    const celebrated = readCelebrated(slug).filter((id) => completedIds.has(id));
    writeCelebrated(slug, celebrated);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount.
    setQueue(completed.filter((deck) => !celebrated.includes(deck.id)));
  }, [slug, decks]);

  const current = queue[0];

  function handleContinue() {
    if (!current) return;
    writeCelebrated(slug, [...readCelebrated(slug), current.id]);
    setQueue((existing) => existing.slice(1));
  }

  return (
    <AnimatePresence mode="wait">
      {current && (
        <CelebrationModal
          key={current.id}
          deck={current}
          onContinue={handleContinue}
        />
      )}
    </AnimatePresence>
  );
}

function CelebrationModal({
  deck,
  onContinue: onContinueProp,
}: {
  deck: LanguageDeckSummary;
  onContinue: () => void;
}) {
  const t = useTranslations();
  // Only once per modal — a second click or Escape while it's animating out
  // would otherwise dismiss the *next* deck's celebration too.
  const dismissed = useRef(false);
  const onContinue = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onContinueProp();
  };
  const reduceMotion = useReducedMotion();
  const [tape, setTape] = useState<TapePiece[]>([]);

  // Same reasoning as useConfetti in level-up-modal.tsx: Math.random has to
  // stay out of render, so the shower is generated once right after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time random shower generated after mount, since render itself must stay pure (no Math.random there).
    setTape(reduceMotion ? [] : randomTape(140));
  }, [reduceMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dismissed.current) {
        dismissed.current = true;
        onContinueProp();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onContinueProp]);

  const headerTextClass = deck.bgColor
    ? getContrastTextClass(deck.bgColor)
    : "text-washi";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t("deck_complete.title", "Well done!")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-sumi/70 p-4 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 40, rotate: -3 }}
        animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-washi-soft text-center shadow-2xl"
      >
        {/* Deck-coloured header with the cover and a stamp that slams on. */}
        <div
          className={`relative flex flex-col items-center overflow-hidden px-8 pb-8 pt-10 ${
            deck.bgColor ? "" : "bg-ai"
          }`}
          style={deck.bgColor ? { backgroundColor: deck.bgColor } : undefined}
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.5) 0deg 10deg, transparent 10deg 20deg)",
              maskImage: "radial-gradient(circle, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 70%)",
            }}
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          />

          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
            className="relative h-32 w-32 overflow-hidden rounded-2xl border-4 border-washi/80 bg-neutral-soft shadow-xl"
          >
            {deck.coverImage ? (
              <WordImage
                src={deck.coverImage}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-ai-soft font-nunito text-5xl font-bold text-ai-dark">
                {deck.title.charAt(0)}
              </span>
            )}
          </motion.div>

          <motion.span
            aria-hidden="true"
            initial={{ scale: 2.6, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: -12 }}
            transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.7 }}
            className="absolute bottom-5 right-6 rounded-xl border-4 border-double border-shu bg-washi-soft/90 px-3 py-1 font-nunito text-lg font-extrabold uppercase tracking-[0.2em] text-shu shadow-md"
          >
            {t("deck_list.completed", "Completed")}
          </motion.span>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className={`relative mt-4 font-nunito text-xl font-bold leading-snug ${headerTextClass}`}
          >
            {deck.title}
          </motion.p>
        </div>

        <div className="px-8 pb-8 pt-6">
          <motion.h2
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.45 }}
            className="font-nunito text-3xl font-extrabold text-sumi"
          >
            {t("deck_complete.title", "Well done!")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-2 text-sumi-soft"
          >
            {t("deck_complete.subtitle", "You've completed the {{title}} deck.", {
              title: deck.title,
            })}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mt-5 flex justify-center gap-3"
          >
            {deck.vocabCount > 0 && (
              <span className="rounded-full bg-ai-soft px-3 py-1 text-sm font-semibold text-ai-dark">
                {t("deck_complete.vocab_count", "{{count}} words", {
                  count: deck.vocabCount,
                })}
              </span>
            )}
            {deck.grammarCount > 0 && (
              <span className="rounded-full bg-matcha-soft px-3 py-1 text-sm font-semibold text-matcha-dark">
                {t("deck_complete.grammar_count", "{{count}} grammar points", {
                  count: deck.grammarCount,
                })}
              </span>
            )}
          </motion.div>

          <Button
            size="lg"
            fullWidth
            onClick={onContinue}
            autoFocus
            className="mt-7 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
          >
            {t("common.continue", "Continue")}
          </Button>
        </div>
      </motion.div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {tape.map((piece) => (
          <motion.span
            key={piece.id}
            initial={{ y: "-10vh", x: 0, rotate: 0, rotateX: 0 }}
            animate={{
              y: "110vh",
              x: [0, piece.sway, -piece.sway, piece.sway / 2, 0],
              rotate: piece.spin,
              rotateX: [0, 360, 720, 1080],
            }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: "linear",
            }}
            className="absolute top-0 rounded-xs"
            style={{
              left: `${piece.left}%`,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
