import type { Metadata } from "next";
import { requireAdminProfile, getWordCategories } from "@/lib/dal";
import { CreateWordCategoryForm } from "@/components/admin/create-word-category-form";
import { EditWordCategoryForm } from "@/components/admin/edit-word-category-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const metadata: Metadata = {
  title: "Word categories — Donguri",
};

export default async function WordCategoriesPage() {
  await requireAdminProfile();
  const categories = await getWordCategories();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/admin", label: "Admin" },
            { label: "Word categories" },
          ]}
        />
        <h1 className="text-2xl font-semibold text-sumi">Word categories</h1>
        <p className="mt-1 text-sumi-soft">
          Cross-deck topic tags with their own color — e.g. a word tagged &ldquo;Food &amp;
          Drink&rdquo; can live in any deck, not just a &ldquo;Food&rdquo; deck.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {categories.length === 0 && <p className="text-sumi-soft">No categories yet.</p>}
        {categories.map((category) => (
          <EditWordCategoryForm key={category.id} category={category} />
        ))}
      </div>

      <div className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        <h2 className="mb-4 font-semibold text-sumi">New category</h2>
        <CreateWordCategoryForm />
      </div>
    </div>
  );
}
