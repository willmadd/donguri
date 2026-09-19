import type { Metadata } from "next";
import Link from "next/link";
import { getDeckDetail, getGrammarDeck } from "@/lib/dal";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { LessonSummary, LessonWordSummary } from "@/lib/definitions";

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
// a Learn button here.
export default async function DeckPage({ params }: PageProps) {
  const { slug, deckId } = await params;

  const [{ course, deck }, grammarDeck] = await Promise.all([
    getDeckDetail(slug, deckId),
    getGrammarDeck(slug, deckId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/courses", label: "Courses" },
            { href: `/dashboard/courses/${slug}`, label: course.title },
            { label: deck.title },
          ]}
        />
        <h1 className="text-2xl font-semibold text-sumi">{deck.title}</h1>
      </div>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-soft text-lg font-semibold text-matcha-dark">
            文
          </span>
          <h2 className="font-semibold text-sumi">Grammar</h2>
        </div>

        {grammarDeck ? (
          <>
            <DeckProgress deck={grammarDeck} />
            <DeckWordList words={grammarDeck.words} />
          </>
        ) : (
          <p className="mt-3 text-sm text-sumi-soft">Grammar notes for this deck are coming soon.</p>
        )}
      </section>

      <DeckVocabularySection deck={deck} />

      <div className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 text-sm text-sumi-soft">
        Activate this deck on the{" "}
        <Link href={`/dashboard/courses/${slug}`} className="font-medium text-ai-dark hover:underline">
          course page
        </Link>{" "}
        to include its words in Learn, Test, and the review queue.
      </div>
    </div>
  );
}

function DeckVocabularySection({ deck }: { deck: LessonSummary }) {
  return (
    <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-soft text-lg font-semibold text-ai-dark">
          語
        </span>
        <h2 className="font-semibold text-sumi">Vocabulary</h2>
      </div>

      <DeckProgress deck={deck} />
      <DeckWordList words={deck.words} />
    </section>
  );
}

// The full list of words this deck covers, term and translation side by
// side — not the collapsed "known words only" reveal `LessonWords` shows
// elsewhere (e.g. the course home page's deck cards), since the point of
// opening a deck is to see everything it contains, mastered or not.
function DeckWordList({ words }: { words: LessonWordSummary[] }) {
  if (words.length === 0) {
    return <p className="mt-4 text-sm text-sumi-soft">No words yet.</p>;
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

function DeckProgress({ deck }: { deck: LessonSummary }) {
  const complete = deck.totalWords > 0 && deck.knownWords === deck.totalWords;
  const learntPercent =
    deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
  const knownPercent =
    deck.totalWords > 0 ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div>
        <p className="text-sm text-sumi-soft">
          {deck.learntWords} / {deck.totalWords} learnt
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={deck.totalWords}
          aria-valuenow={deck.learntWords}
          aria-label={`${deck.title} learnt`}
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
          {complete ? "All known" : `${deck.knownWords} / ${deck.totalWords} known`}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={deck.totalWords}
          aria-valuenow={deck.knownWords}
          aria-label={`${deck.title} known`}
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
