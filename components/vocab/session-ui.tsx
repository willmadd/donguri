"use client";

import { useSpeech } from "@/lib/speech";

export const SpeakButton = ({
  text,
  language,
}: {
  text: string;
  language: string;
}) => {
  const { speak, speaking } = useSpeech();

  return (
    <button
      type="button"
      onClick={() => speak(text, language)}
      aria-label={`Listen to ${text}`}
      disabled={speaking}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-soft text-lg text-ai transition hover:scale-105 hover:bg-ai/15 disabled:opacity-60"
    >
      {speaking ? "…" : "🔊"}
    </button>
  );
};

export const ProgressDots = ({
  current,
  total,
}: {
  current: number;
  total: number;
}) => (
  <div
    className="flex items-center justify-center gap-2"
    role="progressbar"
    aria-valuemin={1}
    aria-valuemax={total}
    aria-valuenow={current}
  >
    {Array.from({ length: total }).map((_, index) => (
      <span
        key={index}
        className={`h-2 rounded-full transition-all ${
          index + 1 === current
            ? "w-7 bg-ai"
            : index + 1 < current
              ? "w-2 bg-ai/40"
              : "w-2 bg-sumi/10"
        }`}
      />
    ))}
  </div>
);
