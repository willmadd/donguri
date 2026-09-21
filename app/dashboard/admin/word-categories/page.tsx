import type { Metadata } from "next";
import { requireAdminProfile, getWordCategories } from "@/lib/dal";
import { CreateWordCategoryForm } from "@/components/admin/create-word-category-form";
import { EditWordCategoryForm } from "@/components/admin/edit-word-category-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Word categories — Donguri",
};

export default async function WordCategoriesPage() {
  await requireAdminProfile();
  const [categories, { t }] = await Promise.all([getWordCategories(), getTranslator()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
            { label: t("admin_word_categories.title", "Word categories") },
          ]}
        />
        <PageTitle>{t("admin_word_categories.title", "Word categories")}</PageTitle>
        <PageSubtitle>
          {t(
            "admin_word_categories.subtitle",
            'Cross-deck topic tags with their own color — e.g. a word tagged "Food & Drink" can live in any deck, not just a "Food" deck.',
          )}
        </PageSubtitle>
      </div>

      <div className="flex flex-col gap-3">
        {categories.length === 0 && (
          <p className="text-sumi-soft">
            {t("admin_word_categories.no_categories", "No categories yet.")}
          </p>
        )}
        {categories.map((category) => (
          <EditWordCategoryForm key={category.id} category={category} />
        ))}
      </div>

      <div className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
        <h2 className="mb-4 font-semibold text-sumi">
          {t("admin_word_categories.new_category", "New category")}
        </h2>
        <CreateWordCategoryForm />
      </div>
    </div>
  );
}
