"use client";

import { useActionState } from "react";
import { signup } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  if (state?.message && !state.errors) {
    return <p className="text-sm text-sumi">{state.message}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="Name"
        name="fullName"
        autoComplete="name"
        placeholder="Yuki Tanaka"
        errors={state?.errors?.fullName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        errors={state?.errors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        errors={state?.errors?.password}
      />
      <SubmitButton pending={pending} pendingText="Creating account…">
        Sign up
      </SubmitButton>
    </form>
  );
}
