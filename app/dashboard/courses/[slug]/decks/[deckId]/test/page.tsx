import type { Metadata } from "next";
import Link from "next/link";
import { getDeckDetail, getTestQueue } from "@/lib/dal";
import { TestSession } from "@/components/vocab/test-session";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ slug: string; deckId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, deckId } = await params;
  const { course, deck } = await getDeckDetail(slug, deckId);
  return { title: `Test yourself — ${deck.title} — ${course.title}` };
}

export default async function TestPage({ params }: PageProps) {
  const { slug, deckId } = await params;
  const { deck } = await getDeckDetail(slug, deckId);
  const quiz = await getTestQueue(slug, deckId);

  if (quiz.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href={`/dashboard/courses/${slug}/decks/${deckId}`} label={deck.title} />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-xl font-semibold text-ai-dark">
            !
          </span>
          <h1 className="text-xl font-semibold text-sumi">Nothing to test yet</h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            Learn a few words first — they&apos;ll show up here for review.
          </p>
          <Link
            href={`/dashboard/courses/${slug}/decks/${deckId}/learn`}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
          >
            Learn
          </Link>
          <Link
            href={`/dashboard/courses/${slug}/decks/${deckId}`}
            className="text-sm font-medium text-sumi-soft transition hover:text-sumi"
          >
            Back to deck
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/dashboard/courses/${slug}/decks/${deckId}`} label={deck.title} />
      <TestSession quiz={quiz} courseSlug={slug} deckId={deckId} />
    </div>
  );
}
