import type { Metadata } from "next";
import { getCourseHome } from "@/lib/dal";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { course } = await getCourseHome(slug);
  return { title: `Grammar — ${course.title}` };
}

export default async function CourseGrammarPage({ params }: PageProps) {
  const { slug } = await params;
  // Gates on enrollment the same way every other course sub-page does, even
  // though there's no content to show yet.
  await getCourseHome(slug);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft px-6 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-soft text-xl font-semibold text-matcha-dark">
        文
      </span>
      <h1 className="text-xl font-semibold text-sumi">Grammar is coming soon</h1>
      <p className="max-w-sm text-sm text-sumi-soft">
        We&apos;re working on bite-sized grammar lessons to go alongside your
        vocabulary practice. Check back soon.
      </p>
    </div>
  );
}
