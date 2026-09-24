import type { Metadata } from "next";
import Link from "next/link";
import { getCourseHome, getCourseTitle, getLearnQueueForCourse } from "@/lib/dal";
import { LearnSession } from "@/components/vocab/learn-session";
import { FreshSession } from "@/components/vocab/fresh-session";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Learn — ${await getCourseTitle(slug)}` };
}

export default async function LearnPage({ params }: PageProps) {
  const { slug } = await params;

  const [{ course }, words, { t }] = await Promise.all([
    getCourseHome(slug),
    getLearnQueueForCourse(slug),
    getTranslator(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
    { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
    { href: `/dashboard/courses/${slug}`, label: course.title, prefetch: true },
    { label: t("learn_page.breadcrumb_learn", "Learn") },
  ];

  if (words.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-xl font-semibold text-ai-dark">
            ✓
          </span>
          <h1 className="text-xl font-semibold text-sumi">
            {t("learn_page.done", "You've learnt everything in your active decks")}
          </h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            {t(
              "learn_page.done_subtitle",
              "Activate more decks on the course page, or head over to Test yourself to keep these fresh.",
            )}
          </p>
          <Button href={`/dashboard/courses/${slug}/test`} className="mt-2">
            {t("learn_session.test_yourself", "Test yourself")}
          </Button>
          <Link
            href={`/dashboard/courses/${slug}`}
            prefetch
            className="text-sm font-medium text-sumi-soft transition hover:text-sumi"
          >
            {t("learn_session.back_to_course", "Back to course")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={breadcrumbItems} />
      <FreshSession>
        <LearnSession
          key={words.map((word) => word.id).join(",")}
          words={words}
          courseSlug={slug}
        />
      </FreshSession>
    </div>
  );
}
