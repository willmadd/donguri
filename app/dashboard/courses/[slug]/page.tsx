import type { Metadata } from "next";
import Link from "next/link";
import { getCourseDecks, getDailyWordCounts, getLeaderboards } from "@/lib/dal";
import { skipLesson } from "@/lib/actions/vocab";
import { StreakChart } from "@/components/vocab/streak-chart";
import { ResetProgressButton } from "@/components/vocab/reset-progress-button";
import { LessonWords } from "@/components/vocab/lesson-words";
import { TopLeaderboardCard } from "@/components/leaderboard/top-leaderboard-card";
import { FriendsLeaderboardCard } from "@/components/leaderboard/friends-leaderboard-card";
import { BackLink } from "@/components/ui/back-link";

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
  const [{ course, decks }, dailyCounts, leaderboards] = await Promise.all([
    getCourseDecks(slug),
    getDailyWordCounts(slug),
    getLeaderboards(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/courses" label="Courses" />
        <h1 className="text-2xl font-semibold text-sumi">{course.title}</h1>
        {course.description && (
          <p className="mt-1 text-sumi-soft">{course.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {<StreakChart data={dailyCounts} />}
        <TopLeaderboardCard entries={leaderboards.top} />
        <FriendsLeaderboardCard initialFriends={leaderboards.friends} />
      </div>

      <div className="flex flex-col gap-4">
        {decks.length === 0 && (
          <p className="text-sumi-soft">No decks yet — check back soon.</p>
        )}

        {decks.map((deck) => {
          const complete =
            deck.totalWords > 0 && deck.knownWords === deck.totalWords;
          const learntPercent =
            deck.totalWords > 0
              ? Math.round((deck.learntWords / deck.totalWords) * 100)
              : 0;
          const knownPercent =
            deck.totalWords > 0
              ? Math.round((deck.knownWords / deck.totalWords) * 100)
              : 0;

          return (
            <div
              key={deck.id}
              className="flex flex-col gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex-1">
                <Link
                  href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                  className="font-semibold text-sumi transition hover:text-ai"
                >
                  {deck.title}
                </Link>

                <div className="mt-2 flex flex-col gap-2">
                  <div>
                    <p className="text-sm text-sumi-soft">
                      {deck.learntWords} / {deck.totalWords} words learnt
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={deck.totalWords}
                      aria-valuenow={deck.learntWords}
                      aria-label={`${deck.title} words learnt`}
                      className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
                    >
                      <div
                        className="h-full rounded-full bg-ai transition-[width]"
                        style={{ width: `${learntPercent}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-sumi-soft">
                      {complete
                        ? "All words known"
                        : `${deck.knownWords} / ${deck.totalWords} words known`}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={deck.totalWords}
                      aria-valuenow={deck.knownWords}
                      aria-label={`${deck.title} words known`}
                      className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
                    >
                      <div
                        className="h-full rounded-full bg-matcha transition-[width]"
                        style={{ width: `${knownPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <LessonWords words={deck.words} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!complete && (
                  <form action={skipLesson.bind(null, deck.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-sumi/15 px-4 py-2 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
                    >
                      Skip — I know this
                    </button>
                  </form>
                )}
                <Link
                  href={`/dashboard/courses/${slug}/decks/${deck.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-ai px-4 text-sm font-medium text-washi transition hover:bg-ai-dark"
                >
                  Open deck
                </Link>
              </div>
            </div>
          );
        })}
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
