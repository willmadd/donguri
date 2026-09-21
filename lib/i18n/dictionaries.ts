import en from "./locales/en.json";
import ja from "./locales/ja.json";
import type { Locale } from "./config";

export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Locale, Dictionary> = { en, ja };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
