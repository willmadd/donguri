import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile, getAdminWord, getWordCategories } from "@/lib/dal";
import { EditWordForm } from "@/components/admin/edit-word-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { wordImagePath } from "@/lib/images";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string; wordId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wordId } = await params;
  const { word } = await getAdminWord(wordId);
  return { title: `Edit ${word.term} — Donguri` };
}

export default async function EditWordPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId, wordId } = await params;
  const { word, languageDeck, course } = await getAdminWord(wordId);

  if (course.slug !== courseSlug || languageDeck.id !== languageDeckId) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  const [categories, { t }] = await Promise.all([getWordCategories(), getTranslator()]);

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
        <PageTitle>{t("admin_edit_word.title", "Edit word")}</PageTitle>
        <PageSubtitle>
          {languageDeck.title} — {course.title}
        </PageSubtitle>
      </div>

      <div className="max-w-3xl rounded-2xl border border-card-border bg-washi-soft p-8">
        <EditWordForm word={word} currentImageSrc={wordImagePath(word)} categories={categories} />
      </div>
    </div>
  );
}
