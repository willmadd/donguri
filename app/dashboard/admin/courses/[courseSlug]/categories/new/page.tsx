import type { Metadata } from "next";
import { requireAdminProfile, getAdminCategoryOverview } from "@/lib/dal";
import { CreateCategoryForm } from "@/components/admin/create-category-form";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ courseSlug: string }>;
};

export const metadata: Metadata = {
  title: "New category — Donguri",
};

export default async function NewCategoryPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug } = await params;
  const { course } = await getAdminCategoryOverview(courseSlug);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={`/dashboard/admin/courses/${courseSlug}`} label={course.title} />
        <h1 className="text-2xl font-semibold text-sumi">New category</h1>
        <p className="mt-1 text-sumi-soft">{course.title}</p>
      </div>

      <div className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        <CreateCategoryForm courseId={course.id} />
      </div>
    </div>
  );
}
