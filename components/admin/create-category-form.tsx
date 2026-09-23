"use client";

import { useActionState, useState } from "react";
import { createCategory } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { ColorField } from "@/components/ui/color-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

type CreateCategoryFormProps = {
  courseId: string;
};

export function CreateCategoryForm({ courseId }: CreateCategoryFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(createCategory, undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleCoverImageChange = (file: File | null) => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <TextField
        label={t("admin_create_category.title_label", "Deck title")}
        name="title"
        placeholder="e.g. Weather"
        errors={state?.errors?.title}
      />
      <TextField
        label={t("admin_create_category.subheading_label", "Subheading")}
        name="subheading"
        required={false}
        placeholder={t("common.optional", "Optional")}
        errors={state?.errors?.subheading}
      />
      <TextareaField
        label={t("admin_create_category.description_label", "Description")}
        name="description"
        placeholder={t("common.optional", "Optional")}
        errors={state?.errors?.description}
      />
      <TextField
        label={t("admin_create_category.tags_label", "Tags")}
        name="tags"
        required={false}
        placeholder={t(
          "admin_create_category.tags_placeholder",
          "e.g. Beginner, JLPT N5 (comma-separated)",
        )}
        errors={state?.errors?.tags}
      />
      <FileField
        label={t("admin_create_category.cover_image_label", "Cover photo")}
        name="coverImage"
        accept="image/webp,image/png,image/jpeg"
        onChange={handleCoverImageChange}
        errors={state?.errors?.coverImage}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a hosted asset.
        <img
          src={previewUrl}
          alt={t("common.preview", "Preview")}
          className="h-32 w-full rounded-lg object-cover"
        />
      )}
      <ColorField
        label={t("admin_create_category.bg_color_label", "Background color")}
        name="bgColor"
        clearLabel={t("common.clear", "Clear")}
        errors={state?.errors?.bgColor}
      />
      <ColorField
        label={t("admin_create_category.primary_color_label", "Primary color")}
        name="primaryColor"
        clearLabel={t("common.clear", "Clear")}
        errors={state?.errors?.primaryColor}
      />
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}
      <SubmitButton pending={pending} pendingText={t("admin_create_category.creating", "Creating…")}>
        {t("admin_create_category.submit", "Create deck")}
      </SubmitButton>
    </form>
  );
}
