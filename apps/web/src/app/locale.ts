import type { Locale } from "@seminar/contracts";
import { STORAGE_KEYS } from "@seminar/utils";

export function detectInitialLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEYS.locale);
  if (saved === "ru" || saved === "en") {
    return saved;
  }

  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function persistLocale(locale: Locale) {
  window.localStorage.setItem(STORAGE_KEYS.locale, locale);
}