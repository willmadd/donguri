"use client";

import { useActionState } from "react";
import { forgotPassword } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);

  if (state?.success) {
    return <p className="text-sm text-sumi">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        errors={state?.errors?.email}
      />
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}
      <SubmitButton pending={pending} pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
