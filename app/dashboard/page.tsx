import type { Metadata } from "next";
import Link from "next/link";
import { getEnrolledCourses, requireProfile } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Dashboard — Donguri",
};

export default async function DashboardPage() {
  const [profile, courses] = await Promise.all([
    requireProfile(),
    getEnrolledCourses(),
  ]);
  const { t } = await getTranslator();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageTitle>
          {t("dashboard_home.welcome_back", "Welcome back, {{name}}", {
            name: profile.full_name ?? t("dashboard_home.friend", "friend"),
          })}
        </PageTitle>
        <PageSubtitle>
          {t("dashboard_home.subtitle", "Here's where your practice lives.")}
        </PageSubtitle>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            {t("dashboard_home.your_courses", "Your courses")}
          </h2>
          <Link
            href="/dashboard/courses"
            className="text-sm text-ai hover:text-ai-dark"
          >
            {t("dashboard_home.browse_courses", "Browse courses")}
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-2xl border border-card-border bg-washi-soft p-6 text-center">
            <p className="text-sumi-soft">
              {t("dashboard_home.no_courses", "You haven't signed up for a course yet.")}
            </p>
            <Button href="/dashboard/courses" className="mt-4">
              {t("dashboard_home.browse_courses", "Browse courses")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.slug}`}
                className="rounded-2xl border border-card-border bg-washi-soft p-6 transition hover:border-ai/40"
              >
                <h3 className="font-semibold text-sumi">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-sm text-sumi-soft">
                    {course.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-sumi-soft">
                  <span>
                    {t("dashboard_home.words_known", "{{known}} / {{total}} words known", {
                      known: course.knownWords,
                      total: course.totalWords,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sakura-soft px-2 py-0.5 font-medium text-sakura-dark">
                    🔥 {course.currentStreak}
                    <span className="text-sakura-dark/70">
                      {t("dashboard_home.best_streak", "· best {{best}}", {
                        best: course.longestStreak,
                      })}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {profile.role === "admin" && (
        <section className="rounded-2xl border border-shu/20 bg-shu/5 p-6">
          <div>
            <h2 className="font-semibold text-shu-dark">
              {t("dashboard_home.admin_panel", "Admin panel")}
            </h2>
            <p className="mt-1 text-sm text-sumi-soft">
              {t(
                "dashboard_home.admin_panel_subtitle",
                "Manage courses, users and other administrative settings.",
              )}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard/admin/courses"
              className="group rounded-xl border border-shu/15 bg-washi/70 p-4 transition hover:border-shu/30 hover:bg-washi"
            >
              <h3 className="text-sm font-semibold text-shu-dark">
                {t("dashboard_home.course_management", "Course management")}
              </h3>
              <p className="mt-1 text-sm text-sumi-soft">
                {t(
                  "dashboard_home.course_management_subtitle",
                  "Create courses and manage their vocabulary and content.",
                )}
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-shu-dark group-hover:underline">
                {t("dashboard_home.manage_courses", "Manage courses →")}
              </span>
            </Link>

            <Link
              href="/dashboard/admin/reset-password"
              className="group rounded-xl border border-shu/15 bg-washi/70 p-4 transition hover:border-shu/30 hover:bg-washi"
            >
              <h3 className="text-sm font-semibold text-shu-dark">
                {t("dashboard_home.user_management", "User management")}
              </h3>
              <p className="mt-1 text-sm text-sumi-soft">
                {t(
                  "dashboard_home.user_management_subtitle",
                  "Manage user accounts and reset their passwords.",
                )}
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-shu-dark group-hover:underline">
                {t("dashboard_home.manage_users", "Manage users →")}
              </span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
