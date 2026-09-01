import type { Metadata } from "next";
import Link from "next/link";
import { getCourseVocabOverview } from "@/lib/dal";
import { skipLesson } from "@/lib/actions/vocab";
import { ResetProgressButton } from "@/components/vocab/reset-progress-button";
import { LessonWords } from "@/components/vocab/lesson-words";

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
        <p className="mt-2 text-sm text-sumi-soft">
          A word is <span className="font-medium text-sumi">learnt</span> once you've
          been introduced to it, and becomes{" "}
          <span className="font-medium text-sumi">known</span> once you answer it
          correctly four times in a row during practice — getting it wrong sends it
          back to the start, so keep at it to lock words in.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {lessons.map((lesson) => {
          const complete = lesson.totalWords > 0 && lesson.knownWords === lesson.totalWords;
          const learntPercent =
            lesson.totalWords > 0
              ? Math.round((lesson.learntWords / lesson.totalWords) * 100)
              : 0;
          const knownPercent =
            lesson.totalWords > 0
              ? Math.round((lesson.knownWords / lesson.totalWords) * 100)
              : 0;

          return (
            <div
              key={lesson.id}
              className="flex flex-col gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex-1">
                <h2 className="font-semibold text-sumi">{lesson.title}</h2>

                <div className="mt-2 flex flex-col gap-2">
                  <div>
                    <p className="text-sm text-sumi-soft">
                      {lesson.learntWords} / {lesson.totalWords} words learnt
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={lesson.totalWords}
                      aria-valuenow={lesson.learntWords}
                      aria-label={`${lesson.title} words learnt`}
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
                        : `${lesson.knownWords} / ${lesson.totalWords} words known`}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={lesson.totalWords}
                      aria-valuenow={lesson.knownWords}
                      aria-label={`${lesson.title} words known`}
                      className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full border border-sumi/15 bg-washi"
                    >
                      <div
                        className="h-full rounded-full bg-matcha transition-[width]"
                        style={{ width: `${knownPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <LessonWords words={lesson.words} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
