"use client";

import { useActionState, useTransition } from "react";
import { deleteWordCategory, updateWordCategory } from "@/lib/actions/admin-content";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { WordCategoryOption } from "@/lib/definitions";

type EditWordCategoryFormProps = {
  category: WordCategoryOption;
};

export function EditWordCategoryForm({ category }: EditWordCategoryFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateWordCategory, undefined);
  const [deleting, startDeleteTransition] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(
        t(
          "admin_word_category_form.confirm_delete",
          'Delete "{{name}}"? Words using it become uncategorized.',
          { name: category.name },
        ),
      )
    )
      return;
    startDeleteTransition(() => deleteWordCategory(category.id));
  };

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border bg-washi-soft p-4">
      <input type="hidden" name="categoryId" value={category.id} />
      <input
        type="color"
        name="color"
        defaultValue={category.color}
        aria-label={t("admin_word_category_form.color_aria", "{{name}} color", {
          name: category.name,
        })}
        className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-sumi/15 bg-washi"
      />
      <input
        type="text"
        name="name"
        defaultValue={category.name}
        aria-label={t("admin_word_category_form.name_aria", "Category name")}
        className="min-w-0 flex-1 rounded-lg border border-sumi/15 bg-washi px-4 py-2.5 text-sumi outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft"
      />
      <SubmitButton pending={pending} pendingText={t("common.saving", "Saving…")}>
        {t("common.save", "Save")}
      </SubmitButton>
      <Button
        variant="outline"
        tone="danger"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
      >
        {t("common.delete", "Delete")}
      </Button>
      {state?.message && (
        <p className={`w-full text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
