"use client";

import { useActionState, useEffect, useRef } from "react";
import { createWordCategory } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function CreateWordCategoryForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(createWordCategory, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <TextField
        label={t("admin_word_category_form.name", "Name")}
        name="name"
        placeholder="e.g. Food & Drink"
        errors={state?.errors?.name}
      />
      <TextField
        label={t("admin_word_category_form.color", "Color")}
        name="color"
        type="color"
        defaultValue="#2563eb"
        errors={state?.errors?.color}
      />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending} pendingText={t("admin_create_category.creating", "Creating…")}>
        {t("admin_word_category_form.submit", "Create category")}
      </SubmitButton>
    </form>
  );
}
