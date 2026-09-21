import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Log in — Donguri",
};

export default async function LoginPage() {
  const { t } = await getTranslator();

  return (
    <AuthCard
      title={t("auth.login_title", "Welcome back")}
      subtitle={t("auth.login_subtitle", "Log in to continue your practice.")}
      footer={{
        text: t("auth.login_footer_text", "Don't have an account?"),
        linkText: t("auth.login_footer_link", "Sign up"),
        href: "/signup",
      }}
    >
      <LoginForm />
    </AuthCard>
  );
}
