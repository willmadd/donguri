import type { Metadata } from "next";
import Link from "next/link";
import { getDeckDetail } from "@/lib/dal";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { WordImage } from "@/components/ui/word-image";
import { getTranslator } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";
import type { LanguageDeckSummary, LanguageDeckWordSummary } from "@/lib/definitions";

type PageProps = {
  params: Promise<{ slug: string; deckId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, deckId } = await params;
  const { course, deck } = await getDeckDetail(slug, deckId);
  return { title: `${deck.title} — ${course.title}` };
}

// A per-deck stats/browse view — progress bars and word list only. Learning
// and testing are no longer deck-specific (see the course home page's
// "active decks" selection and lib/dal.ts's getLearnQueueForCourse):
// activate this deck there to have its words included, rather than clicking
// a Learn button here. A deck can hold vocab words, grammar points, or a mix
// (see the note on `Word.path` in prisma/schema.prisma) — this page shows a
// row per content type actually present.
export default async function DeckPage({ params }: PageProps) {
  const { slug, deckId } = await params;

  const [{ course, deck }, { t }] = await Promise.all([
    getDeckDetail(slug, deckId),
    getTranslator(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
            { href: `/dashboard/courses/${slug}`, label: course.title },
            { label: deck.title },
          ]}
        />
        {deck.coverImage && (
          <WordImage
            src={deck.coverImage}
            alt=""
            className="mt-4 h-40 w-full rounded-2xl object-cover"
          />
        )}
        <PageTitle className="mt-4">{deck.title}</PageTitle>
        {deck.subheading && <PageSubtitle>{deck.subheading}</PageSubtitle>}
        {deck.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
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
        {deck.description && <p className="mt-3 text-sumi-soft">{deck.description}</p>}
      </div>

      <section className="rounded-2xl border border-card-border bg-washi-soft p-6">
        <div className="flex flex-col gap-2">
          {deck.vocabCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-soft text-lg font-semibold text-ai-dark">
                語
              </span>
              <h2 className="font-semibold text-sumi">{t("course_home.vocabulary", "Vocabulary")}</h2>
            </div>
          )}
          {deck.grammarCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-soft text-lg font-semibold text-matcha-dark">
                文
              </span>
              <h2 className="font-semibold text-sumi">{t("course_home.grammar", "Grammar")}</h2>
            </div>
          )}
        </div>

        <DeckProgress deck={deck} t={t} />
        <DeckWordList words={deck.words} t={t} />
      </section>

      <div className="rounded-2xl border border-card-border bg-washi-soft p-6 text-sm text-sumi-soft">
        {t("deck_page.activate_prefix", "Activate this deck on the")}{" "}
        <Link href={`/dashboard/courses/${slug}`} className="font-medium text-ai-dark hover:underline">
          {t("deck_page.course_page_link", "course page")}
        </Link>{" "}
        {t(
          "deck_page.activate_suffix",
          "to include its words in Learn, Test, and the review queue.",
        )}
      </div>
    </div>
  );
}

// The full list of words this deck covers, term and translation side by
// side — not the collapsed "known words only" reveal `LanguageDeckWords` shows
// elsewhere (e.g. the course home page's deck cards), since the point of
// opening a deck is to see everything it contains, mastered or not.
function DeckWordList({ words, t }: { words: LanguageDeckWordSummary[]; t: TFunction }) {
  if (words.length === 0) {
    return <p className="mt-4 text-sm text-sumi-soft">{t("deck_page.no_words", "No words yet.")}</p>;
  }

  return (
    <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {words.map((word) => (
        <li
          key={word.id}
          className={`flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
            word.known ? "bg-matcha-soft/40" : "bg-washi"
          }`}
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
  );
}

function DeckProgress({ deck, t }: { deck: LanguageDeckSummary; t: TFunction }) {
  const complete = deck.totalWords > 0 && deck.knownWords === deck.totalWords;
  const learntPercent =
    deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
  const knownPercent =
    deck.totalWords > 0 ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div>
        <p className="text-sm text-sumi-soft">
          {t("deck_page.learnt_progress", "{{learnt}} / {{total}} learnt", {
            learnt: deck.learntWords,
            total: deck.totalWords,
          })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={deck.totalWords}
          aria-valuenow={deck.learntWords}
          aria-label={t("deck_page.learnt_aria", "{{title}} learnt", { title: deck.title })}
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
            ? t("deck_page.all_known", "All known")
            : t("deck_page.known_progress", "{{known}} / {{total}} known", {
                known: deck.knownWords,
                total: deck.totalWords,
              })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={deck.totalWords}
          aria-valuenow={deck.knownWords}
          aria-label={t("deck_page.known_aria", "{{title}} known", { title: deck.title })}
          className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
        >
          <div
            className="h-full rounded-full bg-matcha transition-[width]"
            style={{ width: `${knownPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
