import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile } from "@/lib/dal";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Admin — Donguri",
};

export default async function AdminHubPage() {
  await requireAdminProfile();
  const { t } = await getTranslator();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { label: t("admin_hub.title", "Admin") },
          ]}
        />
        <PageTitle>{t("admin_hub.title", "Admin")}</PageTitle>
        <PageSubtitle>{t("admin_hub.subtitle", "Manage users and course content.")}</PageSubtitle>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/admin/reset-password"
          className="rounded-2xl border border-card-border bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <h2 className="font-semibold text-sumi">
            {t("admin_hub.reset_password_title", "Reset a user's password")}
          </h2>
          <p className="mt-1 text-sm text-sumi-soft">
            {t("admin_hub.reset_password_subtitle", "Set a new password for any account by email.")}
          </p>
        </Link>
        <Link
          href="/dashboard/admin/courses"
          className="rounded-2xl border border-card-border bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <h2 className="font-semibold text-sumi">
            {t("admin_hub.manage_content_title", "Manage course content")}
          </h2>
          <p className="mt-1 text-sm text-sumi-soft">
            {t(
              "admin_hub.manage_content_subtitle",
              "Create categories, add words, and copy categories between courses.",
            )}
          </p>
        </Link>
        <Link
          href="/dashboard/admin/word-categories"
          className="rounded-2xl border border-card-border bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <h2 className="font-semibold text-sumi">
            {t("admin_hub.manage_categories_title", "Manage word categories")}
          </h2>
          <p className="mt-1 text-sm text-sumi-soft">
            {t(
              "admin_hub.manage_categories_subtitle",
              "Create and colour the topic tags words can be assigned, independent of deck.",
            )}
          </p>
        </Link>
      </div>
    </div>
  );
}
