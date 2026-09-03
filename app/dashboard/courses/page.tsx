import type { Metadata } from "next";
import Link from "next/link";
import { getAvailableCourses, getEnrolledCourses } from "@/lib/dal";
import { enrollInCourse } from "@/lib/actions/courses";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = {
  title: "Courses — Donguri",
};

export default async function CoursesPage() {
  const [enrolled, available] = await Promise.all([
    getEnrolledCourses(),
    getAvailableCourses(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <BackLink href="/dashboard" label="Dashboard" />
        <h1 className="text-2xl font-semibold text-sumi">Courses</h1>
        <p className="mt-1 text-sumi-soft">
          Sign up for a course to start practicing. You can enroll in as many
          as you like.
        </p>
      </div>

      {enrolled.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            Your courses
          </h2>
          {enrolled.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-sumi">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-sm text-sumi-soft">{course.description}</p>
                )}
                <p className="mt-1 text-xs text-sumi-soft">
                  {course.knownWords} / {course.totalWords} words known
                </p>
              </div>
              <Link
                href={`/dashboard/courses/${course.slug}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
              >
                Continue
              </Link>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            More courses
          </h2>
          {available.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-sumi">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-sm text-sumi-soft">{course.description}</p>
                )}
              </div>
              <form action={enrollInCourse.bind(null, course.id)}>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-ai px-6 font-medium text-ai-dark transition hover:bg-ai-soft"
                >
                  Enroll — free
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
