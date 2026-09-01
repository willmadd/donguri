import type { Metadata } from "next";
import Link from "next/link";
import { getCourseVocabOverview } from "@/lib/dal";
import { skipLesson } from "@/lib/actions/vocab";
import { ResetProgressButton } from "@/components/vocab/reset-progress-button";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseVocabOverview(slug);
  return { title: `Vocabulary — ${course.title}` };
}

export default async function CourseVocabPage({ params }: PageProps) {
  const { slug } = await params;
  const { course, lessons } = await getCourseVocabOverview(slug);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-sumi">Vocabulary</h1>
        <p className="mt-1 text-sumi-soft">
          {course.title} — pick a category to practice.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {lessons.map((lesson) => {
          const complete = lesson.totalWords > 0 && lesson.knownWords === lesson.totalWords;

          return (
            <div
              key={lesson.id}
              className="flex flex-col gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="font-semibold text-sumi">{lesson.title}</h2>
                <p className="mt-1 text-sm text-sumi-soft">
                  {complete
                    ? "All words known"
                    : `${lesson.knownWords} / ${lesson.totalWords} words known`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!complete && (
                  <form action={skipLesson.bind(null, lesson.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-sumi/15 px-4 py-2 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
                    >
                      Skip — I know this
                    </button>
                  </form>
                )}
                <Link
                  href={`/dashboard/courses/${slug}/vocab/practice?lessonId=${lesson.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-ai px-4 text-sm font-medium text-washi transition hover:bg-ai-dark"
                >
                  Practice
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
