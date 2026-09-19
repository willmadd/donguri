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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/courses", label: "Courses" },
            { label: course.title },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-sumi">{course.title}</h1>
          {isAdmin && reviewQueueDebug && (
            <ReviewQueueDevPanel entries={reviewQueueDebug} />
          )}
        </div>
        {course.description && (
          <p className="mt-1 text-sumi-soft">{course.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-soft text-lg font-semibold text-ai-dark">
              語
            </span>
            <h2 className="font-semibold text-sumi">Vocabulary</h2>
          </div>
          <p className="mt-3 text-sm text-sumi-soft">
            Learn and test words from your active decks below.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/dashboard/courses/${slug}/learn/vocab`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
            >
              Learn
            </Link>
            {/* <Link
              href={`/dashboard/courses/${slug}/test/vocab`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
            >
              Test yourself
            </Link> */}
          </div>
        </section>

        <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-soft text-lg font-semibold text-matcha-dark">
              文
            </span>
            <h2 className="font-semibold text-sumi">Grammar</h2>
          </div>
          <p className="mt-3 text-sm text-sumi-soft">
            Learn and test grammar points from your active decks below.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/dashboard/courses/${slug}/learn/grammar`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-matcha px-6 font-medium text-washi transition hover:bg-matcha-dark"
            >
              Learn
            </Link>
            {/* <Link
              href={`/dashboard/courses/${slug}/test/grammar`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
            >
              Test yourself
            </Link> */}
          </div>
        </section>

        <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sakura-soft text-lg font-semibold text-sakura-dark">
              復
            </span>
            <h2 className="font-semibold text-sumi">Review queue</h2>
          </div>

          {reviewQueue.dueCount > 0 ? (
            <>
              <p className="mt-3 text-sm text-sumi-soft">
                {reviewQueue.dueCount} word{reviewQueue.dueCount === 1 ? "" : "s"}{" "}
                due for review across this course — vocabulary and grammar
                together.
              </p>
              <Link
                href={`/dashboard/courses/${slug}/review`}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-sakura px-6 font-medium text-washi transition hover:bg-sakura-dark"
              >
                Start review
              </Link>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-matcha/20 bg-matcha-soft/50 p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha text-sm font-semibold text-washi"
                >
                  ✓
                </span>

                <div>
                  <p className="font-medium text-sumi">
                    Well done — your review queue is empty!
                  </p>
                  <p className="mt-1 text-sm text-sumi-soft">
                    Keep learning new words and they’ll appear here when
                    they’re ready to review.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <StreakChart data={dailyCounts} />

      <FindDeckModal slug={slug} decks={decks} activeDeckIds={activeDeckIds} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopLeaderboardCard entries={leaderboards.top} />
        <FriendsLeaderboardCard initialFriends={leaderboards.friends} />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <div>
          <h2 className="font-semibold text-sumi">Start over</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            Clears all progress and streaks for this course only.
          </p>
        </div>
        <ResetProgressButton courseId={course.id} />
      </div>
    </div>
  );
}
