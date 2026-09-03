"use client";

import { useActionState } from "react";
import { importWords } from "@/lib/actions/admin-content";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordImage } from "@/components/ui/word-image";
import type { AdminWordSummary } from "@/lib/definitions";

type ImportWordsFormProps = {
  targetLessonId: string;
  // `imageSrc` is precomputed server-side (via `wordImagePath`, which pulls
  // in the server-only bunny.net client) so this client component never has
  // to import that chain itself.
  words: (AdminWordSummary & { imageSrc: string })[];
};

export function ImportWordsForm({ targetLessonId, words }: ImportWordsFormProps) {
  const [state, action, pending] = useActionState(importWords, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="targetLessonId" value={targetLessonId} />

      <div className="flex flex-col gap-2">
        {words.map((word) => (
          <label
            key={word.id}
            className="flex items-center gap-3 rounded-lg border border-sumi/10 bg-washi p-3"
          >
            <input type="checkbox" name="wordIds" value={word.id} className="size-4" />
            <WordImage
              src={word.imageSrc}
              alt={word.term}
              className="h-10 w-10 rounded-md object-cover"
            />
            <span className="text-sm text-sumi">
              {word.term} — {word.translation}
            </span>
          </label>
        ))}
      </div>

      {state?.errors?.wordIds?.map((error) => (
        <p key={error} className="text-sm text-shu">
          {error}
        </p>
      ))}
      {state?.message && <p className="text-sm text-shu">{state.message}</p>}

      <SubmitButton pending={pending} pendingText="Importing…">
        Import selected words
      </SubmitButton>
    </form>
  );
}
