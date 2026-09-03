import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminCategoryOverview } from "@/lib/dal";
import { setCategoryActive } from "@/lib/actions/admin-content";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ courseSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  const { course } = await getAdminCategoryOverview(courseSlug);
  return { title: `Categories — ${course.title}` };
}

export default async function AdminCourseCategoriesPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug } = await params;
  const { course, categories } = await getAdminCategoryOverview(courseSlug);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <BackLink href="/dashboard/admin/courses" label="Course content" />
          <h1 className="text-2xl font-semibold text-sumi">{course.title}</h1>
          <p className="mt-1 text-sumi-soft">Categories in this course.</p>
        </div>
        <Link
          href={`/dashboard/admin/courses/${courseSlug}/categories/new`}
          className="inline-flex h-10 items-center justify-center rounded-full bg-ai px-5 text-sm font-medium text-washi transition hover:bg-ai-dark"
        >
          New category
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {categories.length === 0 && (
          <p className="text-sumi-soft">No categories yet.</p>
        )}
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-sumi/10 bg-washi-soft p-6"
          >
            <Link
              href={`/dashboard/admin/courses/${courseSlug}/categories/${category.id}`}
              className="flex-1 transition hover:text-ai"
            >
              <h2 className="font-semibold text-sumi">{category.title}</h2>
              <p className="mt-1 text-sm text-sumi-soft">
                {category.wordCount} word{category.wordCount === 1 ? "" : "s"}
              </p>
            </Link>
            <VisibilityToggle
              active={category.active}
              toggleAction={setCategoryActive.bind(null, category.id)}
              label={category.title}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
