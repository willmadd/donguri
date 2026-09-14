"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";

type ProfileFormProps = {
  fullName: string;
  donguriConfigText: string;
};

export function ProfileForm({ fullName, donguriConfigText }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField label="Name" name="fullName" defaultValue={fullName} errors={state?.errors?.fullName} />
      <TextareaField
        label="Donguri configuration"
        name="donguriConfig"
        placeholder="{}"
        rows={8}
        defaultValue={donguriConfigText}
        errors={state?.errors?.donguriConfig}
      />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>{state.message}</p>
      )}
      <SubmitButton pending={pending} pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
