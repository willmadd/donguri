import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  requireAdminProfile,
  getAdminCategoryWords,
  getAdminCourses,
  getAdminCategoryOverview,
} from "@/lib/dal";
import { SelectField } from "@/components/ui/select";
import { ImportWordsForm } from "@/components/admin/import-words-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { wordImagePath } from "@/lib/images";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
  searchParams: Promise<{ sourceCourseSlug?: string; sourceLanguageDeckId?: string }>;
};

export const metadata: Metadata = {
  title: "Import words — Donguri",
};

export default async function ImportWordsPage({ params, searchParams }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId } = await params;
  const { sourceCourseSlug, sourceLanguageDeckId } = await searchParams;

  const [{ languageDeck: targetLanguageDeck, course: targetCourse }, { t }] = await Promise.all([
    getAdminCategoryWords(languageDeckId),
    getTranslator(),
  ]);

  if (targetCourse.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  const heading = (
    <div>
      <Breadcrumbs
        items={[
          { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
          { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
          { href: "/dashboard/admin/courses", label: t("admin_courses.title", "Course content") },
          { href: `/dashboard/admin/courses/${courseSlug}`, label: targetCourse.title },
          {
            href: `/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}`,
            label: targetLanguageDeck.title,
          },
          { label: t("admin_import.title", "Import words") },
        ]}
      />
      <PageTitle>{t("admin_import.title", "Import words")}</PageTitle>
      <PageSubtitle>
        {t("admin_import.into", 'Into "{{languageDeck}}" — {{course}}', {
          languageDeck: targetLanguageDeck.title,
          course: targetCourse.title,
        })}
      </PageSubtitle>
    </div>
  );

  // Step 1: choose a source course.
  if (!sourceCourseSlug) {
    const courses = await getAdminCourses();

    return (
      <div className="flex flex-col gap-6">
        {heading}
        <form className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
          <SelectField
            label={t("admin_import.source_course", "Source course")}
            name="sourceCourseSlug"
            options={courses.map((course) => ({ value: course.slug, label: course.title }))}
          />
          <Button type="submit" className="mt-4">
            {t("common.next", "Next")}
          </Button>
        </form>
      </div>
    );
  }

  // Step 2: choose a source deck within that course.
  if (!sourceLanguageDeckId) {
    const { categories } = await getAdminCategoryOverview(sourceCourseSlug);

    return (
      <div className="flex flex-col gap-6">
        {heading}
        <form className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
          <input type="hidden" name="sourceCourseSlug" value={sourceCourseSlug} />
          <SelectField
            label={t("admin_import.source_deck", "Source deck")}
            name="sourceLanguageDeckId"
            options={categories.map((category) => ({
              value: category.id,
              label: t("admin_import.source_deck_option", "{{title}} ({{count}} words)", {
                title: category.title,
                count: category.wordCount,
              }),
            }))}
          />
          <Button type="submit" className="mt-4">
            {t("common.next", "Next")}
          </Button>
        </form>
      </div>
    );
  }

  // Step 3: pick which words to bring in.
  const { words } = await getAdminCategoryWords(sourceLanguageDeckId);

  return (
    <div className="flex flex-col gap-6">
      {heading}
      <div className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
        {words.length === 0 ? (
          <p className="text-sumi-soft">{t("admin_import.empty_deck", "That deck has no words.")}</p>
        ) : (
          <ImportWordsForm
            targetLanguageDeckId={languageDeckId}
            words={words.map((word) => ({ ...word, imageSrc: wordImagePath(word) }))}
          />
        )}
      </div>
    </div>
  );
}
