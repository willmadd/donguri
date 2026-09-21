"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function ResetPasswordForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label={t("auth.new_password_label", "New password")}
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={t("auth.password_placeholder", "At least 8 characters")}
        errors={state?.errors?.password}
      />
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}
      <SubmitButton pending={pending} pendingText={t("auth.updating", "Updating…")}>
        {t("auth.update_password", "Update password")}
      </SubmitButton>
    </form>
  );
}
