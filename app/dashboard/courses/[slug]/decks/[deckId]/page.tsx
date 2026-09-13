import type { Metadata } from "next";
import Link from "next/link";
import { getDeckDetail } from "@/lib/dal";
import { LessonWords } from "@/components/vocab/lesson-words";
import { BackLink } from "@/components/ui/back-link";

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
  const { course, deck } = await getDeckDetail(slug, deckId);

  const complete = deck.totalWords > 0 && deck.knownWords === deck.totalWords;
  const learntPercent =
    deck.totalWords > 0 ? Math.round((deck.learntWords / deck.totalWords) * 100) : 0;
  const knownPercent =
    deck.totalWords > 0 ? Math.round((deck.knownWords / deck.totalWords) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href={`/dashboard/courses/${slug}`} label={course.title} />
        <h1 className="text-2xl font-semibold text-sumi">{deck.title}</h1>
      </div>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-soft text-lg font-semibold text-matcha-dark">
            文
          </span>
          <h2 className="font-semibold text-sumi">Grammar</h2>
        </div>
        <p className="mt-3 text-sm text-sumi-soft">
          Grammar notes for this deck are coming soon.
        </p>
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
      </section>
    </div>
  );
}
