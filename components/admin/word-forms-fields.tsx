"use client";

import { useState } from "react";

// Repeatable "Forms" (conjugations/inflections) and "Examples" (sentence
// pairs) sections for the word create/edit forms. Submitted as indexed
// FormData fields (`forms.0.labelEn`, `examples.0.formClientId`, ...) parsed
// server-side by `replaceWordFormsAndExamples` in
// lib/actions/admin-content.ts. `clientId` has no meaning to the database —
// it's generated here purely to let an example row's "which form is this?"
// dropdown reference a form row that may not have a real id yet (a form
// being added in this same submission, on create especially).

type FormRow = { clientId: string; labelEn: string; labelJa: string; value: string };
type ExampleRow = { clientId: string; en: string; ja: string; formClientId: string };

export type WordFormsFieldsInitialForm = { id: string; labelEn: string; labelJa: string; value: string };
export type WordFormsFieldsInitialExample = {
  id: string;
  formId: string | null;
  en: string;
  ja: string;
};

type WordFormsFieldsProps = {
  initialForms?: WordFormsFieldsInitialForm[];
  initialExamples?: WordFormsFieldsInitialExample[];
};

let rowSeq = 0;
function newClientId(): string {
  rowSeq += 1;
  return `new-${rowSeq}`;
}

const inputClass =
  "rounded-lg border border-sumi/15 bg-washi px-3 py-2 text-sm text-sumi placeholder:text-sumi-soft/50 outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft";

export function WordFormsFields({
  initialForms = [],
  initialExamples = [],
}: WordFormsFieldsProps) {
  const [forms, setForms] = useState<FormRow[]>(
    initialForms.map((form) => ({ clientId: form.id, ...form })),
  );
  const [examples, setExamples] = useState<ExampleRow[]>(
    initialExamples.map((example) => ({
      clientId: example.id,
      en: example.en,
      ja: example.ja,
      formClientId: example.formId ?? "",
    })),
  );

  const addForm = () =>
    setForms((current) => [
      ...current,
      { clientId: newClientId(), labelEn: "", labelJa: "", value: "" },
    ]);

  const removeForm = (clientId: string) => {
    setForms((current) => current.filter((row) => row.clientId !== clientId));
    setExamples((current) =>
      current.map((row) => (row.formClientId === clientId ? { ...row, formClientId: "" } : row)),
    );
  };

  const updateForm = (clientId: string, field: keyof Omit<FormRow, "clientId">, value: string) =>
    setForms((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, [field]: value } : row)),
    );

  const addExample = () =>
    setExamples((current) => [
      ...current,
      { clientId: newClientId(), en: "", ja: "", formClientId: "" },
    ]);

  const removeExample = (clientId: string) =>
    setExamples((current) => current.filter((row) => row.clientId !== clientId));

  const updateExample = (clientId: string, field: keyof Omit<ExampleRow, "clientId">, value: string) =>
    setExamples((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, [field]: value } : row)),
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-sumi-soft">
            Forms <span className="opacity-70">(conjugations/inflections, optional)</span>
          </span>
          <button
            type="button"
            onClick={addForm}
            className="text-sm font-medium text-ai-dark transition hover:text-ai"
          >
            + Add form
          </button>
        </div>

        {forms.map((form, index) => (
          <div
            key={form.clientId}
            className="grid grid-cols-1 gap-2 rounded-lg border border-sumi/10 bg-washi p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <input type="hidden" name={`forms.${index}.clientId`} value={form.clientId} />
            <label className="flex flex-col gap-1 text-xs text-sumi-soft">
              Label (English)
              <input
                name={`forms.${index}.labelEn`}
                value={form.labelEn}
                onChange={(event) => updateForm(form.clientId, "labelEn", event.target.value)}
                placeholder="e.g. Past simple"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-sumi-soft">
              Label (Japanese)
              <input
                name={`forms.${index}.labelJa`}
                value={form.labelJa}
                onChange={(event) => updateForm(form.clientId, "labelJa", event.target.value)}
                placeholder="例：過去形"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-sumi-soft">
              Value
              <input
                name={`forms.${index}.value`}
                value={form.value}
                onChange={(event) => updateForm(form.clientId, "value", event.target.value)}
                placeholder="e.g. went"
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={() => removeForm(form.clientId)}
              className="h-9 rounded-full border border-sumi/15 px-3 text-xs font-medium text-sumi-soft transition hover:border-shu/40 hover:text-shu-dark"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-sumi-soft">
            Example sentences <span className="opacity-70">(optional)</span>
          </span>
          <button
            type="button"
            onClick={addExample}
            className="text-sm font-medium text-ai-dark transition hover:text-ai"
          >
            + Add example
          </button>
        </div>

        {examples.map((example, index) => (
          <div
            key={example.clientId}
            className="flex flex-col gap-2 rounded-lg border border-sumi/10 bg-washi p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-sumi-soft">
                English sentence
                <input
                  name={`examples.${index}.en`}
                  value={example.en}
                  onChange={(event) => updateExample(example.clientId, "en", event.target.value)}
                  placeholder="She goes by bus."
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-sumi-soft">
                Japanese sentence
                <input
                  name={`examples.${index}.ja`}
                  value={example.ja}
                  onChange={(event) => updateExample(example.clientId, "ja", event.target.value)}
                  placeholder="彼女はバスで行きます。"
                  className={inputClass}
                />
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs text-sumi-soft">
                Demonstrates which form?
                <select
                  name={`examples.${index}.formClientId`}
                  value={example.formClientId}
                  onChange={(event) =>
                    updateExample(example.clientId, "formClientId", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">General example (no specific form)</option>
                  {forms.map((form) => (
                    <option key={form.clientId} value={form.clientId}>
                      {form.labelEn || "Untitled form"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => removeExample(example.clientId)}
                className="h-9 rounded-full border border-sumi/15 px-3 text-xs font-medium text-sumi-soft transition hover:border-shu/40 hover:text-shu-dark"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
