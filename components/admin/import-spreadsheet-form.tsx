"use client";

import { useActionState, useState, type FormEvent } from "react";
import { importWordsFromSpreadsheet } from "@/lib/actions/admin-content";
import { FileField } from "@/components/ui/file-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function ImportSpreadsheetForm({ languageDeckId }: { languageDeckId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(importWordsFromSpreadsheet, undefined);
  const [deactivateMissing, setDeactivateMissing] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (
      deactivateMissing &&
      !confirm(
        t(
          "admin_import_spreadsheet.confirm_deactivate_missing",
          "This will deactivate every word in this deck that isn't in the file you're about to upload. Continue?",
        ),
      )
    ) {
      event.preventDefault();
    }
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="languageDeckId" value={languageDeckId} />

      <FileField
        label={t("admin_import_spreadsheet.file", "Spreadsheet")}
        name="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        errors={state?.errors?.file}
      />

      <label className="flex items-start gap-2 text-sm text-sumi">
        <input
          type="checkbox"
          name="deactivateMissing"
          checked={deactivateMissing}
          onChange={(event) => setDeactivateMissing(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-sumi/30 text-shu focus:ring-shu"
        />
        <span>
          {t(
            "admin_import_spreadsheet.deactivate_missing_label",
            "Deactivate words in this deck that aren't in this file (matched by Word ID or Term). Their data is kept and this can be undone from the word list — it's just hidden from learners, not deleted.",
          )}
        </span>
      </label>

      {state?.message && (
        <p className={`text-sm ${state.success ? "text-matcha-dark" : "text-shu"}`}>{state.message}</p>
      )}

      {state?.rowErrors && state.rowErrors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-shu/20 bg-shu/5 p-3 text-sm text-shu">
          {state.rowErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {state?.warnings && state.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-kin/30 bg-kin/10 p-3 text-sm text-sumi-soft">
          <p className="font-medium text-sumi">
            {t("admin_import_spreadsheet.warnings_title", "Imported, but a few rows need a look:")}
          </p>
          <ul className="flex flex-col gap-1">
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <SubmitButton pending={pending} pendingText={t("admin_import_spreadsheet.importing", "Importing…")}>
        {t("admin_import_spreadsheet.submit", "Upload and import")}
      </SubmitButton>
    </form>
  );
}
