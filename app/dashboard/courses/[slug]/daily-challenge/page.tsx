import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import {
  getCourseHome,
  getCourseTitle,
  getDailyChallenge,
  getDailyChallengeResults,
  requireProfile,
} from "@/lib/dal";
import { DailyChallenge } from "@/components/vocab/daily-challenge-chat";
import { firstNameOf, getChallengeOpener } from "@/lib/daily-challenge-opener";
import { getDailyChallengeReview } from "@/lib/daily-challenge-review";
import { DailyChallengeSummary } from "@/components/vocab/daily-challenge-summary";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { getTranslator } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

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

  const [{ course }, challenge, results, profile] = await Promise.all([
    getCourseHome(slug),
    getDailyChallenge(slug),
    getDailyChallengeResults(slug),
    requireProfile(),
  ]);
  const equippedAccessory = (parseDonguriConfig(profile.donguriConfig)
    .equippedAccessory ?? null) as AccessoryId | null;

  return {
    courseTitle: course.title,
    challenge,
    results,
    equippedAccessory,
    firstName: firstNameOf(profile.full_name),
  };
}

export default async function DailyChallengePage({ params }: PageProps) {
  const { slug } = await params;

  const [{ courseTitle, challenge, results, equippedAccessory, firstName }, { t }] = await Promise.all([
    loadDailyChallenge(slug),
    getTranslator(),
  ]);

  // Not awaited: the page renders straight away and the opener streams into
  // the chat, which shows Charles typing until it arrives.
  const openerPromise = challenge.target
    ? getChallengeOpener(challenge.target, firstName)
    : null;
  const isDayComplete = challenge.attemptsToday >= challenge.maxAttemptsPerDay;

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
    { href: "/dashboard/courses", label: t("breadcrumbs.courses", "Courses") },
    { href: `/dashboard/courses/${slug}`, label: courseTitle, prefetch: true },
    { label: t("course_home.challenge_label", "Daily Challenge") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Breadcrumbs items={breadcrumbItems} />

      <DailyChallenge
        courseSlug={slug}
        challenge={challenge}
        equippedAccessory={equippedAccessory}
        openerPromise={openerPromise}
        heading={
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-matcha-soft text-3xl font-bold leading-none text-matcha-dark shadow-sm">
              挑
            </span>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-bold text-sumi sm:text-3xl">
                {t("daily_challenge.title", "Today's challenge")}
              </h1>
              <p className="text-sm text-sumi-soft">
                {t(
                  "daily_challenge.instructions",
                  "Chat with Charles Duck and use the target naturally in one of your replies.",
                )}
              </p>
            </div>
          </div>
        }
        emptyState={
          isDayComplete ? (
            <DailyChallengeSummary
              courseSlug={slug}
              results={results}
              maxAttemptsPerDay={challenge.maxAttemptsPerDay}
              equippedAccessory={equippedAccessory}
              reviewPromise={getDailyChallengeReview(results)}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-card-border bg-washi-soft px-6 py-16 text-center">
              <p className="max-w-sm text-sm text-sumi-soft">
                {t(
                  "daily_challenge.no_content",
                  "This course doesn't have any words or grammar to practise yet.",
                )}
              </p>
              <Button variant="secondary" href={`/dashboard/courses/${slug}`}>
                {t("daily_challenge.back_to_course", "Back to course")}
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}
