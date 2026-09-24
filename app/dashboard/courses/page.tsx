import type { Metadata } from "next";
import { getAvailableCourses, getEnrolledCourses } from "@/lib/dal";
import { enrollInCourse } from "@/lib/actions/courses";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Courses — Donguri",
};

export default async function CoursesPage() {
  const [enrolled, available] = await Promise.all([
    getEnrolledCourses(),
    getAvailableCourses(),
  ]);
  const { t } = await getTranslator();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { label: t("courses_page.title", "Courses") },
          ]}
        />
        <PageTitle>{t("courses_page.title", "Courses")}</PageTitle>
        <PageSubtitle>
          {t(
            "courses_page.subtitle",
            "Sign up for a course to start practicing. You can enroll in as many as you like.",
          )}
        </PageSubtitle>
      </div>

      {enrolled.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            {t("courses_page.your_courses", "Your courses")}
          </h2>
          {enrolled.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-3 rounded-2xl border border-card-border bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-sumi">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-sm text-sumi-soft">{course.description}</p>
                )}
                <p className="mt-1 text-xs text-sumi-soft">
                  {t("courses_page.words_known", "{{known}} / {{total}} words known", {
                    known: course.knownWords,
                    total: course.totalWords,
                  })}
                </p>
              </div>
              <Button href={`/dashboard/courses/${course.slug}`} prefetch>
                {t("courses_page.continue", "Continue")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            {t("courses_page.more_courses", "More courses")}
          </h2>
          {available.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-3 rounded-2xl border border-card-border bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-sumi">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-sm text-sumi-soft">{course.description}</p>
                )}
              </div>
              <form action={enrollInCourse.bind(null, course.id)}>
                <Button
                  type="submit"
                  variant="outline"
                  className="border-ai text-ai-dark hover:border-ai hover:bg-ai-soft hover:text-ai-dark"
                >
                  {t("courses_page.enroll_free", "Enroll — free")}
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
