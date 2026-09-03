import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile, getAdminWord } from "@/lib/dal";
import { EditWordForm } from "@/components/admin/edit-word-form";
import { BackLink } from "@/components/ui/back-link";
import { wordImagePath } from "@/lib/images";

type PageProps = {
  params: Promise<{ courseSlug: string; lessonId: string; wordId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { wordId } = await params;
  const { word } = await getAdminWord(wordId);
  return { title: `Edit ${word.term} — Donguri` };
}

export default async function EditWordPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, lessonId, wordId } = await params;
  const { word, lesson, course } = await getAdminWord(wordId);

  if (course.slug !== courseSlug || lesson.id !== lessonId) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}`}
          label={lesson.title}
        />
        <h1 className="text-2xl font-semibold text-sumi">Edit word</h1>
        <p className="mt-1 text-sumi-soft">
          {lesson.title} — {course.title}
        </p>
      </div>

      <div className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        <EditWordForm word={word} currentImageSrc={wordImagePath(word)} />
      </div>
    </div>
  );
}
