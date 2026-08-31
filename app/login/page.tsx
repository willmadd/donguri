import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — Donguri",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to continue your practice."
      footer={{
        text: "Don't have an account?",
        linkText: "Sign up",
        href: "/signup",
      }}
    >
      <LoginForm />
    </AuthCard>
  );
}
