import type { Metadata } from "next";
import { requireAdminProfile } from "@/lib/dal";
import { AdminResetPasswordForm } from "@/components/admin/admin-reset-password-form";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = {
  title: "Reset user password — Donguri",
};

export default async function AdminResetPasswordPage() {
  await requireAdminProfile();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard" label="Admin" />
        <h1 className="text-2xl font-semibold text-sumi">
          Reset a user&apos;s password
        </h1>
        <p className="mt-1 text-sumi-soft">
          Enter the user&apos;s email and a new password. They won&apos;t be
          notified automatically.
        </p>
      </div>

      <div className="max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        <AdminResetPasswordForm />
      </div>
    </div>
  );
}
