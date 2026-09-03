"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createWord } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { SubmitButton } from "@/components/ui/submit-button";

type CreateWordFormProps = {
  lessonId: string;
};

export function CreateWordForm({ lessonId }: CreateWordFormProps) {
  const [state, action, pending] = useActionState(createWord, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Clears the form after each successful add so the admin can go straight
  // into the next word without re-navigating.
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the local preview must follow the server action's own success signal, which only arrives via this effect.
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
      <input type="hidden" name="lessonId" value={lessonId} />
      <TextField label="Term" name="term" errors={state?.errors?.term} />
      <TextField
        label="Translation"
        name="translation"
        errors={state?.errors?.translation}
      />
      <TextField
        label="Romanization"
        name="romanization"
        required={false}
        placeholder="Optional pronunciation aid"
        errors={state?.errors?.romanization}
      />
      <TextareaField
        label="Example sentence"
        name="exampleSentence"
        placeholder="Optional"
        errors={state?.errors?.exampleSentence}
      />
      <FileField
        label="Picture"
        name="image"
        accept="image/webp,image/png,image/jpeg"
        onChange={handleImageChange}
        errors={state?.errors?.image}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a hosted asset.
        <img
          src={previewUrl}
          alt="Preview"
          className="h-32 w-32 rounded-lg object-cover"
        />
      )}
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton pending={pending} pendingText="Adding…">
        Add word
      </SubmitButton>
    </form>
  );
}
