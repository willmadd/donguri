"use client";

import { useState } from "react";
import Link from "next/link";
import { skipLanguageDeck, toggleDeckActivation } from "@/lib/actions/vocab";
import { LanguageDeckWords } from "@/components/vocab/language-deck-words";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { WordImage } from "@/components/ui/word-image";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LanguageDeckSummary } from "@/lib/definitions";

type DeckListProps = {
  slug: string;
  decks: LanguageDeckSummary[];
  activeDeckIds: string[];
};

// Search + per-deck "active" toggle — which decks currently feed the
// Learn/Test pool (see getActiveDeckIds/getLearnQueueForCourse in
// lib/dal.ts). More than one can be active at once; the three words a
// Learn session introduces are drawn at random from across all of them.
export function DeckList({ slug, decks, activeDeckIds }: DeckListProps) {
  const t = useTranslations();
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
          {t("deck_list.search_label", "Search decks")}
        </label>
        <input
          id="deck-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("deck_list.search_placeholder", "Search decks…")}
          className="h-11 w-full max-w-sm rounded-full border border-sumi/15 bg-washi px-5 text-sumi outline-none transition placeholder:text-sumi-soft/50 focus:border-ai/50 focus:ring-2 focus:ring-ai-soft"
        />
        <p className="text-xs text-sumi-soft">
          {t(
            "deck_list.hint",
            "Toggle a deck active to include its words in Learn and Test — more than one can be active at once.",
          )}
        </p>
      </div>

      {decks.length === 0 && (
        <p className="text-sumi-soft">{t("deck_list.no_decks", "No decks yet — check back soon.")}</p>
      )}

      {decks.length > 0 && filtered.length === 0 && (
        <p className="text-sumi-soft">
          {t("deck_list.no_matches", "No decks match “{{query}}”.", { query })}
        </p>
      )}

      {filtered.map((deck) => {
        const complete = deck.totalWords > 0 && deck.knownWords === deck.totalWords;
        const learntPercent =
          deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
        const knownPercent =
          deck.totalWords > 0 ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;

        const isGrammar = deck.path === "grammar";
        const vocabCount = isGrammar ? 0 : deck.totalWords;
        const grammarCount = isGrammar ? deck.totalWords : 0;

        return (
          <div
            key={deck.id}
            className="flex flex-col gap-3 rounded-2xl border border-card-border bg-washi-soft p-6 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex flex-1 gap-4">
              {deck.coverImage && (
                <WordImage
                  src={deck.coverImage}
                  alt=""
                  className="hidden h-16 w-16 shrink-0 rounded-xl object-cover sm:block"
                />
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                    className="font-semibold text-sumi transition hover:text-ai"
                  >
                    {deck.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isGrammar ? "bg-matcha-soft text-matcha-dark" : "bg-ai-soft text-ai-dark"
                    }`}
                  >
                    {isGrammar
                      ? t("course_home.grammar", "Grammar")
                      : t("course_home.vocabulary", "Vocabulary")}
                  </span>
                </div>
                {deck.subheading && (
                  <p className="mt-0.5 text-sm text-sumi-soft">{deck.subheading}</p>
                )}
                <p className="mt-1 text-xs text-sumi-soft">
                  {t("deck_list.content_breakdown", "{{vocab}} vocab · {{grammar}} grammar", {
                    vocab: vocabCount,
                    grammar: grammarCount,
                  })}
                </p>

                <div className="mt-2 flex flex-col gap-2">
                  <div>
                    <p className="text-sm text-sumi-soft">
                      {t("deck_list.words_learnt", "{{learnt}} / {{total}} words learnt", {
                        learnt: deck.learntWords,
                        total: deck.totalWords,
                      })}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={deck.totalWords}
                      aria-valuenow={deck.learntWords}
                      aria-label={t("deck_list.words_learnt_aria", "{{title}} words learnt", {
                        title: deck.title,
                      })}
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
                      {complete
                        ? t("deck_list.all_words_known", "All words known")
                        : t("deck_list.words_known", "{{known}} / {{total}} words known", {
                            known: deck.knownWords,
                            total: deck.totalWords,
                          })}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={deck.totalWords}
                      aria-valuenow={deck.knownWords}
                      aria-label={t("deck_list.words_known_aria", "{{title}} words known", {
                        title: deck.title,
                      })}
                      className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
                    >
                      <div
                        className="h-full rounded-full bg-matcha transition-[width]"
                        style={{ width: `${knownPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <LanguageDeckWords words={deck.words} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <VisibilityToggle
                active={activeSet.has(deck.id)}
                toggleAction={toggleDeckActivation.bind(null, slug, deck.id)}
                label={deck.title}
                statusLabels={{
                  on: t("deck_list.active", "Active"),
                  off: t("deck_list.inactive", "Inactive"),
                }}
              />
              <div className="flex items-center gap-2">
                {!complete && (
                  <form action={skipLanguageDeck.bind(null, deck.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      {t("deck_list.skip", "Skip — I know this")}
                    </Button>
                  </form>
                )}
                <Button href={`/dashboard/courses/${slug}/decks/${deck.id}`} size="sm">
                  {t("deck_list.open_deck", "Open deck")}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
