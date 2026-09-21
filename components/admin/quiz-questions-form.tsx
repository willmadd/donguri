"use client";

import { useActionState } from "react";
import { saveQuizQuestions } from "@/lib/actions/admin-content";
import {
  WordQuizQuestionsFields,
  type WordQuizQuestionsFieldsInitial,
} from "@/components/admin/word-quiz-questions-fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

type QuizQuestionsFormProps = {
  wordId: string;
  initialQuestions: WordQuizQuestionsFieldsInitial[];
};

export function QuizQuestionsForm({ wordId, initialQuestions }: QuizQuestionsFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveQuizQuestions, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="wordId" value={wordId} />
      <WordQuizQuestionsFields initialQuestions={initialQuestions} />
      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>{state.message}</p>
      )}
      <SubmitButton pending={pending} pendingText={t("common.saving", "Saving…")}>
        {t("admin_quiz_form.submit", "Save quiz questions")}
      </SubmitButton>
    </form>
  );
}
