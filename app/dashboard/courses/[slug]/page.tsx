import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  getCourseDecks,
  getDailyActivityCounts,
  getDailyChallengeStatus,
  getGlobalStreak,
  getWeeklyStats,
  getLeaderboards,
  getReviewQueueDebug,
  getReviewQueueSummary,
  requireProfile,
} from "@/lib/dal";
import { getTranslator } from "@/lib/i18n/server";

import { ActivityOverviewCard } from "@/components/vocab/activity-overview-card";
import { Greeting } from "@/components/dashboard/greeting";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { DeckCompleteCelebration } from "@/components/vocab/deck-complete-celebration";
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
    weeklyStats,
    challengeStatus,
  ] = await Promise.all([
    getCourseDecks(slug),
    getGlobalStreak(),
    getDailyActivityCounts(slug),
    getLeaderboards(),
    getReviewQueueSummary(slug),
    requireProfile(),
    getWeeklyStats(slug),
    getDailyChallengeStatus(slug),
  ]);

  const isAdmin = profile.role === "admin";
  const reviewQueueDebug = isAdmin ? await getReviewQueueDebug(slug) : null;

  const { t } = await getTranslator();

  const hasReviews = reviewQueue.dueCount > 0;
  const challengesLeft = Math.max(
    challengeStatus.maxAttemptsPerDay - challengeStatus.attemptsToday,
    0,
  );
  const reviewCardContent = (
    <>
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100/95 text-2xl font-bold leading-none text-red-600 shadow-sm backdrop-blur-sm">
            復
            <CountBadge count={reviewQueue.dueCount} />
          </div>

          <span className="text-sm font-bold uppercase tracking-[0.2em] text-ink-on-dark/90">
            {t("course_home.review_label", "Review")}
          </span>
        </div>

        <h2 className="mt-4 text-3xl font-extrabold leading-tight text-ink-on-dark">
          {!hasReviews
            ? t("course_home.review_empty_title", "You're all caught up!")
            : reviewQueue.dueCount === 1
              ? t("course_home.review_title_singular", "{{count}} word due", {
                  count: reviewQueue.dueCount,
                })
              : t("course_home.review_title", "{{count}} words due", {
                  count: reviewQueue.dueCount,
                })}
        </h2>

        <p className="mt-2 max-w-[65%] text-sm leading-relaxed sm:max-w-[60%] text-ink-on-dark/85">
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

      {hasReviews && (
        <div className="relative z-10 mt-auto pt-5">
          <FakeButton className="bg-red-100/95 text-red-700">
            {reviewQueue.dueCount === 1
              ? t("course_home.review_cta_singular", "Review {{count}} word", {
                  count: reviewQueue.dueCount,
                })
              : t("course_home.review_cta", "Review {{count}} words", {
                  count: reviewQueue.dueCount,
                })}
          </FakeButton>
        </div>
      )}

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
      <DeckCompleteCelebration slug={slug} decks={decks} />

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
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100/95 text-2xl font-bold leading-none text-blue-700 shadow-sm backdrop-blur-sm">
                    学
                  </div>

                  <span className="text-sm font-bold uppercase tracking-[0.2em] text-ink-on-dark/90">
                    {t("course_home.learn_label", "Learn")}
                  </span>
                </div>

                <h2 className="mt-4 text-3xl font-extrabold leading-tight text-ink-on-dark">
                  {t("course_home.learn_title", "Learn new words")}
                </h2>

                <p className="mt-2 max-w-[65%] text-sm leading-relaxed sm:max-w-[60%] text-ink-on-dark/85">
                  {t(
                    "course_home.learn_subtitle_three",
                    "Learn 3 new words or grammar patterns from your active decks.",
                  )}
                </p>
              </div>

              <div className="relative z-10 mt-auto pt-5">
                <FakeButton className="bg-blue-100/95 text-blue-700">
                  {t("course_home.learn_cta", "Learn 3 new words")}
                </FakeButton>
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
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100/95 text-2xl font-bold leading-none text-green-700 shadow-sm backdrop-blur-sm">
                  挑
                  <CountBadge count={challengesLeft} />
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink-on-dark/90">
                    {t("course_home.challenge_label", "Daily Challenge")}
                  </span>

                  <h2 className="mt-0.5 text-lg font-bold leading-tight text-ink-on-dark">
                    {challengesLeft === 0
                      ? t(
                          "course_home.challenge_done_title",
                          "All done for today",
                        )
                      : challengesLeft === 1
                        ? t(
                            "course_home.challenge_title_singular",
                            "{{count}} challenge left",
                            { count: challengesLeft },
                          )
                        : t(
                            "course_home.challenge_title",
                            "{{count}} challenges left",
                            { count: challengesLeft },
                          )}
                  </h2>
                </div>
              </div>

              <img
                src="/images/charles.webp"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-2 right-20 z-0 h-[92%] select-none object-contain transition-transform duration-300 group-hover:-translate-y-1 sm:right-56"
              />

              <div className="absolute right-5 top-1/2 z-20 -translate-y-1/2">
                <FakeButton
                  className="bg-green-100/95 text-green-700"
                  labelClassName="hidden sm:inline"
                >
                  {challengesLeft === 0
                    ? t("course_home.challenge_done_cta", "View challenge")
                    : t("course_home.challenge_cta", "Start challenge")}
                </FakeButton>
              </div>
            </Link>
          </div>
        </section>

        <ActivityOverviewCard
          dailyActivity={dailyActivity}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          activeToday={activeToday}
          weeklyStats={weeklyStats}
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

// Button-styled label inside a card link. Rendered as a span because the
// whole card is already the link, and nesting a real <button> in an <a> is invalid.
function FakeButton({
  children,
  className,
  labelClassName,
}: {
  children: React.ReactNode;
  className: string;
  labelClassName?: string;
}) {
  return (
    <span
      className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-sm backdrop-blur-sm transition-[gap] group-hover:gap-3 ${className}`}
    >
      <span className={labelClassName}>{children}</span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </span>
  );
}

// Notification-style count bubble pinned to the corner of a card's icon chip.
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-none text-white shadow-sm ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
