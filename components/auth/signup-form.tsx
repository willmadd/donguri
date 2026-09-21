"use client";

import { useActionState } from "react";
import { signup } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function SignupForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(signup, undefined);

  if (state?.message && !state.errors) {
    return <p className="text-sm text-sumi">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label={t("auth.first_name_label", "First name")}
        name="firstName"
        autoComplete="given-name"
        placeholder="Yuki"
        errors={state?.errors?.firstName}
      />
      <TextField
        label={t("auth.last_name_label", "Last name")}
        name="lastName"
        autoComplete="family-name"
        placeholder="Tanaka"
        errors={state?.errors?.lastName}
      />
      <TextField
        label={t("auth.email_label", "Email")}
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        errors={state?.errors?.email}
      />
      <TextField
        label={t("auth.password_label", "Password")}
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={t("auth.password_placeholder", "At least 8 characters")}
        errors={state?.errors?.password}
      />
      <SubmitButton pending={pending} pendingText={t("auth.creating_account", "Creating account…")}>
        {t("auth.sign_up_button", "Sign up")}
      </SubmitButton>
    </form>
  );
}
