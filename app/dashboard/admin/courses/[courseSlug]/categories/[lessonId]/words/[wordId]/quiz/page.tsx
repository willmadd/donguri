import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminWordQuizQuestions } from "@/lib/dal";
import { QuizQuestionsForm } from "@/components/admin/quiz-questions-form";
import { BulkImportQuizQuestionsForm } from "@/components/admin/bulk-import-quiz-questions-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

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
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/admin", label: "Admin" },
            { href: "/dashboard/admin/courses", label: "Course content" },
            { href: `/dashboard/admin/courses/${courseSlug}`, label: course.title },
            {
              href: `/dashboard/admin/courses/${courseSlug}/categories/${lessonId}`,
              label: lesson.title,
            },
            { label: word.term },
          ]}
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
              Fill-in-the-blank, built from this word&apos;s forms and examples — each form is
              picked equally often regardless of how many examples it has, but a form with only
              one or two is still worth balancing out below:
            </p>
            <div className="mt-2 flex flex-col gap-3">
              {autoForms.map((form) => (
                <div key={form.id} className="rounded-lg border border-sumi/10 bg-washi p-3">
                  <p className="text-sm font-medium text-sumi">
                    {form.labelEn} <span className="text-sumi-soft">({form.value})</span>
                  </p>
                  {form.examples.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-0.5 text-sm text-sumi-soft">
                      {form.examples.map((example, index) => (
                        <li key={index}>
                          {example.en} <span className="opacity-70">— {example.ja}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-shu">
                      No matching example yet — won&apos;t be asked. Add one below.
                    </p>
                  )}
                </div>
              ))}
            </div>
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
        <p className="mb-4 text-sm text-sumi-soft">
          Mixed into the quiz pool alongside the auto-generated ones — shown either as multiple
          choice or as a type-the-answer question, at random.
        </p>
        <QuizQuestionsForm wordId={wordId} initialQuestions={questions} />
      </section>

      <section className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <h2 className="mb-4 font-semibold text-sumi">Bulk import</h2>
        <BulkImportQuizQuestionsForm wordId={wordId} />
      </section>
    </div>
  );
}
