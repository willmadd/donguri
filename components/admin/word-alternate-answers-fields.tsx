"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

// Repeatable "alternate answers" section for the word create/edit forms —
// extra accepted spellings (e.g. "3" or "三" alongside "Three") checked
// alongside the word's own term/translation, regardless of which side the
// learner is typing (see matchesTypedAnswer in lib/actions/vocab.ts).
// Submitted as indexed FormData fields (`alternateAnswers.0.value`, ...)
// parsed server-side by `replaceWordAlternateAnswers` in
// lib/actions/admin-content.ts.

type AlternateAnswerRow = { clientId: string; value: string };

export type WordAlternateAnswersFieldsInitial = { id: string; value: string };

let rowSeq = 0;
function newClientId(): string {
  rowSeq += 1;
  return `new-${rowSeq}`;
}

const inputClass =
  "rounded-lg border border-sumi/15 bg-washi px-3 py-2 text-sm text-sumi placeholder:text-sumi-soft/50 outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft";

export function WordAlternateAnswersFields({
  initialAlternateAnswers = [],
}: {
  initialAlternateAnswers?: WordAlternateAnswersFieldsInitial[];
}) {
  const t = useTranslations();
  const [rows, setRows] = useState<AlternateAnswerRow[]>(
    initialAlternateAnswers.map((row) => ({ clientId: row.id, value: row.value })),
  );

  const addRow = () => setRows((current) => [...current, { clientId: newClientId(), value: "" }]);

  const removeRow = (clientId: string) =>
    setRows((current) => current.filter((row) => row.clientId !== clientId));

  const updateRow = (clientId: string, value: string) =>
    setRows((current) => current.map((row) => (row.clientId === clientId ? { ...row, value } : row)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-sumi-soft">
          {t("admin_word_alternate_answers.label", "Alternative spellings")}{" "}
          <span className="opacity-70">
            {t(
              "admin_word_alternate_answers.hint",
              "(other accepted typed answers, e.g. \"3\" for \"Three\" — optional)",
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-ai-dark transition hover:text-ai"
        >
          {t("admin_word_alternate_answers.add", "+ Add alternative")}
        </button>
      </div>

      {rows.map((row, index) => (
        <div key={row.clientId} className="flex items-center gap-2">
          <input
            name={`alternateAnswers.${index}.value`}
            value={row.value}
            onChange={(event) => updateRow(row.clientId, event.target.value)}
            placeholder={t("admin_word_alternate_answers.placeholder", "e.g. 3")}
            className={`flex-1 ${inputClass}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeRow(row.clientId)}
            className="px-3 text-xs hover:border-shu/40 hover:text-shu-dark"
          >
            {t("common.remove", "Remove")}
          </Button>
        </div>
      ))}
    </div>
  );
}
