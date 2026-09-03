import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminProfile, getAdminCategoryWords } from "@/lib/dal";
import { setWordActive } from "@/lib/actions/admin-content";
import { WordImage } from "@/components/ui/word-image";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { BackLink } from "@/components/ui/back-link";
import { wordImagePath } from "@/lib/images";

type PageProps = {
  params: Promise<{ courseSlug: string; lessonId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lessonId } = await params;
  const { lesson } = await getAdminCategoryWords(lessonId);
  return { title: `${lesson.title} — Donguri` };
}

export default async function AdminCategoryWordsPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, lessonId } = await params;
  const { lesson, course, words } = await getAdminCategoryWords(lessonId);

  if (course.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <BackLink href={`/dashboard/admin/courses/${courseSlug}`} label={course.title} />
          <h1 className="text-2xl font-semibold text-sumi">{lesson.title}</h1>
          <p className="mt-1 text-sumi-soft">{course.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}/import`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-sumi/15 px-5 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
          >
            Import from another course
          </Link>
          <Link
            href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}/words/new`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-ai px-5 text-sm font-medium text-washi transition hover:bg-ai-dark"
          >
            Add word
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {words.length === 0 && <p className="text-sumi-soft">No words yet.</p>}
        {words.map((word) => (
          <div
            key={word.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-sumi/10 bg-washi-soft p-4"
          >
            <div className="flex items-center gap-4">
              <WordImage
                src={wordImagePath(word)}
                alt={word.term}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div>
                <h2 className="font-semibold text-sumi">
                  {word.term} — {word.translation}
                </h2>
                {word.romanization && (
                  <p className="mt-0.5 text-sm text-sumi-soft">{word.romanization}</p>
                )}
                {word.exampleSentence && (
                  <p className="mt-0.5 text-sm text-sumi-soft">{word.exampleSentence}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/dashboard/admin/courses/${courseSlug}/categories/${lessonId}/words/${word.id}/edit`}
                className="inline-flex h-9 items-center justify-center rounded-full border border-sumi/15 px-4 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
              >
                Edit
              </Link>
              <VisibilityToggle
                active={word.active}
                toggleAction={setWordActive.bind(null, word.id)}
                label={`${word.term} — ${word.translation}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
