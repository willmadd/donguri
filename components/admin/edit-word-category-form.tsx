"use client";

import { useActionState, useTransition } from "react";
import { deleteWordCategory, updateWordCategory } from "@/lib/actions/admin-content";
import { SubmitButton } from "@/components/ui/submit-button";
import type { WordCategoryOption } from "@/lib/definitions";

type EditWordCategoryFormProps = {
  category: WordCategoryOption;
};

export function EditWordCategoryForm({ category }: EditWordCategoryFormProps) {
  const [state, action, pending] = useActionState(updateWordCategory, undefined);
  const [deleting, startDeleteTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Delete "${category.name}"? Words using it become uncategorized.`)) return;
    startDeleteTransition(() => deleteWordCategory(category.id));
  };

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-4">
      <input type="hidden" name="categoryId" value={category.id} />
      <input
        type="color"
        name="color"
        defaultValue={category.color}
        aria-label={`${category.name} color`}
        className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-sumi/15 bg-washi"
      />
      <input
        type="text"
        name="name"
        defaultValue={category.name}
        aria-label="Category name"
        className="min-w-0 flex-1 rounded-lg border border-sumi/15 bg-washi px-4 py-2.5 text-sumi outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft"
      />
      <SubmitButton pending={pending} pendingText="Saving…">
        Save
      </SubmitButton>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex h-10 items-center justify-center rounded-full border border-shu/30 px-5 text-sm font-medium text-shu transition hover:bg-shu/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Delete
      </button>
      {state?.message && (
        <p className={`w-full text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
