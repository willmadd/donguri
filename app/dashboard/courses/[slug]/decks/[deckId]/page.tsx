import type { Metadata } from "next";
import Link from "next/link";
import { getDeckDetail } from "@/lib/dal";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DeckPreview } from "@/components/vocab/deck-preview";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string; deckId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, deckId } = await params;
  const { course, deck } = await getDeckDetail(slug, deckId);
  return { title: `${deck.title} — ${course.title}` };
}

// A per-deck stats/browse view — learnt progress and the full word list.
// Learning and testing are no longer deck-specific (see the course home
// page's "active decks" selection and lib/dal.ts's getLearnQueueForCourse):
// add this deck to your word list there to have its words included, rather
// than clicking a Learn button here. The deck list's Preview button shows
// the same content in a modal; the logged-out equivalent lives at
// app/courses/[slug]/decks/[deckId].
export default async function DeckPage({ params }: PageProps) {
  const { slug, deckId } = await params;

  const [{ course, deck }, { t }] = await Promise.all([
    getDeckDetail(slug, deckId),
    getTranslator(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs
        items={[
          { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
          { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
          { href: `/dashboard/courses/${slug}`, label: course.title },
          { label: deck.title },
        ]}
      />

      <DeckPreview deck={deck} t={t} showProgress titleAs="h1" />

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
