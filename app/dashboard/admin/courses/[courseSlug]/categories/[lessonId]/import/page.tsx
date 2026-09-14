import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  requireAdminProfile,
  getAdminCategoryWords,
  getAdminCourses,
  getAdminCategoryOverview,
} from "@/lib/dal";
import { SelectField } from "@/components/ui/select";
import { ImportWordsForm } from "@/components/admin/import-words-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { wordImagePath } from "@/lib/images";

type PageProps = {
  params: Promise<{ courseSlug: string; lessonId: string }>;
  searchParams: Promise<{ sourceCourseSlug?: string; sourceLessonId?: string }>;
};

export const metadata: Metadata = {
  title: "Import words — Donguri",
};

export default async function ImportWordsPage({ params, searchParams }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, lessonId } = await params;
  const { sourceCourseSlug, sourceLessonId } = await searchParams;

  const { lesson: targetLesson, course: targetCourse } = await getAdminCategoryWords(lessonId);

  if (targetCourse.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  const heading = (
    <div>
      <Breadcrumbs
        items={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/admin", label: "Admin" },
          { href: "/dashboard/admin/courses", label: "Course content" },
          { href: `/dashboard/admin/courses/${courseSlug}`, label: targetCourse.title },
          {
            href: `/dashboard/admin/courses/${courseSlug}/categories/${lessonId}`,
            label: targetLesson.title,
          },
          { label: "Import words" },
        ]}
      />
      <h1 className="text-2xl font-semibold text-sumi">Import words</h1>
      <p className="mt-1 text-sumi-soft">
        Into &quot;{targetLesson.title}&quot; — {targetCourse.title}
      </p>
    </div>
  );

  // Step 1: choose a source course.
  if (!sourceCourseSlug) {
    const courses = await getAdminCourses();

    return (
      <div className="flex flex-col gap-6">
        {heading}
        <form className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
          <SelectField
            label="Source course"
            name="sourceCourseSlug"
            options={courses.map((course) => ({ value: course.slug, label: course.title }))}
          />
          <button
            type="submit"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
          >
            Next
          </button>
        </form>
      </div>
    );
  }

  // Step 2: choose a source deck within that course.
  if (!sourceLessonId) {
    const { categories } = await getAdminCategoryOverview(sourceCourseSlug);

    return (
      <div className="flex flex-col gap-6">
        {heading}
        <form className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
          <input type="hidden" name="sourceCourseSlug" value={sourceCourseSlug} />
          <SelectField
            label="Source deck"
            name="sourceLessonId"
            options={categories.map((category) => ({
              value: category.id,
              label: `${category.title} (${category.wordCount} words)`,
            }))}
          />
          <button
            type="submit"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
          >
            Next
          </button>
        </form>
      </div>
    );
  }

  // Step 3: pick which words to bring in.
  const { words } = await getAdminCategoryWords(sourceLessonId);

  return (
    <div className="flex flex-col gap-6">
      {heading}
      <div className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        {words.length === 0 ? (
          <p className="text-sumi-soft">That deck has no words.</p>
        ) : (
          <ImportWordsForm
            targetLessonId={lessonId}
            words={words.map((word) => ({ ...word, imageSrc: wordImagePath(word) }))}
          />
        )}
      </div>
    </div>
  );
}
