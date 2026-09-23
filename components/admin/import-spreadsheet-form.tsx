"use client";

import { useActionState } from "react";
import { importWordsFromSpreadsheet } from "@/lib/actions/admin-content";
import { FileField } from "@/components/ui/file-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function ImportSpreadsheetForm({ languageDeckId }: { languageDeckId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(importWordsFromSpreadsheet, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="languageDeckId" value={languageDeckId} />

      <FileField
        label={t("admin_import_spreadsheet.file", "Spreadsheet")}
        name="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        errors={state?.errors?.file}
      />

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
