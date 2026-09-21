"use client";

import { useId, useState } from "react";

type ColorFieldProps = {
  label: string;
  name: string;
  defaultValue?: string;
  clearLabel?: string;
  errors?: string[];
};

// A native color-picker swatch paired with the hex text input that actually
// submits — needed because this field is optional (unlike the required
// `WordCategory.color` picker elsewhere) and `<input type="color">` alone
// has no empty state: it always carries a value and always submits one.
// The swatch just edits the same value the text input holds.
export function ColorField({ label, name, defaultValue = "", clearLabel, errors }: ColorFieldProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-sumi-soft">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => setValue(e.target.value)}
          aria-label={label}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-sumi/15 bg-washi"
        />
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#f8ead2"
          aria-invalid={errors && errors.length > 0}
          className="min-w-0 flex-1 rounded-lg border border-sumi/15 bg-washi px-4 py-2.5 text-sumi outline-none transition placeholder:text-sumi-soft/50 focus:border-ai focus:ring-2 focus:ring-ai-soft"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="shrink-0 text-xs font-medium text-sumi-soft underline hover:text-sumi"
          >
            {clearLabel ?? "Clear"}
          </button>
        )}
      </div>
      {errors?.map((error) => (
        <p key={error} className="text-sm text-shu">
          {error}
        </p>
      ))}
    </div>
  );
}
