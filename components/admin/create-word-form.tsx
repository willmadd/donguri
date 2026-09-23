"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createWord } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordFormsFields } from "@/components/admin/word-forms-fields";
import { WordAlternateAnswersFields } from "@/components/admin/word-alternate-answers-fields";
import { useTranslations } from "@/components/i18n/locale-provider";
import { WORD_TYPES, type WordCategoryOption } from "@/lib/definitions";

type CreateWordFormProps = {
  languageDeckId: string;
  categories: WordCategoryOption[];
};

const WORD_TYPE_OPTIONS = WORD_TYPES.map((type) => ({
  value: type,
  label: type[0].toUpperCase() + type.slice(1),
}));

export function CreateWordForm({ languageDeckId, categories }: CreateWordFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(createWord, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Bumped on every success to remount `WordFormsFields` (via its `key`),
  // clearing its internal forms/examples rows the same way `formRef.reset()`
  // clears the plain inputs below — a native form reset alone can't touch
  // that component's own React state.
  const [resetCount, setResetCount] = useState(0);

  // Clears the form after each successful add so the admin can go straight
  // into the next word without re-navigating.
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the local preview/forms-fields state must follow the server action's own success signal, which only arrives via this effect.
      setResetCount((count) => count + 1);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    }
  }, [state]);

  const handleImageChange = (file: File | null) => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="languageDeckId" value={languageDeckId} />
      <TextField label={t("admin_word_form.term", "Term")} name="term" errors={state?.errors?.term} />
      <TextField
        label={t("admin_word_form.translation", "Translation")}
        name="translation"
        errors={state?.errors?.translation}
      />
      <TextField
        label={t("admin_word_form.romanization", "Romanization")}
        name="romanization"
        required={false}
        placeholder={t("admin_word_form.romanization_placeholder", "Optional pronunciation aid")}
        errors={state?.errors?.romanization}
      />
      <TextareaField
        label={t("admin_word_form.example_sentence", "Example sentence")}
        name="exampleSentence"
        placeholder={t("common.optional", "Optional")}
        errors={state?.errors?.exampleSentence}
      />
      <TextareaField
        label={t("admin_word_form.explanation_en", "Explanation (English)")}
        name="explanation"
        placeholder={t(
          "admin_word_form.explanation_en_placeholder",
          "Optional — a plain-language definition",
        )}
        errors={state?.errors?.explanation}
      />
      <TextareaField
        label={t("admin_word_form.explanation_ja", "Explanation (Japanese)")}
        name="explanationJa"
        placeholder={t("common.optional", "Optional")}
        errors={state?.errors?.explanationJa}
      />
      <SelectField
        label={t("admin_word_form.category", "Category")}
        name="categoryId"
        required={false}
        placeholder={t("admin_word_form.no_category", "No category")}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
        errors={state?.errors?.categoryId}
      />
      <SelectField
        label={t("admin_word_form.word_type", "Word type")}
        name="wordType"
        required={false}
        placeholder={t("admin_word_form.no_word_type", "No word type")}
        options={WORD_TYPE_OPTIONS}
        errors={state?.errors?.wordType}
      />
      <WordFormsFields key={resetCount} />
      <WordAlternateAnswersFields key={resetCount} />
      <FileField
        label={t("admin_word_form.picture", "Picture")}
        name="image"
        accept="image/webp,image/png,image/jpeg"
        onChange={handleImageChange}
        errors={state?.errors?.image}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a hosted asset.
        <img
          src={previewUrl}
          alt={t("common.preview", "Preview")}
          className="h-32 w-32 rounded-lg object-cover"
        />
      )}
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending} pendingText={t("admin_word_form.adding", "Adding…")}>
        {t("admin_word_form.add_word", "Add word")}
      </SubmitButton>
    </form>
  );
}
