import { NavLink } from "react-router-dom";
import { classNames } from "@seminar/utils";
import { useAppContext } from "../app/useAppContext";

export function Header() {
  const { locale, messages, setLocale, theme, toggleTheme } = useAppContext();

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xl font-semibold">{messages.header.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{messages.header.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Main navigation" className="flex gap-2">
            <NavLink
              end
              to="/"
              className={({ isActive }) =>
                classNames(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-sky-600 text-white"
                    : "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                )
              }
            >
              {messages.header.landing}
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                classNames(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-sky-600 text-white"
                    : "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                )
              }
            >
              {messages.header.admin}
            </NavLink>
          </nav>

          <div className="flex items-center gap-1 rounded-lg border border-slate-300 p-1 dark:border-slate-700" role="group" aria-label={messages.header.languageLabel}>
            <button
              type="button"
              onClick={() => setLocale("ru")}
              className={classNames(
                "rounded-md px-2 py-1 text-xs font-medium",
                locale === "ru"
                  ? "bg-sky-600 text-white"
                  : "bg-transparent text-slate-700 dark:text-slate-200"
              )}
              aria-pressed={locale === "ru"}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={classNames(
                "rounded-md px-2 py-1 text-xs font-medium",
                locale === "en"
                  ? "bg-sky-600 text-white"
                  : "bg-transparent text-slate-700 dark:text-slate-200"
              )}
              aria-pressed={locale === "en"}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            aria-label={messages.header.themeLabel}
          >
            {theme === "light" ? messages.header.themeLight : messages.header.themeDark}
          </button>
        </div>
      </div>
    </header>
  );
}