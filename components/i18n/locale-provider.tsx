"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type TFunction } from "@/lib/i18n/translate";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

type LocaleContextValue = { locale: Locale; t: TFunction };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: createTranslator(dictionary) }),
    [locale, dictionary],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useTranslations/useLocale must be used within LocaleProvider");
  return ctx;
}

export function useTranslations(): TFunction {
  return useLocaleContext().t;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
