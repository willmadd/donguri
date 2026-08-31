import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getSession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Reset password — Donguri",
};

export default async function ResetPasswordPage() {
  const user = await getSession();
  if (!user) redirect("/forgot-password");

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Make it something you'll remember."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
