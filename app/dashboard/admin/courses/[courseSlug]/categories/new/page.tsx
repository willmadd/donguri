import type { Metadata } from "next";
import { requireAdminProfile, getAdminCategoryOverview } from "@/lib/dal";
import { CreateCategoryForm } from "@/components/admin/create-category-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string }>;
};

export const metadata: Metadata = {
  title: "New deck — Donguri",
};

export default async function NewCategoryPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug } = await params;
  const [{ course }, { t }] = await Promise.all([
    getAdminCategoryOverview(courseSlug),
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
            { label: t("admin_course_decks.new_deck", "New deck") },
          ]}
        />
        <PageTitle>{t("admin_course_decks.new_deck", "New deck")}</PageTitle>
        <PageSubtitle>{course.title}</PageSubtitle>
      </div>

      <div className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
        <CreateCategoryForm courseId={course.id} />
      </div>
    </div>
  );
}
