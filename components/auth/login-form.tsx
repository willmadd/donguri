"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function LoginForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
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
        autoComplete="current-password"
        placeholder="••••••••"
        errors={state?.errors?.password}
      />
      <div className="-mt-1 text-right text-sm">
        <a href="/forgot-password" className="text-ai hover:text-ai-dark">
          {t("auth.forgot_password_link", "Forgot password?")}
        </a>
      </div>
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}
      <SubmitButton pending={pending} pendingText={t("auth.logging_in", "Logging in…")}>
        {t("auth.log_in_button", "Log in")}
      </SubmitButton>
    </form>
  );
}
