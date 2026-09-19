import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseHome, getLearnQueueForCourse } from "@/lib/dal";
import { LearnSession } from "@/components/vocab/learn-session";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";

type PageProps = {
  params: Promise<{ slug: string; path: string }>;
};

function parsePath(path: string): "vocab" | "grammar" | null {
  return path === "vocab" || path === "grammar" ? path : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, path } = await params;
  const kind = parsePath(path);
  const { course } = await getCourseHome(slug);
  return { title: `Learn ${kind === "grammar" ? "grammar" : "vocabulary"} — ${course.title}` };
}

export default async function LearnPage({ params }: PageProps) {
  const { slug, path } = await params;
  const kind = parsePath(path);

  if (!kind) {
    notFound();
  }

  const [{ course }, words] = await Promise.all([
    getCourseHome(slug),
    getLearnQueueForCourse(slug, kind),
  ]);

  const label = kind === "grammar" ? "grammar" : "vocabulary";

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/courses", label: "Courses" },
    { href: `/dashboard/courses/${slug}`, label: course.title },
    { label: `Learn ${label}` },
  ];

  if (words.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-xl font-semibold text-ai-dark">
            ✓
          </span>
          <h1 className="text-xl font-semibold text-sumi">
            {kind === "grammar"
              ? "You've learnt every point in your active decks"
              : "You've learnt every word in your active decks"}
          </h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            Activate more decks on the course page, or head over to Test yourself to keep these
            fresh.
          </p>
          <Link
            href={`/dashboard/courses/${slug}/test/${kind}`}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
          >
            Test yourself
          </Link>
          <Link
            href={`/dashboard/courses/${slug}`}
            className="text-sm font-medium text-sumi-soft transition hover:text-sumi"
          >
            Back to course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={breadcrumbItems} />
      <LearnSession
        key={words.map((word) => word.id).join(",")}
        words={words}
        courseSlug={slug}
        kind={kind}
      />
    </div>
  );
}
