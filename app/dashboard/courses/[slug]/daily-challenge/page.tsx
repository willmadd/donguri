import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getCourseHome, getCourseTitle, getDailyChallenge, requireProfile } from "@/lib/dal";
import { DailyChallengeChat } from "@/components/vocab/daily-challenge-chat";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { getTranslator } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Daily challenge — ${await getCourseTitle(slug)}` };
}

// Private cache scope, like loadCourseHome on the course page: the session
// read and "today in UTC" both read the clock, which Cache Components only
// allows inside a cache scope during a (runtime) prerender. A finished
// attempt revalidates this path, which clears it outright, so the next
// target always shows up.
async function loadDailyChallenge(slug: string) {
  "use cache: private";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const [{ course }, challenge] = await Promise.all([
    getCourseHome(slug),
    getDailyChallenge(slug),
    requireProfile(),
  ]);

  return { courseTitle: course.title, challenge };
}

export default async function DailyChallengePage({ params }: PageProps) {
  const { slug } = await params;

  const [{ courseTitle, challenge }, { t }] = await Promise.all([
    loadDailyChallenge(slug),
    getTranslator(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
    { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
    { href: `/dashboard/courses/${slug}`, label: courseTitle, prefetch: true },
    { label: t("course_home.challenge_label", "Daily Challenge") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-matcha-soft text-3xl font-bold leading-none text-matcha-dark shadow-sm">
          挑
        </span>
        <h1 className="text-xl font-semibold text-sumi">
          {t("daily_challenge.title", "Today's challenge")}
        </h1>
      </div>

      {challenge.target ? (
        <DailyChallengeChat
          key={challenge.attemptsToday}
          courseSlug={slug}
          target={challenge.target}
          attemptsToday={challenge.attemptsToday}
          maxAttemptsPerDay={challenge.maxAttemptsPerDay}
        />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-card-border bg-washi-soft px-6 py-16 text-center">
          <p className="max-w-sm text-sm text-sumi-soft">
            {challenge.attemptsToday >= challenge.maxAttemptsPerDay
              ? t(
                  "daily_challenge.exhausted_subtitle",
                  "You've used all {{max}} attempts today — new ones unlock at midnight UTC.",
                  { max: challenge.maxAttemptsPerDay },
                )
              : t(
                  "daily_challenge.no_content",
                  "This course doesn't have any words or grammar to practise yet.",
                )}
          </p>
          <Button variant="secondary" href={`/dashboard/courses/${slug}`}>
            {t("daily_challenge.back_to_course", "Back to course")}
          </Button>
        </div>
      )}
    </div>
  );
}
