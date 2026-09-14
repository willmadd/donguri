import type { Metadata } from "next";
import Link from "next/link";
import { getDeckDetail, getTestQueue, requireProfile } from "@/lib/dal";
import { TestSession } from "@/components/vocab/test-session";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";

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
  const [{ course, deck }, quiz, profile] = await Promise.all([
    getDeckDetail(slug, deckId),
    getTestQueue(slug, deckId),
    requireProfile(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/courses", label: "Courses" },
    { href: `/dashboard/courses/${slug}`, label: course.title },
    { href: `/dashboard/courses/${slug}/decks/${deckId}`, label: deck.title },
    { label: "Test yourself" },
  ];

  if (quiz.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

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
      <Breadcrumbs items={breadcrumbItems} />
      <TestSession
        quiz={quiz}
        courseSlug={slug}
        deckId={deckId}
        initialXp={profile.xp}
        initialDonguriConfig={profile.donguriConfig}
      />
    </div>
  );
}
