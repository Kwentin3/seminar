import type { Locale, ThemeName } from "@seminar/contracts";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { detectInitialLocale, persistLocale } from "./locale";
import { MESSAGES, type AppMessages } from "./messages";
import { applyTheme, detectInitialTheme, persistTheme } from "./theme";

type AppContextValue = {
  locale: Locale;
  messages: AppMessages;
  setLocale: (next: Locale) => void;
  theme: ThemeName;
  toggleTheme: () => void;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());
  const [theme, setTheme] = useState<ThemeName>(() => detectInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      locale,
      messages: MESSAGES[locale],
      setLocale,
      theme,
      toggleTheme
    }),
    [locale, setLocale, theme, toggleTheme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}