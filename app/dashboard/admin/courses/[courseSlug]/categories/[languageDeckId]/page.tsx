import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile, getAdminCategoryWords } from "@/lib/dal";
import { setWordActive } from "@/lib/actions/admin-content";
import { DeleteWordButton } from "@/components/admin/delete-word-button";
import { WordImage } from "@/components/ui/word-image";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { wordImagePath } from "@/lib/images";
import { getTranslator } from "@/lib/i18n/server";
import { cn, getContrastTextClass } from "@/lib/utils";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { languageDeckId } = await params;
  const { languageDeck } = await getAdminCategoryWords(languageDeckId);
  return { title: `${languageDeck.title} — Donguri` };
}

export default async function AdminCategoryWordsPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId } = await params;
  const { languageDeck, course, words } =
    await getAdminCategoryWords(languageDeckId);
  const { t } = await getTranslator();

  if (course.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          {
            href: "/dashboard",
            label: t("breadcrumbs.dashboard", "Dashboard"),
          },
          {
            href: "/dashboard/admin",
            label: t("admin_hub.title", "Admin"),
          },
          {
            href: "/dashboard/admin/courses",
            label: t("admin_courses.title", "Course content"),
          },
          {
            href: `/dashboard/admin/courses/${courseSlug}`,
            label: course.title,
          },
          { label: languageDeck.title },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        {languageDeck.coverImage ? (
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
            <WordImage
              src={languageDeck.coverImage}
              alt=""
              className="h-40 w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to right, transparent 0%, transparent 33%, ${languageDeck.bgColor ?? "rgba(22, 13, 4, 0.7)"} 66%, ${languageDeck.bgColor ?? "rgba(22, 13, 4, 0.7)"} 100%)`,
              }}
            />
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <div className="ml-auto max-w-[45%] text-right">
                <PageTitle
                  className={getContrastTextClass(languageDeck.bgColor)}
                >
                  {languageDeck.title}
                </PageTitle>
                <PageSubtitle
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    getContrastTextClass(languageDeck.primaryColor),
                  )}
                  style={
                    languageDeck.primaryColor
                      ? { backgroundColor: languageDeck.primaryColor }
                      : undefined
                  }
                >
                  {languageDeck.subheading}
                </PageSubtitle>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <PageTitle>{languageDeck.title}</PageTitle>
            <PageSubtitle>{course.title}</PageSubtitle>
          </div>
        )}
        <div className="flex shrink-0 flex-col gap-3">
          {languageDeck.description && (
            <p className="max-w-xs text-sm text-sumi-soft">
              {languageDeck.description}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Button
              href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/edit`}
              variant="outline"
              size="sm"
            >
              {t("admin_category_words.edit_deck", "Edit deck")}
            </Button>
            <Button
              href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/import`}
              variant="outline"
              size="sm"
            >
              {t("admin_category_words.import", "Import from another course")}
            </Button>
            <Button
              href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/import-spreadsheet`}
              variant="outline"
              size="sm"
            >
              {t("admin_category_words.import_spreadsheet", "Import from spreadsheet")}
            </Button>
            <Button
              href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/words/new`}
              size="sm"
            >
              {t("admin_category_words.add_word", "Add word")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {words.length === 0 && (
          <p className="text-sumi-soft">
            {t("admin_category_words.no_words", "No words yet.")}
          </p>
        )}
        {words.map((word) => (
          <div
            key={word.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-card-border bg-washi-soft p-4"
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
                  <p className="mt-0.5 text-sm text-sumi-soft">
                    {word.romanization}
                  </p>
                )}
                {word.exampleSentence && (
                  <p className="mt-0.5 text-sm text-sumi-soft">
                    {word.exampleSentence}
                  </p>
                )}
                {(word.category || word.wordType) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {word.category && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          getContrastTextClass(word.category.color),
                        )}
                        style={{ backgroundColor: word.category.color }}
                      >
                        {word.category.name}
                      </span>
                    )}
                    {word.wordType && (
                      <span className="inline-flex items-center rounded-full border border-sumi/15 px-2.5 py-0.5 text-xs font-medium text-sumi-soft">
                        {word.wordType}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Button
                href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/words/${word.id}/quiz`}
                variant="outline"
                size="sm"
              >
                {t("admin_category_words.quiz", "Quiz")}
              </Button>
              <Button
                href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/words/${word.id}/edit`}
                variant="outline"
                size="sm"
              >
                {t("admin_category_words.edit", "Edit")}
              </Button>
              <VisibilityToggle
                active={word.active}
                toggleAction={setWordActive.bind(null, word.id)}
                label={`${word.term} — ${word.translation}`}
              />
              <DeleteWordButton wordId={word.id} label={`${word.term} — ${word.translation}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
