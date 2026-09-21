import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Forgot password — Donguri",
};

export default async function ForgotPasswordPage() {
  const { t } = await getTranslator();

  return (
    <AuthCard
      title={t("auth.forgot_password_title", "Reset your password")}
      subtitle={t("auth.forgot_password_subtitle", "We'll email you a link to get back in.")}
      footer={{
        text: t("auth.forgot_password_footer_text", "Remembered it?"),
        linkText: t("auth.forgot_password_footer_link", "Log in"),
        href: "/login",
      }}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
