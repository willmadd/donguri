"use client";

import { useActionState } from "react";
import { adminResetPassword } from "@/lib/actions/admin";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function AdminResetPasswordForm() {
  const [state, action, pending] = useActionState(adminResetPassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="User email"
        name="email"
        type="email"
        autoComplete="off"
        placeholder="user@example.com"
        errors={state?.errors?.email}
      />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        errors={state?.errors?.password}
      />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending} pendingText="Updating…">
        Reset password
      </SubmitButton>
    </form>
  );
}
