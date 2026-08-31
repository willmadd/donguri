"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

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
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        errors={state?.errors?.password}
      />
      <div className="-mt-1 text-right text-sm">
        <a href="/forgot-password" className="text-ai hover:text-ai-dark">
          Forgot password?
        </a>
      </div>
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}
      <SubmitButton pending={pending} pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
