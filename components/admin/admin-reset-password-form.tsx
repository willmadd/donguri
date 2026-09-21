"use client";

import { useActionState } from "react";
import { adminResetPassword } from "@/lib/actions/admin";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function AdminResetPasswordForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(adminResetPassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label={t("admin_reset_password.email_label", "User email")}
        name="email"
        type="email"
        autoComplete="off"
        placeholder="user@example.com"
        errors={state?.errors?.email}
      />
      <TextField
        label={t("auth.new_password_label", "New password")}
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={t("auth.password_placeholder", "At least 8 characters")}
        errors={state?.errors?.password}
      />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending} pendingText={t("auth.updating", "Updating…")}>
        {t("admin_reset_password.submit", "Reset password")}
      </SubmitButton>
    </form>
  );
}
