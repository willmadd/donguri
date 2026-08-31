import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up — Donguri",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start learning today, at your own pace."
      footer={{
        text: "Already have an account?",
        linkText: "Log in",
        href: "/login",
      }}
    >
      <SignupForm />
    </AuthCard>
  );
}
