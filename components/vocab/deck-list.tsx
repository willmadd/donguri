"use client";

import { useState } from "react";
import Link from "next/link";
import { skipLesson, toggleDeckActivation } from "@/lib/actions/vocab";
import { LessonWords } from "@/components/vocab/lesson-words";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import type { LessonSummary } from "@/lib/definitions";

type DeckListProps = {
  slug: string;
  decks: LessonSummary[];
  activeDeckIds: string[];
};

// Search + per-deck "active" toggle — which decks currently feed the
// Learn/Test pool (see getActiveDeckIds/getLearnQueueForCourse in
// lib/dal.ts). More than one can be active at once; the three words a
// Learn session introduces are drawn at random from across all of them.
export function DeckList({ slug, decks, activeDeckIds }: DeckListProps) {
  const [query, setQuery] = useState("");
  const activeSet = new Set(activeDeckIds);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? decks.filter((deck) => deck.title.toLowerCase().includes(normalizedQuery))
    : decks;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="deck-search" className="sr-only">
          Search decks
        </label>
        <input
          id="deck-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search decks…"
          className="h-11 w-full max-w-sm rounded-full border border-sumi/15 bg-washi px-5 text-sumi outline-none transition placeholder:text-sumi-soft/50 focus:border-ai/50 focus:ring-2 focus:ring-ai-soft"
        />
        <p className="text-xs text-sumi-soft">
          Toggle a deck active to include its words in Learn and Test — more than one can be
          active at once.
        </p>
      </div>

      {decks.length === 0 && <p className="text-sumi-soft">No decks yet — check back soon.</p>}

      {decks.length > 0 && filtered.length === 0 && (
        <p className="text-sumi-soft">No decks match &ldquo;{query}&rdquo;.</p>
      )}

      {filtered.map((deck) => {
        const complete = deck.totalWords > 0 && deck.knownWords === deck.totalWords;
        const learntPercent =
          deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
        const knownPercent =
          deck.totalWords > 0 ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;

        return (
          <div
            key={deck.id}
            className="flex flex-col gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex-1">
              <Link
                href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                className="font-semibold text-sumi transition hover:text-ai"
              >
                {deck.title}
              </Link>

              <div className="mt-2 flex flex-col gap-2">
                <div>
                  <p className="text-sm text-sumi-soft">
                    {deck.learntWords} / {deck.totalWords} words learnt
                  </p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={deck.totalWords}
                    aria-valuenow={deck.learntWords}
                    aria-label={`${deck.title} words learnt`}
                    className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
                  >
                    <div
                      className="h-full rounded-full bg-ai transition-[width]"
                      style={{ width: `${learntPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-sm text-sumi-soft">
                    {complete ? "All words known" : `${deck.knownWords} / ${deck.totalWords} words known`}
                  </p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={deck.totalWords}
                    aria-valuenow={deck.knownWords}
                    aria-label={`${deck.title} words known`}
                    className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
                  >
                    <div
                      className="h-full rounded-full bg-matcha transition-[width]"
                      style={{ width: `${knownPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <LessonWords words={deck.words} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <VisibilityToggle
                active={activeSet.has(deck.id)}
                toggleAction={toggleDeckActivation.bind(null, slug, deck.id)}
                label={deck.title}
                statusLabels={{ on: "Active", off: "Inactive" }}
              />
              <div className="flex items-center gap-2">
                {!complete && (
                  <form action={skipLesson.bind(null, deck.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-sumi/15 px-4 py-2 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
                    >
                      Skip — I know this
                    </button>
                  </form>
                )}
                <Link
                  href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-ai px-4 text-sm font-medium text-washi transition hover:bg-ai-dark"
                >
                  Open deck
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
