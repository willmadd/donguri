import type { Metadata } from "next";
import Link from "next/link";
import { getCourseHome, getTestQueueForCourse, requireProfile } from "@/lib/dal";
import { TestSession } from "@/components/vocab/test-session";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseHome(slug);
  return { title: `Test — ${course.title}` };
}

export default async function TestPage({ params }: PageProps) {
  const { slug } = await params;

  const [{ course }, quiz, profile, { t }] = await Promise.all([
    getCourseHome(slug),
    getTestQueueForCourse(slug),
    requireProfile(),
    getTranslator(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
    { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
    { href: `/dashboard/courses/${slug}`, label: course.title },
    { label: t("test_page.breadcrumb_test", "Test") },
  ];

  if (quiz.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-xl font-semibold text-ai-dark">
            !
          </span>
          <h1 className="text-xl font-semibold text-sumi">
            {t("test_page.nothing_to_test", "Nothing to test yet")}
          </h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            {t(
              "test_page.learn_first",
              "Learn a few words or grammar points first — they'll show up here for review.",
            )}
          </p>
          <Button href={`/dashboard/courses/${slug}/learn`} className="mt-2">
            {t("course_home.learn", "Learn")}
          </Button>
          <Link
            href={`/dashboard/courses/${slug}`}
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
      <TestSession
        quiz={quiz}
        courseSlug={slug}
        initialXp={profile.xp}
        initialDonguriConfig={profile.donguriConfig}
      />
    </div>
  );
}
