import type { Metadata } from "next";
import Link from "next/link";
import {
  getCourseDecks,
  getCourseHome,
  getDailyActivityCounts,
  getLeaderboards,
  getReviewQueueDebug,
  getReviewQueueSummary,
  requireProfile,
} from "@/lib/dal";
import { StreakChart } from "@/components/vocab/streak-chart";
import { ResetProgressButton } from "@/components/vocab/reset-progress-button";
import { FindDeckModal } from "@/components/vocab/find-deck-modal";
import { ReviewQueueDevPanel } from "@/components/vocab/review-queue-dev-panel";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";
import { Greeting } from "@/components/dashboard/greeting";
import { ArrowRight, ArrowRightCircle } from "lucide-react";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseDecks(slug);
  return { title: `${course.title} — Donguri` };
}

export default async function CourseHomePage({ params }: PageProps) {
  const { slug } = await params;
  const [
    { course, decks, activeDeckIds },
    { currentStreak },
    dailyActivity,
    leaderboards,
    reviewQueue,
    profile,
  ] = await Promise.all([
    getCourseDecks(slug),
    getCourseHome(slug),
    getDailyActivityCounts(slug),
    getLeaderboards(),
    getReviewQueueSummary(slug),
    requireProfile(),
  ]);

  const isAdmin = profile.role === "admin";
  const reviewQueueDebug = isAdmin ? await getReviewQueueDebug(slug) : null;
  const { t } = await getTranslator();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-8">
        <div>
          {/* <Breadcrumbs
          items={[
            {
              href: "/dashboard",
              label: t("breadcrumbs.dashboard", "Dashboard"),
            },
            {
              href: "/dashboard/courses",
              label: t("breadcrumbs.courses", "Courses"),
            },
            { label: course.title },
          ]}
        /> */}
          {/* <div className="flex flex-wrap items-center justify-between gap-3">
          <PageTitle>{course.title}</PageTitle>
          {isAdmin && reviewQueueDebug && (
            <ReviewQueueDevPanel entries={reviewQueueDebug} />
          )}
        </div>
        {course.description && (
          <PageSubtitle>{course.description}</PageSubtitle>
        )} */}
          <Greeting firstName={profile.first_name ?? profile.email} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* REVIEW */}
          <Link
            href={`/dashboard/courses/${slug}/review`}
            className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-102 hover:brightness-105"
            style={{ backgroundImage: "url(/images/red-bg.webp)" }}
          >
            {/* arrow top-right */}
            <div className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-washi shadow-md transition group-hover:translate-x-1">
              <ArrowRight className="h-5 w-5 text-red-500" />
            </div>

            {/* text constrained to the left so it clears the mascot */}
            <div className="relative z-10 max-w-[60%]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-washi text-2xl font-bold leading-none text-red-500 shadow-sm">
                  復
                </div>
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-washi/90">
                  {t("course_home.review_label", "Review")}
                </span>
              </div>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-washi">
                {reviewQueue.dueCount === 1
                  ? t(
                      "course_home.review_title_singular",
                      "Review {{count}} word",
                      {
                        count: reviewQueue.dueCount,
                      },
                    )
                  : t("course_home.review_title", "Review {{count}} words", {
                      count: reviewQueue.dueCount,
                    })}
              </h2>
              <p className="mt-2 text-sm text-washi/85">
                {t(
                  "course_home.review_subtitle",
                  "Keep it fresh. Strengthen your memory with a quick review.",
                )}
              </p>
            </div>

            {/* mascot pinned bottom-right, out of the text column */}
            <img
              src="/images/rabbit-flash.webp"
              alt=""
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-2 z-0 h-28 object-contain"
            />
          </Link>

          {/* LEARN */}
          <Link
            href={`/dashboard/courses/${slug}/learn`}
            className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-102 hover:brightness-105"
            style={{ backgroundImage: "url(/images/blue-bg2.webp)" }}
          >
            {/* arrow top-right */}
            <div className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-washi shadow-md transition group-hover:translate-x-1">
              <ArrowRight className="h-5 w-5 text-blue-600" />
            </div>

            <div className="relative z-10 max-w-[60%]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-washi text-2xl font-bold leading-none text-blue-600 shadow-sm">
                  学
                </div>
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-washi/90">
                  {t("course_home.learn_label", "Learn")}
                </span>
              </div>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-washi">
                {t("course_home.learn_title", "Learn new words")}
              </h2>
              <p className="mt-2 text-sm text-washi/85">
                {t(
                  "course_home.learn_subtitle",
                  "Build your vocabulary and grammar with your active decks.",
                )}
              </p>
            </div>

            <img
              src="/images/rabbit-reading.webp"
              alt=""
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-2 z-0 h-28 object-contain"
            />
          </Link>
        </div>

        {/* DAILY CHALLENGE — full width, short */}
        <Link
          href={`/dashboard/courses/${slug}/daily-challenge`}
          className="group relative mt-4 flex min-h-[112px] items-center overflow-hidden rounded-2xl border border-card-border bg-cover bg-center px-6 transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-102 hover:brightness-105"
          style={{ backgroundImage: "url(/images/green-bg.webp)" }}
        >
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-washi text-2xl font-bold leading-none text-green-600 shadow-sm">
              挑
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-washi/90">
                {t("course_home.challenge_label", "Daily Challenge")}
              </span>
              <h2 className="text-lg font-bold leading-tight text-washi">
                {t("course_home.challenge_title", "Take today's challenge")}
              </h2>
            </div>
          </div>

          {/* mascot pinned right, before the arrow */}
          <img
            src="/images/charles.webp"
            alt=""
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-20 z-0 h-full object-contain"
          />

          {/* arrow right, vertically centered */}
          <div className="absolute right-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-washi shadow-md transition group-hover:translate-x-1">
            <ArrowRight className="h-5 w-5 text-green-600" />
          </div>
        </Link>
        <StreakChart data={dailyActivity} currentStreak={currentStreak} />

        <div className="flex items-center justify-between rounded-2xl border border-card-border bg-washi-soft p-6">
          <div>
            <h2 className="font-semibold text-sumi">
              {t("course_home.start_over", "Start over")}
            </h2>
            <p className="mt-1 text-sm text-sumi-soft">
              {t(
                "course_home.start_over_subtitle",
                "Clears all progress and streaks for this course only.",
              )}
            </p>
          </div>
          <ResetProgressButton courseId={course.id} />
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <FindDeckModal
          slug={slug}
          decks={decks}
          activeDeckIds={activeDeckIds}
        />
        <LeaderboardTabs
          topEntries={leaderboards.top}
          initialFriends={leaderboards.friends}
        />
      </div>
    </div>
  );
}
