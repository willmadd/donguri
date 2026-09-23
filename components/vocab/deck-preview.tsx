import { WordImage } from "@/components/ui/word-image";
import { CompletedStamp } from "@/components/vocab/completed-stamp";
import type { TFunction } from "@/lib/i18n/translate";
import type { LanguageDeckSummary } from "@/lib/definitions";

type DeckPreviewProps = {
  deck: LanguageDeckSummary;
  t: TFunction;
  // Off for the public (logged-out) page, where there's no progress to show.
  showProgress?: boolean;
  // h1 on the standalone deck pages, h2 inside the preview modal.
  titleAs?: "h1" | "h2";
};

// Everything a deck contains — cover, tags, description and its full word
// list. No hooks, so it renders from both the deck list's preview modal
// (client, `useTranslations`) and the deck pages (server, `getTranslator`).
export function DeckPreview({
  deck,
  t,
  showProgress = false,
  titleAs: Title = "h2",
}: DeckPreviewProps) {
  const learntPercent =
    deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
  const complete = showProgress && deck.totalWords > 0 && deck.learntWords === deck.totalWords;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        {complete && <CompletedStamp label={t("deck_list.completed", "Completed")} />}
        {deck.coverImage && (
          <WordImage
            src={deck.coverImage}
            alt=""
            className="mb-4 h-40 w-full rounded-2xl object-cover"
          />
        )}
        {deck.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {deck.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-sumi/15 bg-washi-soft px-2.5 py-0.5 text-xs font-medium text-sumi-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <Title className="font-nunito text-2xl font-bold text-sumi">{deck.title}</Title>
        {deck.subheading && <p className="mt-1 text-sumi-soft">{deck.subheading}</p>}
        {deck.description && <p className="mt-3 text-sm text-sumi-soft">{deck.description}</p>}
        <p className="mt-2 text-xs text-sumi-soft">
          {t("deck_list.content_breakdown", "{{vocab}} vocab · {{grammar}} grammar", {
            vocab: deck.vocabCount,
            grammar: deck.grammarCount,
          })}
        </p>
      </div>

      {showProgress && (
        <div>
          <div className="flex items-center justify-between gap-2 text-sm text-sumi-soft">
            <span>
              {t("deck_page.learnt_progress", "{{learnt}} / {{total}} learnt", {
                learnt: deck.learntWords,
                total: deck.totalWords,
              })}
            </span>
            <span className="font-semibold text-sumi">{learntPercent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={deck.totalWords}
            aria-valuenow={deck.learntWords}
            aria-label={t("deck_page.learnt_aria", "{{title}} learnt", { title: deck.title })}
            className="mt-2 h-2 w-full overflow-hidden rounded-full border border-sumi/15 bg-washi"
          >
            <div
              className="h-full rounded-full bg-ai transition-[width]"
              style={{ width: `${learntPercent}%` }}
            />
          </div>
        </div>
      )}

      {deck.words.length === 0 ? (
        <p className="text-sm text-sumi-soft">{t("deck_page.no_words", "No words yet.")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {deck.words.map((word) => (
            <li
              key={word.id}
              className="flex items-baseline justify-between gap-3 rounded-lg bg-washi-soft px-3 py-2 text-sm"
            >
              <span className="text-sumi">
                {word.term}
                {word.romanization && (
                  <span className="text-sumi-soft"> ({word.romanization})</span>
                )}
              </span>
              <span className="shrink-0 text-sumi-soft">{word.translation}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
