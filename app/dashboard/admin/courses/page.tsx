import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminCourses } from "@/lib/dal";
import { setCourseActive } from "@/lib/actions/admin-content";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = {
  title: "Manage courses — Donguri",
};

export default async function AdminCoursesPage() {
  await requireAdminProfile();
  const courses = await getAdminCourses();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard" label="Admin" />
        <h1 className="text-2xl font-semibold text-sumi">Course content</h1>
        <p className="mt-1 text-sumi-soft">
          Pick a course to manage its categories and words.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-sumi/10 bg-washi-soft p-6"
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
