import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  getCourseDecks,
  getDailyActivityCounts,
  getGlobalStreak,
  getLeaderboards,
  getReviewQueueDebug,
  getReviewQueueSummary,
  requireProfile,
} from "@/lib/dal";
import { getTranslator } from "@/lib/i18n/server";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

import { ActivityOverviewCard } from "@/components/vocab/activity-overview-card";
import { Greeting } from "@/components/dashboard/greeting";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { FindDeckModal } from "@/components/vocab/find-deck-modal";
import { ResetProgressButton } from "@/components/vocab/reset-progress-button";
import { ReviewQueueDevPanel } from "@/components/vocab/review-queue-dev-panel";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseDecks(slug);

  return {
    title: `${course.title} — Donguri`,
  };
}

export default async function CourseHomePage({ params }: PageProps) {
  const { slug } = await params;

  const [
    { course, decks, activeDeckIds },
    { currentStreak, longestStreak, activeToday },
    dailyActivity,
    leaderboards,
    reviewQueue,
    profile,
  ] = await Promise.all([
    getCourseDecks(slug),
    getGlobalStreak(),
    getDailyActivityCounts(slug),
    getLeaderboards(),
    getReviewQueueSummary(slug),
    requireProfile(),
  ]);

  const equippedAccessory = (parseDonguriConfig(profile.donguriConfig)
    .equippedAccessory ?? null) as AccessoryId | null;

  const isAdmin = profile.role === "admin";
  const reviewQueueDebug = isAdmin ? await getReviewQueueDebug(slug) : null;

  const { t } = await getTranslator();

  const hasReviews = reviewQueue.dueCount > 0;
  const reviewCardContent = (
    <>
      {hasReviews && (
        <div className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-red-100/95 shadow-sm backdrop-blur-sm transition-transform group-hover:translate-x-1">
          <ArrowRight className="h-5 w-5 text-red-600" />
        </div>
      )}

      <div className="relative z-10 max-w-[65%] sm:max-w-[60%]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100/95 text-2xl font-bold leading-none text-red-600 shadow-sm backdrop-blur-sm">
            復
          </div>

          <span className="text-sm font-bold uppercase tracking-[0.2em] text-washi/90">
            {t("course_home.review_label", "Review")}
          </span>
        </div>

        <h2 className="mt-4 text-3xl font-bold leading-tight text-washi">
          {!hasReviews
            ? t("course_home.review_empty_title", "You're all caught up!")
            : reviewQueue.dueCount === 1
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

        <p className="mt-2 text-sm leading-relaxed text-washi/85">
          {!hasReviews
            ? t(
                "course_home.review_empty_subtitle",
                "Come back soon to review what you've learned, or learn new words to add to your review queue.",
              )
            : t(
                "course_home.review_subtitle",
                "Keep it fresh. Strengthen your memory with a quick review.",
              )}
        </p>
      </div>

      <img
        src="/images/rabbit-flash.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-2 z-0 h-28 select-none object-contain transition-transform duration-300 group-hover:-translate-y-1"
      />
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <main className="flex min-w-0 flex-col gap-8">
        <div>
          <Greeting firstName={profile.first_name ?? profile.email} />

          {isAdmin && reviewQueueDebug && (
            <div className="mt-4">
              <ReviewQueueDevPanel entries={reviewQueueDebug} />
            </div>
          )}
        </div>

        {/* Primary learning actions */}
        <section className="rounded-3xl border border-card-border bg-washi-soft p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* REVIEW */}
            {hasReviews ? (
              <Link
                href={`/dashboard/courses/${slug}/review`}
                className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 shadow-sm transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.015] hover:brightness-105 hover:shadow-md"
                style={{ backgroundImage: "url(/images/red-bg.webp)" }}
              >
                {reviewCardContent}
              </Link>
            ) : (
              <div
                className="pointer-events-none relative flex min-h-[240px] select-none flex-col overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 shadow-sm saturate-75"
                style={{ backgroundImage: "url(/images/red-bg.webp)" }}
              >
                {reviewCardContent}
              </div>
            )}

            {/* LEARN */}
            <Link
              href={`/dashboard/courses/${slug}/learn`}
              className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 shadow-sm transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.015] hover:brightness-105 hover:shadow-md"
              style={{
                backgroundImage: "url(/images/blue-bg2.webp)",
              }}
            >
              <div className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/95 shadow-sm backdrop-blur-sm transition-transform group-hover:translate-x-1">
                <ArrowRight className="h-5 w-5 text-blue-700" />
              </div>

              <div className="relative z-10 max-w-[65%] sm:max-w-[60%]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100/95 text-2xl font-bold leading-none text-blue-700 shadow-sm backdrop-blur-sm">
                    学
                  </div>

                  <span className="text-sm font-bold uppercase tracking-[0.2em] text-washi/90">
                    {t("course_home.learn_label", "Learn")}
                  </span>
                </div>

                <h2 className="mt-4 text-3xl font-bold leading-tight text-washi">
                  {t("course_home.learn_title", "Learn new words")}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-washi/85">
                  {t(
                    "course_home.learn_subtitle_three",
                    "Each time you click Learn, you'll get 3 new words or grammar patterns from your active decks.",
                  )}
                </p>
              </div>

              <img
                src="/images/rabbit-reading.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 right-2 z-0 h-28 select-none object-contain transition-transform duration-300 group-hover:-translate-y-1"
              />
            </Link>

            {/* DAILY CHALLENGE */}
            <Link
              href={`/dashboard/courses/${slug}/daily-challenge`}
              className="group relative flex min-h-[112px] items-center overflow-hidden rounded-2xl border border-card-border bg-cover bg-center px-6 py-4 shadow-sm transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.015] hover:brightness-105 hover:shadow-md lg:col-span-2"
              style={{
                backgroundImage: "url(/images/green-bg.webp)",
              }}
            >
              <div className="relative z-10 flex max-w-[65%] items-center gap-3 sm:max-w-none">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100/95 text-2xl font-bold leading-none text-green-700 shadow-sm backdrop-blur-sm">
                  挑
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-washi/90">
                    {t("course_home.challenge_label", "Daily Challenge")}
                  </span>

                  <h2 className="mt-0.5 text-lg font-bold leading-tight text-washi">
                    {t("course_home.challenge_title", "Take today's challenge")}
                  </h2>
                </div>
              </div>

              <img
                src="/images/charles.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-2 right-20 z-0 h-[92%] select-none object-contain transition-transform duration-300 group-hover:-translate-y-1"
              />

              <div className="absolute right-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-green-100/95 shadow-sm backdrop-blur-sm transition-transform group-hover:translate-x-1">
                <ArrowRight className="h-5 w-5 text-green-700" />
              </div>
            </Link>
          </div>
        </section>

        <ActivityOverviewCard
          courseTitle={course.title}
          dailyActivity={dailyActivity}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          activeToday={activeToday}
          xp={profile.xp}
          equippedAccessory={equippedAccessory}
        />

        <div className="flex flex-col gap-4 rounded-2xl border border-card-border bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between">
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
      </main>

      <aside className="flex min-w-0 flex-col gap-6">
        <FindDeckModal
          slug={slug}
          decks={decks}
          activeDeckIds={activeDeckIds}
        />

        <LeaderboardTabs
          topEntries={leaderboards.top}
          initialFriends={leaderboards.friends}
        />
      </aside>
    </div>
  );
}
