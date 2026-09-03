import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { CreateWordForm } from "@/components/admin/create-word-form";
import { BackLink } from "@/components/ui/back-link";

type PageProps = {
  params: Promise<{ courseSlug: string; lessonId: string }>;
};

export const metadata: Metadata = {
  title: "Add word — Donguri",
};

export default async function NewWordPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { title: true, course: { select: { slug: true } } },
  });

  if (!lesson || lesson.course.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}`}
          label={lesson.title}
        />
        <h1 className="text-2xl font-semibold text-sumi">Add a word</h1>
        <p className="mt-1 text-sumi-soft">{lesson.title}</p>
      </div>

      <div className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        <CreateWordForm lessonId={lessonId} />
      </div>
    </div>
  );
}
