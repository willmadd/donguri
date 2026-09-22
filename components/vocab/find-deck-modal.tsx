"use client";

import { useRef } from "react";
import { DeckList } from "@/components/vocab/deck-list";
import { Button } from "@/components/ui/button";
import { WordImage } from "@/components/ui/word-image";
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
      <section className="flex  flex-col items-center gap-3 rounded-2xl border border-card-border bg-washi-soft p-6 text-center">
        <div className="flex w-full items-center justify-between">
          <h2 className="text-xl font-bold">
            {t("find_deck.your_active_decks", "Your Active Decks.")}
          </h2>
          <button
            onClick={() => dialogRef.current?.showModal()}
            className="flex items-center gap-1 text-sm font-medium text-ai hover:text-ai-dark"
          >
            {t("find_deck.browse", "Browse all Decks.")} <ArrowRight />
          </button>
        </div>
        {/* <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-soft text-lg font-semibold text-sumi">
          探
        </span> */}
        <div>
          <h2 className="font-semibold text-sumi">
            {t("find_deck.title", "Find a deck")}
          </h2>
          <p className="mt-1 text-sm text-sumi-soft">
            {t(
              "find_deck.subtitle",
              "Search all decks and manage which ones are active.",
            )}
          </p>
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2">
          {activeDecks.length > 0 ? (
            <div className="flex w-full flex-col gap-3">
              {activeDecks.map((deck) => {
                const isGrammar = deck.path === "grammar";
                const complete =
                  deck.totalWords > 0 && deck.knownWords === deck.totalWords;
                const learntPercent =
                  deck.totalWords > 0
                    ? Math.round((deck.learntWords / deck.totalWords) * 100)
                    : 0;
                const knownPercent =
                  deck.totalWords > 0
                    ? Math.round((deck.knownWords / deck.totalWords) * 100)
                    : 0;

                // Text sits on the card's own background now (not over the
                // photo), so contrast is computed against deck.bgColor when
                // set, falling back to the app's default ink/soft-ink pair.
                const hasBg = Boolean(deck.bgColor);
                const textClass = hasBg ? getContrastTextClass(deck.bgColor) : "text-sumi";
                const isLightText = textClass === "text-ink-on-dark";
                const trackClass = hasBg
                  ? isLightText
                    ? "border-white/20 bg-white/20"
                    : "border-sumi/15 bg-sumi/10"
                  : "border-sumi/15 bg-washi";
                const badgeStyle = deck.primaryColor
                  ? { backgroundColor: deck.primaryColor }
                  : undefined;
                const badgeClasses = deck.primaryColor
                  ? getContrastTextClass(deck.primaryColor)
                  : isGrammar
                    ? "bg-matcha-soft text-matcha-dark"
                    : "bg-ai-soft text-ai-dark";

                return (
                  <div
                    key={deck.id}
                    className={`flex w-full flex-col gap-2 rounded-2xl border p-4 text-left ${
                      hasBg ? "border-transparent" : "border-card-border bg-washi-soft"
                    }`}
                    style={deck.bgColor ? { backgroundColor: deck.bgColor } : undefined}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`w-full text-base font-semibold ${textClass}`}>
                        {deck.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClasses}`}
                        style={badgeStyle}
                      >
                        {isGrammar
                          ? t("course_home.grammar", "Grammar")
                          : t("course_home.vocabulary", "Vocabulary")}
                      </span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 p-1">
                        <div className="h-16 w-16 overflow-hidden rounded-xl bg-neutral-soft sm:h-20 sm:w-20">
                          {deck.coverImage ? (
                            <WordImage
                              src={deck.coverImage}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span
                              className={`flex h-full w-full items-center justify-center text-2xl font-semibold ${badgeClasses}`}
                              style={badgeStyle}
                            >
                              {deck.title.charAt(0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        {deck.description && (
                          <p
                            className={`line-clamp-2 text-sm ${textClass} ${
                              hasBg ? "opacity-80" : ""
                            }`}
                          >
                            {deck.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-col gap-1.5">
                          <div>
                            <p className={`text-xs ${textClass} ${hasBg ? "opacity-80" : ""}`}>
                              {t(
                                "deck_list.words_learnt",
                                "{{learnt}} / {{total}} words learnt",
                                { learnt: deck.learntWords, total: deck.totalWords },
                              )}
                            </p>
                            <div
                              className={`mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full border ${trackClass}`}
                            >
                              <div
                                className="h-full rounded-full bg-ai transition-[width]"
                                style={{ width: `${learntPercent}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <p className={`text-xs ${textClass} ${hasBg ? "opacity-80" : ""}`}>
                              {complete
                                ? t("deck_list.all_words_known", "All words known")
                                : t(
                                    "deck_list.words_known",
                                    "{{known}} / {{total}} words known",
                                    { known: deck.knownWords, total: deck.totalWords },
                                  )}
                            </p>
                            <div
                              className={`mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full border ${trackClass}`}
                            >
                              <div
                                className="h-full rounded-full bg-matcha transition-[width]"
                                style={{ width: `${knownPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-sumi-soft">
              {t(
                "find_deck.no_active",
                "No decks active yet — browse below to activate one.",
              )}
            </p>
          )}
        </div>

        {/* <Button
          onClick={() => dialogRef.current?.showModal()}
          className="bg-sumi text-washi hover:bg-sumi/90"
        >
          {t("find_deck.browse", "Browse decks")}
        </Button> */}
      </section>

      <dialog
        ref={dialogRef}
        onClick={closeOnBackdropClick}
        className="m-auto max-h-[85vh] w-full max-w-2xl rounded-2xl border border-sumi/10 bg-washi p-0 backdrop:bg-sumi/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-sumi/10 p-6">
            <h2 className="font-semibold text-sumi">
              {t("find_deck.title", "Find a deck")}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={t("common.close", "Close")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-sumi-soft transition hover:bg-sumi/5 hover:text-sumi"
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
