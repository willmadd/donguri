import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminWordQuizQuestions } from "@/lib/dal";
import { QuizQuestionsForm } from "@/components/admin/quiz-questions-form";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ courseSlug: string; lessonId: string; wordId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wordId } = await params;
  const { word } = await getAdminWordQuizQuestions(wordId);
  return { title: `Quiz questions — ${word.term} — Donguri` };
}

export default async function AdminWordQuizPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, lessonId, wordId } = await params;
  const { word, lesson, course, autoForms, questions } = await getAdminWordQuizQuestions(wordId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}`}
          label={lesson.title}
        />
        <h1 className="text-2xl font-semibold text-sumi">Quiz questions</h1>
        <p className="mt-1 text-sumi-soft">
          {word.term} — {word.translation} · {course.title}
        </p>
      </div>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <h2 className="font-semibold text-sumi">Auto-generated</h2>
        <p className="mt-1 text-sm text-sumi-soft">
          Always asked — both-direction multiple choice between the term and translation.
        </p>

        {autoForms.length > 0 && (
          <>
            <p className="mt-4 text-sm text-sumi-soft">
              Fill-in-the-blank, built from this word&apos;s forms and examples:
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-sumi">
              {autoForms.map((form) => (
                <li key={form.id}>
                  {form.labelEn} ({form.value}) —{" "}
                  {form.exampleCount > 0 ? (
                    <>
                      {form.exampleCount} example{form.exampleCount === 1 ? "" : "s"}
                    </>
                  ) : (
                    <span className="text-sumi-soft">no matching example yet, won&apos;t be asked</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <Link
          href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}/words/${wordId}/edit`}
          className="mt-3 inline-block text-sm font-medium text-ai-dark transition hover:text-ai"
        >
          Edit forms/examples →
        </Link>
      </section>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <h2 className="mb-4 font-semibold text-sumi">Custom questions</h2>
        <QuizQuestionsForm wordId={wordId} initialQuestions={questions} />
      </section>
    </div>
  );
}
