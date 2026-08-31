"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        errors={state?.errors?.password}
      />
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}
      <SubmitButton pending={pending} pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
