import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile, getAdminCategory } from "@/lib/dal";
import { EditCategoryForm } from "@/components/admin/edit-category-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { deckCoverImagePath } from "@/lib/images";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { languageDeckId } = await params;
  const { category } = await getAdminCategory(languageDeckId);
  return { title: `Edit ${category.title} — Donguri` };
}

export default async function AdminEditCategoryPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId } = await params;
  const [{ category, course }, { t }] = await Promise.all([
    getAdminCategory(languageDeckId),
    getTranslator(),
  ]);

  if (course.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

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
              label: category.title,
            },
            { label: t("admin_edit_category.title", "Edit deck") },
          ]}
        />
        <PageTitle>{t("admin_edit_category.title", "Edit deck")}</PageTitle>
        <PageSubtitle>{category.title}</PageSubtitle>
      </div>

      <div className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
        <EditCategoryForm category={category} currentCoverImageSrc={deckCoverImagePath(category)} />
      </div>
    </div>
  );
}
