import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — Donguri",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to get back in."
      footer={{
        text: "Remembered it?",
        linkText: "Log in",
        href: "/login",
      }}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
