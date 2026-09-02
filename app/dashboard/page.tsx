import type { Metadata } from "next";
import Link from "next/link";
import { getEnrolledCourses, requireProfile } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Dashboard — Donguri",
};

export default async function DashboardPage() {
  const [profile, courses] = await Promise.all([
    requireProfile(),
    getEnrolledCourses(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-sumi">
          Welcome back, {profile.full_name ?? "friend"}
        </h1>
        <p className="mt-1 text-sumi-soft">
          Here&apos;s where your practice lives.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            Your courses
          </h2>
          <Link href="/dashboard/courses" className="text-sm text-ai hover:text-ai-dark">
            Browse courses
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 text-center">
            <p className="text-sumi-soft">
              You haven&apos;t signed up for a course yet.
            </p>
            <Link
              href="/dashboard/courses"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
            >
              Browse courses
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.slug}`}
                className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 transition hover:border-ai/40"
              >
                <h3 className="font-semibold text-sumi">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-sm text-sumi-soft">{course.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-sumi-soft">
                  <span>
                    {course.knownWords} / {course.totalWords} words known
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sakura-soft px-2 py-0.5 font-medium text-sakura-dark">
                    🔥 {course.currentStreak}
                    <span className="text-sakura-dark/70">· best {course.longestStreak}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {profile.role === "admin" && (
        <div className="rounded-2xl border border-shu/20 bg-shu/5 p-6">
          <h2 className="font-semibold text-shu-dark">Admin panel</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            This section is only visible to admins.
          </p>
          <Link
            href="/dashboard/admin/reset-password"
            className="mt-3 inline-flex text-sm font-medium text-shu-dark hover:underline"
          >
            Reset a user&apos;s password →
          </Link>
        </div>
      )}
    </div>
  );
}
