"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleDeckActivation } from "@/lib/actions/vocab";
import { LanguageDeckWords } from "@/components/vocab/language-deck-words";
import { WordImage } from "@/components/ui/word-image";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LanguageDeckSummary } from "@/lib/definitions";
import { Check, Plus } from "lucide-react";

type DeckListProps = {
  slug: string;
  decks: LanguageDeckSummary[];
  activeDeckIds: string[];
};

// Active decks feed the Learn and Test pools. More than one can be active.
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
            "deck_list.word_list_hint",
            "Add decks to your word list to include their words in Learn and Test. You can add more than one.",
          )}
        </p>
      </div>

      {decks.length === 0 && (
        <p className="text-sumi-soft">
          {t("deck_list.no_decks", "No decks yet — check back soon.")}
        </p>
      )}

      {decks.length > 0 && filtered.length === 0 && (
        <p className="text-sumi-soft">
          {t("deck_list.no_matches", "No decks match “{{query}}”.", { query })}
        </p>
      )}

      {filtered.map((deck) => {
        const isActive = activeSet.has(deck.id);
        const learntPercent =
          deck.totalWords > 0
            ? Math.round((deck.learntWords / deck.totalWords) * 100)
            : 0;

        const { vocabCount, grammarCount } = deck;
        const hasVocab = vocabCount > 0;
        const hasGrammar = grammarCount > 0;
        const badgeLabel =
          hasVocab && hasGrammar
            ? t("course_home.mixed", "Mixed")
            : hasGrammar
              ? t("course_home.grammar", "Grammar")
              : t("course_home.vocabulary", "Vocabulary");
        const badgeClass =
          hasVocab && hasGrammar
            ? "bg-sakura-soft text-sakura-dark"
            : hasGrammar
              ? "bg-matcha-soft text-matcha-dark"
              : "bg-ai-soft text-ai-dark";

        return (
          <div
            key={deck.id}
            className="flex flex-col gap-3 rounded-2xl border border-card-border bg-washi-soft p-4 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-washi shadow-sm sm:h-28 sm:w-28">
                {deck.coverImage ? (
                  <WordImage
                    src={deck.coverImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center font-nunito text-4xl font-bold ${badgeClass}`}
                  >
                    {deck.title.charAt(0)}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                  >
                    {badgeLabel}
                  </span>
                  {deck.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-sumi/15 bg-washi px-2 py-0.5 text-xs font-medium text-sumi-soft"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                  className="mt-2 block font-nunito text-lg font-bold leading-snug text-sumi transition hover:text-ai"
                >
                  {deck.title}
                </Link>
                {deck.subheading &&
                  deck.subheading.trim().toLowerCase() !==
                    badgeLabel.toLowerCase() && (
                    <p className="mt-1 text-sm text-sumi-soft">
                      {deck.subheading}
                    </p>
                  )}
                <p className="mt-1.5 text-xs text-sumi-soft">
                  {t(
                    "deck_list.content_breakdown",
                    "{{vocab}} vocab · {{grammar}} grammar",
                    {
                      vocab: vocabCount,
                      grammar: grammarCount,
                    },
                  )}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 text-sm text-sumi-soft">
                <span>
                  {t(
                    "deck_list.words_learnt",
                    "{{learnt}} / {{total}} words learnt",
                    {
                      learnt: deck.learntWords,
                      total: deck.totalWords,
                    },
                  )}
                </span>
                <span className="font-semibold text-sumi">
                  {learntPercent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={deck.totalWords}
                aria-valuenow={deck.learntWords}
                aria-label={t(
                  "deck_list.words_learnt_aria",
                  "{{title}} words learnt",
                  {
                    title: deck.title,
                  },
                )}
                className="mt-2 h-2 w-full overflow-hidden rounded-full border border-sumi/15 bg-washi"
              >
                <div
                  className="h-full rounded-full bg-ai transition-[width]"
                  style={{ width: `${learntPercent}%` }}
                />
              </div>
            </div>

            <LanguageDeckWords words={deck.words} />

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border pt-3">
              <Button
                href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                size="sm"
                variant="outline"
              >
                {t("deck_list.preview", "Preview")}
              </Button>
              <form
                action={toggleDeckActivation.bind(
                  null,
                  slug,
                  deck.id,
                  !isActive,
                )}
              >
                <button
                  type="submit"
                  aria-label={
                    isActive
                      ? t(
                          "deck_list.remove_from_word_list",
                          "Remove {{title}} from my word list",
                          { title: deck.title },
                        )
                      : t(
                          "deck_list.add_deck_to_word_list",
                          "Add {{title}} to my word list",
                          { title: deck.title },
                        )
                  }
                  className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai ${
                    isActive
                      ? "border-ai/40 bg-ai-soft text-ai-dark hover:bg-ai/20"
                      : "border-ai bg-ai text-washi hover:bg-ai-dark"
                  }`}
                >
                  {isActive ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isActive
                    ? t("deck_list.added_to_word_list", "Added to my word list")
                    : t("deck_list.add_to_word_list", "Add to my word list")}
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
