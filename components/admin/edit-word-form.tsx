"use client";

import { useActionState } from "react";
import { updateWord } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordImage } from "@/components/ui/word-image";
import { WordFormsFields } from "@/components/admin/word-forms-fields";
import { WordAlternateAnswersFields } from "@/components/admin/word-alternate-answers-fields";
import { useTranslations } from "@/components/i18n/locale-provider";
import { WORD_TYPES, type AdminWordSummary, type WordCategoryOption } from "@/lib/definitions";

type EditWordFormProps = {
  word: AdminWordSummary;
  currentImageSrc: string;
  categories: WordCategoryOption[];
};

const WORD_TYPE_OPTIONS = WORD_TYPES.map((type) => ({
  value: type,
  label: type[0].toUpperCase() + type.slice(1),
}));

const PATH_OPTIONS = [
  { value: "vocab", label: "Vocabulary" },
  { value: "grammar", label: "Grammar point" },
];

const sectionHeadingClass = "text-sm font-semibold uppercase tracking-wide text-sumi-soft";

export function EditWordForm({ word, currentImageSrc, categories }: EditWordFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateWord, undefined);

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="wordId" value={word.id} />

      <section className="flex flex-col gap-4">
        <h2 className={sectionHeadingClass}>{t("admin_word_form.section_basics", "Basics")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("admin_word_form.term", "Term")}
            name="term"
            defaultValue={word.term}
            errors={state?.errors?.term}
          />
          <TextField
            label={t("admin_word_form.translation", "Translation")}
            name="translation"
            defaultValue={word.translation}
            errors={state?.errors?.translation}
          />
          <TextField
            label={t("admin_word_form.romanization", "Romanization")}
            name="romanization"
            required={false}
            placeholder={t("admin_word_form.romanization_placeholder", "Optional pronunciation aid")}
            defaultValue={word.romanization ?? ""}
            errors={state?.errors?.romanization}
          />
          <SelectField
            label={t("admin_word_form.content_type", "Content")}
            name="path"
            defaultValue={word.path}
            options={PATH_OPTIONS}
            errors={state?.errors?.path}
          />
          <SelectField
            label={t("admin_word_form.category", "Category")}
            name="categoryId"
            required={false}
            placeholder={t("admin_word_form.no_category", "No category")}
            defaultValue={word.category?.id ?? ""}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            errors={state?.errors?.categoryId}
          />
          <SelectField
            label={t("admin_word_form.word_type", "Word type")}
            name="wordType"
            required={false}
            placeholder={t("admin_word_form.no_word_type", "No word type")}
            defaultValue={word.wordType ?? ""}
            options={WORD_TYPE_OPTIONS}
            errors={state?.errors?.wordType}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-sumi/10 pt-6">
        <h2 className={sectionHeadingClass}>{t("admin_word_form.section_description", "Description")}</h2>
        <TextareaField
          label={t("admin_word_form.example_sentence", "Example sentence")}
          name="exampleSentence"
          placeholder={t("common.optional", "Optional")}
          defaultValue={word.exampleSentence ?? ""}
          errors={state?.errors?.exampleSentence}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextareaField
            label={t("admin_word_form.explanation_en", "Explanation (English)")}
            name="explanation"
            placeholder={t(
              "admin_word_form.explanation_en_placeholder",
              "Optional — a plain-language definition",
            )}
            defaultValue={word.explanation ?? ""}
            errors={state?.errors?.explanation}
          />
          <TextareaField
            label={t("admin_word_form.explanation_ja", "Explanation (Japanese)")}
            name="explanationJa"
            placeholder={t("common.optional", "Optional")}
            defaultValue={word.explanationJa ?? ""}
            errors={state?.errors?.explanationJa}
          />
        </div>
      </section>

      <div className="border-t border-sumi/10 pt-6">
        <WordFormsFields initialForms={word.forms} initialExamples={word.examples} />
      </div>

      <div className="border-t border-sumi/10 pt-6">
        <WordAlternateAnswersFields initialAlternateAnswers={word.alternateAnswers} />
      </div>

      <section className="flex flex-col gap-4 border-t border-sumi/10 pt-6">
        <h2 className={sectionHeadingClass}>{t("admin_word_form.section_image", "Image")}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-sumi-soft">
              {t("admin_word_form.current_image", "Current image")}
            </span>
            <WordImage
              src={currentImageSrc}
              alt={word.term}
              className="h-20 w-20 rounded-lg object-cover"
            />
          </div>
          <div className="min-w-60 flex-1">
            <FileField
              label={t("admin_word_form.replace_image", "Replace image")}
              name="image"
              accept="image/webp,image/png,image/jpeg"
              errors={state?.errors?.image}
            />
          </div>
        </div>
      </section>

      {state?.message && <p className="text-sm text-shu">{state.message}</p>}

      <SubmitButton pending={pending} pendingText={t("common.saving", "Saving…")}>
        {t("admin_word_form.save_changes", "Save changes")}
      </SubmitButton>
    </form>
  );
}
