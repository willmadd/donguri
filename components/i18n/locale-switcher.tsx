"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";
import { useLocale } from "@/components/i18n/locale-provider";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const handleChange = (next: Locale) => {
    if (next === locale || pending) return;
    startTransition(() => setLocale(next));
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center rounded-full border border-sumi/15 p-0.5 text-xs font-medium",
        className,
      )}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          disabled={pending}
          aria-pressed={locale === code}
          aria-label={LOCALE_LABELS[code]}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase transition disabled:cursor-not-allowed disabled:opacity-60",
            locale === code ? "bg-ai text-washi" : "text-sumi-soft hover:text-sumi",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
