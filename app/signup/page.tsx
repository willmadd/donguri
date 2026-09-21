import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Sign up — Donguri",
};

export default async function SignupPage() {
  const { t } = await getTranslator();

  return (
    <AuthCard
      title={t("auth.signup_title", "Create your account")}
      subtitle={t("auth.signup_subtitle", "Start learning today, at your own pace.")}
      footer={{
        text: t("auth.signup_footer_text", "Already have an account?"),
        linkText: t("auth.signup_footer_link", "Log in"),
        href: "/login",
      }}
    >
      <SignupForm />
    </AuthCard>
  );
}
