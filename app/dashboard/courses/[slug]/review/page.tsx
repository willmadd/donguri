import type { Metadata } from "next";
import Link from "next/link";
import { getCourseHome, getCourseTitle, getReviewQueue, requireProfile } from "@/lib/dal";
import { ReviewSession } from "@/components/vocab/review-session";
import { FreshSession } from "@/components/vocab/fresh-session";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Review — ${await getCourseTitle(slug)}` };
}

export default async function CourseReviewPage({ params }: PageProps) {
  const { slug } = await params;
  const [{ course }, quiz, profile, { t }] = await Promise.all([
    getCourseHome(slug),
    getReviewQueue(slug),
    requireProfile(),
    getTranslator(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
    { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
    { href: `/dashboard/courses/${slug}`, label: course.title, prefetch: true },
    { label: t("review_session.review", "Review") },
  ];

  if (quiz.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-soft text-xl font-semibold text-matcha-dark">
            ✓
          </span>
          <h1 className="text-xl font-semibold text-sumi">
            {t("review_page.nothing_due", "Nothing due right now")}
          </h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            {t(
              "review_page.nothing_due_subtitle",
              "Words show up here on their own schedule as they're due for review — from every deck in this course.",
            )}
          </p>
          <Link
            href={`/dashboard/courses/${slug}`}
            prefetch
            className="mt-2 text-sm font-medium text-sumi-soft transition hover:text-sumi"
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
        <ReviewSession
          quiz={quiz}
          courseSlug={slug}
          initialXp={profile.xp}
          initialDonguriConfig={profile.donguriConfig}
        />
      </FreshSession>
    </div>
  );
}
