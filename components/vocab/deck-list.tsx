"use client";

import { useRef, useState } from "react";
import { toggleDeckActivation } from "@/lib/actions/vocab";
import { LanguageDeckWords } from "@/components/vocab/language-deck-words";
import { CompletedStamp } from "@/components/vocab/completed-stamp";
import { DeckPreview } from "@/components/vocab/deck-preview";
import { WordImage } from "@/components/ui/word-image";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LanguageDeckSummary } from "@/lib/definitions";
import { Check, ExternalLink, Link2, Plus, X } from "lucide-react";

type DeckListProps = {
  slug: string;
  decks: LanguageDeckSummary[];
  activeDeckIds: string[];
};

// Active decks feed the Learn and Test pools. More than one can be active.
export function DeckList({ slug, decks, activeDeckIds }: DeckListProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [previewDeck, setPreviewDeck] = useState<LanguageDeckSummary | null>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  const activeSet = new Set(activeDeckIds);

  const openPreview = (deck: LanguageDeckSummary) => {
    setPreviewDeck(deck);
    previewRef.current?.showModal();
  };

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
        const complete =
          deck.totalWords > 0 && deck.learntWords === deck.totalWords;

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
            className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-card-border bg-washi-soft p-4 shadow-sm"
          >
            {complete && (
              <CompletedStamp label={t("deck_list.completed", "Completed")} />
            )}
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
                <button
                  type="button"
                  onClick={() => openPreview(deck)}
                  className="mt-2 block text-left font-nunito text-lg font-bold leading-snug text-sumi transition hover:text-ai"
                >
                  {deck.title}
                </button>
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
                size="sm"
                variant="outline"
                onClick={() => openPreview(deck)}
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
                  className={`group inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai ${
                    isActive
                      ? "border-ai/40 bg-ai-soft text-ai-dark hover:border-shu/40 hover:bg-shu/10 hover:text-shu-dark focus-visible:border-shu/40 focus-visible:bg-shu/10 focus-visible:text-shu-dark"
                      : "border-ai bg-ai text-washi hover:bg-ai-dark"
                  }`}
                >
                  {isActive ? (
                    // Swaps to the remove label on hover/focus so it's clear
                    // what clicking an already-added deck will do.
                    <>
                      <Check
                        className="h-4 w-4 group-hover:hidden group-focus-visible:hidden"
                        aria-hidden="true"
                      />
                      <X
                        className="hidden h-4 w-4 group-hover:block group-focus-visible:block"
                        aria-hidden="true"
                      />
                      <span className="group-hover:hidden group-focus-visible:hidden">
                        {t(
                          "deck_list.added_to_word_list",
                          "Added to my word list",
                        )}
                      </span>
                      <span className="hidden group-hover:inline group-focus-visible:inline">
                        {t(
                          "deck_list.remove_short",
                          "Remove from my word list",
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t("deck_list.add_to_word_list", "Add to my word list")}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        );
      })}

      <DeckPreviewModal
        dialogRef={previewRef}
        slug={slug}
        deck={previewDeck}
      />
    </div>
  );
}

// One shared dialog for every card — opened with the chosen deck rather than
// navigating away. May be nested inside FindDeckModal's own <dialog>, so
// clicks are stopped here before they bubble into that dialog's
// backdrop-click check and close it too.
function DeckPreviewModal({
  dialogRef,
  slug,
  deck,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  slug: string;
  deck: LanguageDeckSummary | null;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const publicPath = deck ? `/courses/${slug}/decks/${deck.id}` : "";

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    event.stopPropagation();
    if (event.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  const copyLink = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-label={deck?.title}
      className="m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-2xl rounded-3xl border border-card-border bg-washi p-0 shadow-2xl backdrop:bg-sumi/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-end border-b border-card-border bg-washi-soft px-4 py-3">
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
          {deck && <DeckPreview deck={deck} t={t} showProgress />}
        </div>
        {deck && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border bg-washi-soft px-6 py-4">
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {copied
                ? t("share_button.copied", "Copied to clipboard!")
                : t("deck_list.copy_link", "Copy link")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("deck_list.open_page", "Open deck page")}
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}
