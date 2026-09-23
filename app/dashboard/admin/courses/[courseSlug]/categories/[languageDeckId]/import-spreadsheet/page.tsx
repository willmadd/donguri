import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ImportSpreadsheetForm } from "@/components/admin/import-spreadsheet-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
};

export const metadata: Metadata = {
  title: "Import from spreadsheet — Donguri",
};

export default async function ImportSpreadsheetPage({ params }: PageProps) {
  await requireAdminProfile();
  const { courseSlug, languageDeckId } = await params;

  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { title: true, course: { select: { slug: true, title: true } } },
  });

  if (!languageDeck || languageDeck.course.slug !== courseSlug) {
    redirect(`/dashboard/admin/courses/${courseSlug}`);
  }

  const { t } = await getTranslator();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
            { href: "/dashboard/admin/courses", label: t("admin_courses.title", "Course content") },
            { href: `/dashboard/admin/courses/${courseSlug}`, label: languageDeck.course.title },
            {
              href: `/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}`,
              label: languageDeck.title,
            },
            { label: t("admin_import_spreadsheet.title", "Import from spreadsheet") },
          ]}
        />
        <PageTitle>{t("admin_import_spreadsheet.title", "Import from spreadsheet")}</PageTitle>
        <PageSubtitle>
          {t("admin_import.into", 'Into "{{languageDeck}}" — {{course}}', {
            languageDeck: languageDeck.title,
            course: languageDeck.course.title,
          })}
        </PageSubtitle>
      </div>

      <div className="max-w-lg rounded-2xl border border-card-border bg-washi-soft p-8">
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-card-border bg-washi p-4">
          <p className="text-sm text-sumi">
            {t(
              "admin_import_spreadsheet.template_intro",
              "Download the template, fill it in (Google Sheets works too — download it as Excel when you're done), then upload it below.",
            )}
          </p>
          {/* Plain anchors, not the Link-based Button — these point at
              file-download routes (Content-Disposition: attachment), and
              Next's client-side router would otherwise try to interpret the
              binary response as a page navigation instead of letting the
              browser download it. */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/import-spreadsheet/template`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              {t("admin_import_spreadsheet.download_template", "Download template (.xlsx)")}
            </a>
            <a
              href={`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}/import-spreadsheet/export`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              {t("admin_import_spreadsheet.download_current", "Download current words (.xlsx)")}
            </a>
          </div>
        </div>

        <ImportSpreadsheetForm languageDeckId={languageDeckId} />
      </div>
    </div>
  );
}
