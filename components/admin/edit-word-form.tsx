"use client";

import { useActionState } from "react";
import { updateWord } from "@/lib/actions/admin-content";
import { TextField } from "@/components/ui/text-field";
import { TextareaField } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordImage } from "@/components/ui/word-image";
import type { AdminWordSummary } from "@/lib/definitions";

type EditWordFormProps = {
  word: AdminWordSummary;
  currentImageSrc: string;
};

export function EditWordForm({ word, currentImageSrc }: EditWordFormProps) {
  const [state, action, pending] = useActionState(updateWord, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="wordId" value={word.id} />
      <TextField
        label="Term"
        name="term"
        defaultValue={word.term}
        errors={state?.errors?.term}
      />
      <TextField
        label="Translation"
        name="translation"
        defaultValue={word.translation}
        errors={state?.errors?.translation}
      />
      <TextField
        label="Romanization"
        name="romanization"
        required={false}
        placeholder="Optional pronunciation aid"
        defaultValue={word.romanization ?? ""}
        errors={state?.errors?.romanization}
      />
      <TextareaField
        label="Example sentence"
        name="exampleSentence"
        placeholder="Optional"
        defaultValue={word.exampleSentence ?? ""}
        errors={state?.errors?.exampleSentence}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-sumi-soft">Current image</span>
        <WordImage
          src={currentImageSrc}
          alt={word.term}
          className="h-20 w-20 rounded-lg object-cover"
        />
      </div>
      <FileField
        label="Replace image"
        name="image"
        accept="image/webp,image/png,image/jpeg"
        errors={state?.errors?.image}
      />

      {state?.message && <p className="text-sm text-shu">{state.message}</p>}

      <SubmitButton pending={pending} pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
