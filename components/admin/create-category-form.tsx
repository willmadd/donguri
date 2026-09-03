"use client";

import { useActionState } from "react";
import { createCategory } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";

type CreateCategoryFormProps = {
  courseId: string;
};

export function CreateCategoryForm({ courseId }: CreateCategoryFormProps) {
  const [state, action, pending] = useActionState(createCategory, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <TextField
        label="Category title"
        name="title"
        placeholder="e.g. Weather"
        errors={state?.errors?.title}
      />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending} pendingText="Creating…">
        Create category
      </SubmitButton>
    </form>
  );
}
