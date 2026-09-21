import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile, getWordCategories } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { CreateWordForm } from "@/components/admin/create-word-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
};

export const metadata: Metadata = {
  title: "Add word — Donguri",
};

export default async function NewWordPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId } = await params;

  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { title: true, course: { select: { slug: true, title: true } } },
  });

  if (!languageDeck || languageDeck.course.slug !== courseSlug) {
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
            { href: `/dashboard/admin/courses/${courseSlug}`, label: languageDeck.course.title },
            {
              href: `/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}`,
              label: languageDeck.title,
            },
            { label: t("admin_category_words.add_word", "Add word") },
          ]}
        />
        <PageTitle>{t("admin_new_word.title", "Add a word")}</PageTitle>
        <PageSubtitle>{languageDeck.title}</PageSubtitle>
      </div>

      <div className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
        <CreateWordForm languageDeckId={languageDeckId} categories={categories} />
      </div>
    </div>
  );
}
