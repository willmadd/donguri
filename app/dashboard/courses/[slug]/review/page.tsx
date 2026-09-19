import type { Metadata } from "next";
import Link from "next/link";
import { getCourseHome, getReviewQueue, requireProfile } from "@/lib/dal";
import { ReviewSession } from "@/components/vocab/review-session";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseHome(slug);
  return { title: `Review — ${course.title}` };
}

export default async function CourseReviewPage({ params }: PageProps) {
  const { slug } = await params;
  const [{ course }, quiz, profile] = await Promise.all([
    getCourseHome(slug),
    getReviewQueue(slug),
    requireProfile(),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/courses", label: "Courses" },
    { href: `/dashboard/courses/${slug}`, label: course.title },
    { label: "Review" },
  ];

  if (quiz.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft px-6 py-24 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-soft text-xl font-semibold text-matcha-dark">
            ✓
          </span>
          <h1 className="text-xl font-semibold text-sumi">Nothing due right now</h1>
          <p className="max-w-sm text-sm text-sumi-soft">
            Words show up here on their own schedule as they&apos;re due for review — from every
            deck in this course.
          </p>
          <Link
            href={`/dashboard/courses/${slug}`}
            className="mt-2 text-sm font-medium text-sumi-soft transition hover:text-sumi"
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
      <ReviewSession quiz={quiz} courseSlug={slug} initialXp={profile.xp} initialDonguriConfig={profile.donguriConfig} />
    </div>
  );
}
