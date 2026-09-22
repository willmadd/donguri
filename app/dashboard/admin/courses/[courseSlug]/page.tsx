import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile, getAdminCategoryOverview } from "@/lib/dal";
import { setCategoryActive } from "@/lib/actions/admin-content";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  const { course } = await getAdminCategoryOverview(courseSlug);
  return { title: `Decks — ${course.title}` };
}

export default async function AdminCourseCategoriesPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug } = await params;
  const [{ course, categories }, { t }] = await Promise.all([
    getAdminCategoryOverview(courseSlug),
    getTranslator(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
              { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
              { href: "/dashboard/admin/courses", label: t("admin_courses.title", "Course content") },
              { label: course.title },
            ]}
          />
          <PageTitle>{course.title}</PageTitle>
          <PageSubtitle>{t("admin_course_decks.subtitle", "Decks in this course.")}</PageSubtitle>
        </div>
        <Button href={`/dashboard/admin/courses/${courseSlug}/categories/new`} size="sm">
          {t("admin_course_decks.new_deck", "New deck")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {categories.length === 0 && (
          <p className="text-sumi-soft">{t("admin_course_decks.no_decks", "No decks yet.")}</p>
        )}
        {categories.map((category) => {
          const isGrammar = category.path === "grammar";
          const vocabCount = isGrammar ? 0 : category.wordCount;
          const grammarCount = isGrammar ? category.wordCount : 0;

          return (
            <div
              key={category.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-card-border bg-washi-soft p-6"
            >
              <Link
                href={`/dashboard/admin/courses/${courseSlug}/categories/${category.id}`}
                className="flex-1 transition hover:text-ai"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-sumi">{category.title}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isGrammar ? "bg-matcha-soft text-matcha-dark" : "bg-ai-soft text-ai-dark"
                    }`}
                  >
                    {isGrammar
                      ? t("course_home.grammar", "Grammar")
                      : t("course_home.vocabulary", "Vocabulary")}
                  </span>
                  {category.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-sumi/15 bg-washi px-2 py-0.5 text-xs font-medium text-sumi-soft"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-sm text-sumi-soft">
                  {t("deck_list.content_breakdown", "{{vocab}} vocab · {{grammar}} grammar", {
                    vocab: vocabCount,
                    grammar: grammarCount,
                  })}
                </p>
              </Link>
              <VisibilityToggle
                active={category.active}
                toggleAction={setCategoryActive.bind(null, category.id)}
                label={category.title}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
