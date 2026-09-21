"use client";

import { useActionState } from "react";
import { bulkImportQuizQuestions } from "@/lib/actions/admin-content";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

const EXAMPLE = `[
  {
    "prompt": "What does \\"Hello\\" mean?",
    "options": ["A greeting", "A farewell", "A question"],
    "correctIndex": 0
  }
]`;

export function BulkImportQuizQuestionsForm({ wordId }: { wordId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(bulkImportQuizQuestions, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="wordId" value={wordId} />
      <p className="text-sm text-sumi-soft">
        {t(
          "admin_bulk_import.hint",
          "An array of {{shape}} objects — added to the questions above, not replacing them.",
          { shape: "{ prompt, promptJa?, options: string[], correctIndex }" },
        )}
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
      <SubmitButton pending={pending} pendingText={t("admin_bulk_import.importing", "Importing…")}>
        {t("admin_bulk_import.submit", "Import questions")}
      </SubmitButton>
    </form>
  );
}
