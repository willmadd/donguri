import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCourseHome, getPracticeQueue } from "@/lib/dal";
import { PracticeSession } from "@/components/vocab/practice-session";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lessonId?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseHome(slug);
  return { title: `Practice — ${course.title}` };
}

export default async function CoursePracticePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { lessonId } = await searchParams;

  if (!lessonId) {
    redirect(`/dashboard/courses/${slug}/vocab`);
  }

  const queue = await getPracticeQueue(slug, lessonId);

  if (queue.reveals.length === 0 && queue.quiz.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href={`/dashboard/courses/${slug}/vocab`} label="Vocabulary" />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-xl font-semibold text-ai-dark">
            ✓
          </span>
          <h1 className="text-xl font-semibold text-sumi">
            You&apos;ve mastered every word here
          </h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            There&apos;s nothing left to practice in this category right now —
            check back once more lessons are added.
          </p>
          <Link
            href={`/dashboard/courses/${slug}/vocab`}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
          >
            Back to vocabulary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/dashboard/courses/${slug}/vocab`} label="Vocabulary" />
      <PracticeSession reveals={queue.reveals} quiz={queue.quiz} courseSlug={slug} />
    </div>
  );
}
