"use client";

import { useActionState } from "react";
import { bulkImportQuizQuestions } from "@/lib/actions/admin-content";
import { SubmitButton } from "@/components/ui/submit-button";

const EXAMPLE = `[
  {
    "prompt": "What does \\"Hello\\" mean?",
    "options": ["A greeting", "A farewell", "A question"],
    "correctIndex": 0
  }
]`;

export function BulkImportQuizQuestionsForm({ wordId }: { wordId: string }) {
  const [state, action, pending] = useActionState(bulkImportQuizQuestions, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="wordId" value={wordId} />
      <p className="text-sm text-sumi-soft">
        An array of <code>{"{ prompt, promptJa?, options: string[], correctIndex }"}</code> objects
        — added to the questions above, not replacing them.
      </p>
      <textarea
        name="json"
        rows={8}
        placeholder={EXAMPLE}
        className="rounded-lg border border-sumi/15 bg-washi px-3 py-2 font-mono text-xs text-sumi outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft"
      />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>{state.message}</p>
      )}
      <SubmitButton pending={pending} pendingText="Importing…">
        Import questions
      </SubmitButton>
    </form>
  );
}
