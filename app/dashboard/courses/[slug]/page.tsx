import type { Metadata } from "next";
import Link from "next/link";
import { getCourseHome, getDailyWordCounts } from "@/lib/dal";
import { StreakChart } from "@/components/vocab/streak-chart";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseHome(slug);
  return { title: `${course.title} — Donguri` };
}

export default async function CourseHomePage({ params }: PageProps) {
  const { slug } = await params;
  const [{ course, currentStreak, longestStreak }, dailyCounts] = await Promise.all([
    getCourseHome(slug),
    getDailyWordCounts(slug),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/courses" label="Courses" />
        <h1 className="text-2xl font-semibold text-sumi">{course.title}</h1>
        {course.description && (
          <p className="mt-1 text-sumi-soft">{course.description}</p>
        )}
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-sakura-soft px-2 py-0.5 text-xs font-medium text-sakura-dark">
          🔥 {currentStreak} day streak
          <span className="text-sakura-dark/70">· best {longestStreak}</span>
        </span>
      </div>

      {dailyCounts.length > 0 ? (
        <StreakChart data={dailyCounts} />
      ) : (
        <div className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 text-center text-sm text-sumi-soft">
          Practice today to start a streak — this chart fills in as you go.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href={`/dashboard/courses/${slug}/vocab`}
          className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-soft text-lg font-semibold text-ai-dark">
            語
          </span>
          <h2 className="mt-4 font-semibold text-sumi">Vocabulary</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            Learn a few new words at a time and review what you&apos;ve
            started.
          </p>
        </Link>

        <Link
          href={`/dashboard/courses/${slug}/grammar`}
          className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-soft text-lg font-semibold text-matcha-dark">
            文
          </span>
          <h2 className="mt-4 font-semibold text-sumi">Grammar</h2>
          <p className="mt-1 text-sm text-sumi-soft">Coming soon.</p>
        </Link>
      </div>
    </div>
  );
}
