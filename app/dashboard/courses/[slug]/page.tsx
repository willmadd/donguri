import type { Metadata } from "next";
import Link from "next/link";
import {
  getCourseDecks,
  getDailyWordCounts,
  getLeaderboards,
  getReviewQueueDebug,
  getReviewQueueSummary,
  requireProfile,
} from "@/lib/dal";
import { StreakChart } from "@/components/vocab/streak-chart";
import { ResetProgressButton } from "@/components/vocab/reset-progress-button";
import { FindDeckModal } from "@/components/vocab/find-deck-modal";
import { ReviewQueueDevPanel } from "@/components/vocab/review-queue-dev-panel";
import { TopLeaderboardCard } from "@/components/leaderboard/top-leaderboard-card";
import { FriendsLeaderboardCard } from "@/components/leaderboard/friends-leaderboard-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";
import { Greeting } from "@/components/dashboard/greeting";

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
    dailyCounts,
    leaderboards,
    reviewQueue,
    profile,
  ] = await Promise.all([
    getCourseDecks(slug),
    getDailyWordCounts(slug),
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
          <Link
            href={`/dashboard/courses/${slug}/review`}
            className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-102 hover:brightness-105"
            style={{ backgroundImage: "url(/images/red-bg.webp)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-sumi/70 via-sumi/20 to-transparent" />
            <div className="relative">
              <h2 className="text-xl font-semibold text-washi">
                {reviewQueue.dueCount === 1
                  ? t(
                      "course_home.review_title_singular",
                      "Review {{count}} word",
                      { count: reviewQueue.dueCount },
                    )
                  : t("course_home.review_title", "Review {{count}} words", {
                      count: reviewQueue.dueCount,
                    })}
              </h2>
              <p className="mt-2 text-sm text-washi/80">
                {t(
                  "course_home.review_subtitle",
                  "Keep it fresh — strengthen your memory with a quick review.",
                )}
              </p>
            </div>
            <img
              src="/images/rabbit-flash.webp"
              alt="Coming Soon"
              className="absolute h-28 right-4 top-4"
            />
          </Link>

          <Link
            href={`/dashboard/courses/${slug}/learn`}
            className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl border border-card-border bg-cover bg-center p-6 transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-102 hover:brightness-105"
            style={{ backgroundImage: "url(/images/blue-bg.webp)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-sumi/70 via-sumi/20 to-transparent" />
            <div className="relative">
              <h2 className="text-xl font-semibold text-washi">
                {t("course_home.learn_title", "Learn new words")}
              </h2>
              <p className="mt-2 text-sm text-washi/80">
                {t(
                  "course_home.learn_subtitle",
                  "Build your vocabulary and grammar with your active decks.",
                )}
              </p>
            </div>
            <img
              src="/images/rabbit-reading.webp"
              alt="Coming Soon"
              className="absolute h-28 right-4 top-4"
            />
          </Link>
        </div>

        <StreakChart data={dailyCounts} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopLeaderboardCard entries={leaderboards.top} />
          <FriendsLeaderboardCard initialFriends={leaderboards.friends} />
        </div>

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
      <div>
        <FindDeckModal
          slug={slug}
          decks={decks}
          activeDeckIds={activeDeckIds}
        />
      </div>
    </div>
  );
}
