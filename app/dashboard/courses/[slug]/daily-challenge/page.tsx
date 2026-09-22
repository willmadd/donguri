import type { Metadata } from "next";
import { getCourseHome, getDailyChallengeStatus, requireProfile } from "@/lib/dal";
import { DailyChallengeButton } from "@/components/vocab/daily-challenge-button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseHome(slug);
  return { title: `Daily challenge — ${course.title}` };
}

export default async function DailyChallengePage({ params }: PageProps) {
  const { slug } = await params;

  const [{ course }, status, , { t }] = await Promise.all([
    getCourseHome(slug),
    getDailyChallengeStatus(slug),
    requireProfile(),
    getTranslator(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
    { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
    { href: `/dashboard/courses/${slug}`, label: course.title },
    { label: t("course_home.challenge_label", "Daily Challenge") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col items-center gap-6 rounded-2xl border border-card-border bg-washi-soft px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-matcha-soft text-3xl font-bold leading-none text-matcha-dark shadow-sm">
          挑
        </span>

        <div>
          <h1 className="text-xl font-semibold text-sumi">
            {t("daily_challenge.title", "Today's challenge")}
          </h1>
          <p className="mt-1 max-w-sm text-sm text-sumi-soft">
            {t(
              "daily_challenge.subtitle",
              "A quick daily challenge to earn bonus XP, on top of learning and review.",
            )}
          </p>
        </div>

        <DailyChallengeButton
          courseSlug={slug}
          initialAttemptsToday={status.attemptsToday}
          maxAttemptsPerDay={status.maxAttemptsPerDay}
        />
      </div>
    </div>
  );
}
