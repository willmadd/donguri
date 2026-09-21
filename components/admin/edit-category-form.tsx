"use client";

import { useActionState } from "react";
import { updateCategory } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { ColorField } from "@/components/ui/color-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordImage } from "@/components/ui/word-image";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { AdminCategoryDetail } from "@/lib/definitions";

type EditCategoryFormProps = {
  category: AdminCategoryDetail;
  currentCoverImageSrc: string | null;
};

export function EditCategoryForm({ category, currentCoverImageSrc }: EditCategoryFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateCategory, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="languageDeckId" value={category.id} />
      <TextField
        label={t("admin_create_category.title_label", "Deck title")}
        name="title"
        defaultValue={category.title}
        errors={state?.errors?.title}
      />
      <TextField
        label={t("admin_create_category.subheading_label", "Subheading")}
        name="subheading"
        required={false}
        placeholder={t("common.optional", "Optional")}
        defaultValue={category.subheading ?? ""}
        errors={state?.errors?.subheading}
      />
      <TextareaField
        label={t("admin_create_category.description_label", "Description")}
        name="description"
        placeholder={t("common.optional", "Optional")}
        defaultValue={category.description ?? ""}
        errors={state?.errors?.description}
      />

      {currentCoverImageSrc && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-sumi-soft">
            {t("admin_edit_category.current_cover_image", "Current cover photo")}
          </span>
          <WordImage
            src={currentCoverImageSrc}
            alt={category.title}
            className="h-32 w-full rounded-lg object-cover"
          />
        </div>
      )}
      <FileField
        label={t("admin_edit_category.replace_cover_image", "Replace cover photo")}
        name="coverImage"
        accept="image/webp,image/png,image/jpeg"
        errors={state?.errors?.coverImage}
      />
      <ColorField
        label={t("admin_create_category.bg_color_label", "Background color")}
        name="bgColor"
        defaultValue={category.bgColor ?? ""}
        clearLabel={t("common.clear", "Clear")}
        errors={state?.errors?.bgColor}
      />
      <ColorField
        label={t("admin_create_category.primary_color_label", "Primary color")}
        name="primaryColor"
        defaultValue={category.primaryColor ?? ""}
        clearLabel={t("common.clear", "Clear")}
        errors={state?.errors?.primaryColor}
      />

      {state?.message && <p className="text-sm text-shu">{state.message}</p>}

      <SubmitButton pending={pending} pendingText={t("common.saving", "Saving…")}>
        {t("admin_word_form.save_changes", "Save changes")}
      </SubmitButton>
    </form>
  );
}
