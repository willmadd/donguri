import type { Metadata } from "next";
import { requireAdminProfile } from "@/lib/dal";
import { AdminResetPasswordForm } from "@/components/admin/admin-reset-password-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Reset user password — Donguri",
};

export default async function AdminResetPasswordPage() {
  await requireAdminProfile();
  const { t } = await getTranslator();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { href: "/dashboard/admin", label: t("admin_hub.title", "Admin") },
            { label: t("admin_reset_password.title", "Reset user password") },
          ]}
        />
        <PageTitle>{t("admin_hub.reset_password_title", "Reset a user's password")}</PageTitle>
        <PageSubtitle>
          {t(
            "admin_reset_password.subtitle",
            "Enter the user's email and a new password. They won't be notified automatically.",
          )}
        </PageSubtitle>
      </div>

      <div className="max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8">
        <AdminResetPasswordForm />
      </div>
    </div>
  );
}
