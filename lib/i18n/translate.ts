import type { Dictionary } from "./dictionaries";

export type TranslateParams = Record<string, string | number>;
export type TFunction = (key: string, fallback: string, params?: TranslateParams) => string;

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

// A missing or empty dictionary entry (e.g. a ja.json key not translated
// yet) falls back to the English default passed at the call site — this is
// what lets the app run fully in English before any translation exists.
export function translate(
  dictionary: Dictionary,
  key: string,
  fallback: string,
  params?: TranslateParams,
): string {
  const template = dictionary[key] || fallback;
  return interpolate(template, params);
}

export function createTranslator(dictionary: Dictionary): TFunction {
  return (key, fallback, params) => translate(dictionary, key, fallback, params);
}
