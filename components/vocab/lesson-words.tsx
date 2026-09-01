"use client";

import { useState } from "react";
import type { LessonWordSummary } from "@/lib/definitions";

export function LessonWords({ words }: { words: LessonWordSummary[] }) {
  const [open, setOpen] = useState(false);
  const knownWords = words.filter((word) => word.known);

  if (knownWords.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="text-sm font-medium text-ai-dark transition hover:text-ai"
      >
        {open ? "Hide" : "Show"} known words ({knownWords.length})
      </button>

      {open && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {knownWords.map((word) => (
            <li
              key={word.id}
              className="rounded-full bg-matcha-soft px-3 py-1 text-sm text-matcha-dark"
            >
              {word.term}
              {word.romanization && (
                <span className="opacity-70"> ({word.romanization})</span>
              )}
              <span className="opacity-70"> — {word.translation}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
