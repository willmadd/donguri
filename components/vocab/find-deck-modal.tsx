"use client";

import { useRef } from "react";
import { DeckList } from "@/components/vocab/deck-list";
import { WordImage } from "@/components/ui/word-image";
import { CompletedStamp } from "@/components/vocab/completed-stamp";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LanguageDeckSummary } from "@/lib/definitions";
import { getContrastTextClass } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type FindDeckModalProps = {
  slug: string;
  decks: LanguageDeckSummary[];
  activeDeckIds: string[];
};

export function FindDeckModal({
  slug,
  decks,
  activeDeckIds,
}: FindDeckModalProps) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeSet = new Set(activeDeckIds);
  const activeDecks = decks.filter((deck) => activeSet.has(deck.id));

  const closeOnBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const inDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!inDialog) {
      dialogRef.current?.close();
    }
  };

  return (
    <>
      <section className="flex flex-col gap-4 rounded-3xl border border-card-border bg-washi-soft p-4 sm:p-5">
        <div className="flex w-full items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-sumi">
            {t("find_deck.your_active_decks", "Your active decks")}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="group flex shrink-0 items-center gap-2 rounded-full bg-ai-soft px-3 py-2 text-sm font-semibold text-ai-dark shadow-sm transition hover:bg-ai/20"
          >
            {t("find_deck.browse", "Browse decks")}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ai/15 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>

        <div className="flex w-full flex-1 flex-col gap-4">
          {activeDecks.length > 0 ? (
            <div className="flex w-full flex-col gap-4">
              {activeDecks.map((deck) => {
                const hasVocab = deck.vocabCount > 0;
                const hasGrammar = deck.grammarCount > 0;
                const badgeLabel =
                  hasVocab && hasGrammar
                    ? t("course_home.mixed", "Mixed")
                    : hasGrammar
                      ? t("course_home.grammar", "Grammar")
                      : t("course_home.vocabulary", "Vocabulary");
                const learntPercent =
                  deck.totalWords > 0
                    ? Math.round((deck.learntWords / deck.totalWords) * 100)
                    : 0;
                const complete =
                  deck.totalWords > 0 && deck.learntWords === deck.totalWords;

                const hasBg = Boolean(deck.bgColor);
                const textClass = hasBg
                  ? getContrastTextClass(deck.bgColor)
                  : "text-sumi";
                const isLightText = textClass === "text-ink-on-dark";
                const trackClass = hasBg
                  ? isLightText
                    ? "border-white/20 bg-white/20"
                    : "border-sumi/15 bg-sumi/10"
                  : "border-sumi/15 bg-washi";
                const mutedTextClass = hasBg
                  ? `${textClass} opacity-80`
                  : "text-sumi-soft";
                const badgeStyle = deck.primaryColor
                  ? { backgroundColor: deck.primaryColor }
                  : undefined;
                const badgeClasses = deck.primaryColor
                  ? getContrastTextClass(deck.primaryColor)
                  : hasVocab && hasGrammar
                    ? "bg-sakura-soft text-sakura-dark"
                    : hasGrammar
                      ? "bg-matcha-soft text-matcha-dark"
                      : "bg-ai-soft text-ai-dark";

                return (
                  <div
                    key={deck.id}
                    className={`group/card relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl border p-5 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                      hasBg
                        ? "border-transparent"
                        : "border-card-border bg-washi"
                    }`}
                    style={
                      deck.bgColor
                        ? { backgroundColor: deck.bgColor }
                        : undefined
                    }
                  >
                    {complete && (
                      <CompletedStamp
                        label={t("deck_list.completed", "Completed")}
                      />
                    )}
                    <div className="flex items-start gap-3.5">
                      <div className="shrink-0">
                        <div className="h-20 w-20 overflow-hidden rounded-xl border border-white/20 bg-neutral-soft shadow-sm">
                          {deck.coverImage ? (
                            <WordImage
                              src={deck.coverImage}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                            />
                          ) : (
                            <span
                              className={`flex h-full w-full items-center justify-center font-nunito text-2xl font-bold ${badgeClasses}`}
                              style={badgeStyle}
                            >
                              {deck.title.charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex w-full flex-wrap items-center gap-1.5">
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${badgeClasses}`}
                            style={badgeStyle}
                          >
                            {badgeLabel}
                          </span>

                          {deck.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${textClass} ${trackClass}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <h3
                          className={`mt-1.5 font-nunito text-lg font-bold leading-snug ${textClass}`}
                        >
                          {deck.title}
                        </h3>

                        {deck.description && (
                          <p
                            className={`mt-1 line-clamp-2 text-sm leading-snug ${mutedTextClass}`}
                          >
                            {deck.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`text-xs font-semibold ${mutedTextClass}`}
                        >
                          {t(
                            "deck_list.words_learnt",
                            "{{learnt}} / {{total}} words learnt",
                            {
                              learnt: deck.learntWords,
                              total: deck.totalWords,
                            },
                          )}
                        </p>
                        <span className={`text-xs font-bold ${textClass}`}>
                          {learntPercent}%
                        </span>
                      </div>
                      <div
                        className={`mt-2 h-2 w-full overflow-hidden rounded-full border ${trackClass}`}
                      >
                        <div
                          className="h-full rounded-full bg-ai transition-[width]"
                          style={{ width: `${learntPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-card-border bg-washi px-6 text-center shadow-sm">
              <p className="max-w-xs text-sm text-sumi-soft">
                {t(
                  "find_deck.no_active",
                  "No decks active yet — browse decks to activate one.",
                )}
              </p>
            </div>
          )}
        </div>
      </section>

      <dialog
        ref={dialogRef}
        onClick={closeOnBackdropClick}
        className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-2xl rounded-3xl border border-card-border bg-washi p-0 shadow-2xl backdrop:bg-sumi/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-card-border bg-washi-soft px-6 py-5">
            <h2 className="text-lg font-bold text-sumi">
              {t("find_deck.title", "Find a deck")}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={t("common.close", "Close")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-sumi/5 text-sumi-soft transition hover:bg-sumi/10 hover:text-sumi"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto p-6">
            <DeckList slug={slug} decks={decks} activeDeckIds={activeDeckIds} />
          </div>
        </div>
      </dialog>
    </>
  );
}
