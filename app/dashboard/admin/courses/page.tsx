import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminCourses } from "@/lib/dal";
import { setCourseActive } from "@/lib/actions/admin-content";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Manage courses — Donguri",
};

export default async function AdminCoursesPage() {
  await requireAdminProfile();
  const [courses, { t }] = await Promise.all([getAdminCourses(), getTranslator()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
            { label: t("admin_courses.title", "Course content") },
          ]}
        />
        <PageTitle>{t("admin_courses.title", "Course content")}</PageTitle>
        <PageSubtitle>
          {t("admin_courses.subtitle", "Pick a course to manage its categories and words.")}
        </PageSubtitle>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-card-border bg-washi-soft p-6"
          >
            <Link
              href={`/dashboard/admin/courses/${course.slug}`}
              className="flex-1 transition hover:text-ai"
            >
              <h2 className="font-semibold text-sumi">{course.title}</h2>
            </Link>
            <VisibilityToggle
              active={course.active}
              toggleAction={setCourseActive.bind(null, course.id)}
              label={course.title}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
