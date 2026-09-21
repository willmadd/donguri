import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getSession } from "@/lib/dal";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Reset password — Donguri",
};

export default async function ResetPasswordPage() {
  const user = await getSession();
  if (!user) redirect("/forgot-password");

  const { t } = await getTranslator();

  return (
    <AuthCard
      title={t("auth.reset_password_title", "Choose a new password")}
      subtitle={t("auth.reset_password_subtitle", "Make it something you'll remember.")}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
