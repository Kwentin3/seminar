import type { ThemeName } from "@seminar/contracts";
import { STORAGE_KEYS } from "@seminar/utils";

export function detectInitialTheme(): ThemeName {
  const saved = window.localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function persistTheme(theme: ThemeName) {
  window.localStorage.setItem(STORAGE_KEYS.theme, theme);
}