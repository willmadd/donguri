import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminWordQuizQuestions } from "@/lib/dal";
import { QuizQuestionsForm } from "@/components/admin/quiz-questions-form";
import { BulkImportQuizQuestionsForm } from "@/components/admin/bulk-import-quiz-questions-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string; wordId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wordId } = await params;
  const { word } = await getAdminWordQuizQuestions(wordId);
  return { title: `Quiz questions — ${word.term} — Donguri` };
}

export default async function AdminWordQuizPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId, wordId } = await params;
  const [{ word, languageDeck, course, autoForms, questions }, { t }] = await Promise.all([
    getAdminWordQuizQuestions(wordId),
    getTranslator(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
            { href: "/dashboard/admin/courses", label: t("admin_courses.title", "Course content") },
            { href: `/dashboard/admin/courses/${courseSlug}`, label: course.title },
            {
              href: `/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}`,
              label: languageDeck.title,
            },
            { label: word.term },
          ]}
        />
        <PageTitle>{t("admin_word_quiz.title", "Quiz questions")}</PageTitle>
        <PageSubtitle>
          {word.term} — {word.translation} · {course.title}
        </PageSubtitle>
      </div>

      <section className="rounded-2xl border border-card-border bg-washi-soft p-6">
        <h2 className="font-semibold text-sumi">
          {t("admin_word_quiz.auto_generated", "Auto-generated")}
        </h2>
        <p className="mt-1 text-sm text-sumi-soft">
          {t(
            "admin_word_quiz.auto_generated_subtitle",
            "Always asked — both-direction multiple choice between the term and translation.",
          )}
        </p>

        {autoForms.length > 0 && (
          <>
            <p className="mt-4 text-sm text-sumi-soft">
              {t(
                "admin_word_quiz.fill_in_blank_hint",
                "Fill-in-the-blank, built from this word's forms and examples — each form is picked equally often regardless of how many examples it has, but a form with only one or two is still worth balancing out below:",
              )}
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
                      {t(
                        "admin_word_quiz.no_matching_example",
                        "No matching example yet — won't be asked. Add one below.",
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <Link
          href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/words/${wordId}/edit`}
          className="mt-3 inline-block text-sm font-medium text-ai-dark transition hover:text-ai"
        >
          {t("admin_word_quiz.edit_forms_link", "Edit forms/examples →")}
        </Link>
      </section>

      <section className="rounded-2xl border border-card-border bg-washi-soft p-6">
        <h2 className="mb-4 font-semibold text-sumi">
          {t("admin_word_quiz.custom_questions", "Custom questions")}
        </h2>
        <p className="mb-4 text-sm text-sumi-soft">
          {t(
            "admin_word_quiz.custom_questions_subtitle",
            "Mixed into the quiz pool alongside the auto-generated ones — shown either as multiple choice or as a type-the-answer question, at random.",
          )}
        </p>
        <QuizQuestionsForm wordId={wordId} initialQuestions={questions} />
      </section>

      <section className="rounded-2xl border border-card-border bg-washi-soft p-6">
        <h2 className="mb-4 font-semibold text-sumi">
          {t("admin_word_quiz.bulk_import", "Bulk import")}
        </h2>
        <BulkImportQuizQuestionsForm wordId={wordId} />
      </section>
    </div>
  );
}
