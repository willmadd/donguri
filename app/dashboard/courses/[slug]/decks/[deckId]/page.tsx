import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCanonicalDeckId, getDeckDetail, getGrammarDeck, getReviewQueueSummary } from "@/lib/dal";
import { LessonWords } from "@/components/vocab/lesson-words";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { LessonSummary } from "@/lib/definitions";

type PageProps = {
  params: Promise<{ slug: string; deckId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, deckId } = await params;
  const { course, deck } = await getDeckDetail(slug, deckId);
  return { title: `${deck.title} — ${course.title}` };
}

export default async function DeckPage({ params }: PageProps) {
  const { slug, deckId } = await params;

  // A grammar lesson's own id (e.g. reached via a grammar practice
  // session's "back to deck" link) isn't itself a deck page — it's a
  // section within its vocab sibling's — so land there instead.
  const canonicalDeckId = await getCanonicalDeckId(slug, deckId);
  if (canonicalDeckId !== deckId) {
    redirect(`/dashboard/courses/${slug}/decks/${canonicalDeckId}`);
  }

  const [{ course, deck }, grammarDeck, reviewQueue] = await Promise.all([
    getDeckDetail(slug, deckId),
    getGrammarDeck(slug, deckId),
    getReviewQueueSummary(slug, deckId),
  ]);

  const complete = deck.totalWords > 0 && deck.knownWords === deck.totalWords;
  const learntPercent =
    deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
  const knownPercent =
    deck.totalWords > 0 ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;

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
            <LessonWords words={grammarDeck.words} />
            <PracticeButtons slug={slug} deckId={grammarDeck.id} />
          </>
        ) : (
          <p className="mt-3 text-sm text-sumi-soft">Grammar notes for this deck are coming soon.</p>
        )}
      </section>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-soft text-lg font-semibold text-ai-dark">
            語
          </span>
          <h2 className="font-semibold text-sumi">Vocabulary</h2>
        </div>

        <div className="mt-4 flex flex-col gap-2">
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
        <PracticeButtons slug={slug} deckId={deckId} />
      </section>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sakura-soft text-lg font-semibold text-sakura-dark">
            復
          </span>
          <h2 className="font-semibold text-sumi">Review queue</h2>
        </div>

        {reviewQueue.dueCount > 0 ? (
          <>
            <p className="mt-3 text-sm text-sumi-soft">
              {reviewQueue.dueCount} word{reviewQueue.dueCount === 1 ? "" : "s"} due for review
              {grammarDeck ? " — vocabulary and grammar together." : "."}
            </p>
            <Link
              href={`/dashboard/courses/${slug}/decks/${deckId}/review`}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-sakura px-6 font-medium text-washi transition hover:bg-sakura-dark"
            >
              Start review
            </Link>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-matcha/20 bg-matcha-soft/50 p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha text-sm font-semibold text-washi"
              >
                ✓
              </span>

              <div>
                <p className="font-medium text-sumi">Well done — your review queue is empty!</p>
                <p className="mt-1 text-sm text-sumi-soft">
                  Keep learning new words and they’ll appear here when they’re ready to review.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
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
          {deck.learntWords} / {deck.totalWords} points learnt
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={deck.totalWords}
          aria-valuenow={deck.learntWords}
          aria-label={`${deck.title} points learnt`}
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
          {complete ? "All points known" : `${deck.knownWords} / ${deck.totalWords} points known`}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={deck.totalWords}
          aria-valuenow={deck.knownWords}
          aria-label={`${deck.title} points known`}
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

function PracticeButtons({ slug, deckId }: { slug: string; deckId: string }) {
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <Link
        href={`/dashboard/courses/${slug}/decks/${deckId}/learn`}
        className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
      >
        Learn
      </Link>
      <Link
        href={`/dashboard/courses/${slug}/decks/${deckId}/test`}
        className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
      >
        Test yourself
      </Link>
    </div>
  );
}
