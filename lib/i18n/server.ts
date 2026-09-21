import { getLocale } from "./get-locale";
import { getDictionary } from "./dictionaries";
import { createTranslator, type TFunction } from "./translate";
import type { Locale } from "./config";

// For Server Components — `const { t } = await getTranslator();`. Client
// Components use `useTranslations()` from components/i18n/locale-provider
// instead, since they can't await.
export async function getTranslator(): Promise<{ t: TFunction; locale: Locale }> {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  return { t: createTranslator(dictionary), locale };
}
