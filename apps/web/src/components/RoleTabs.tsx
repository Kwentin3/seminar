import type { Locale, RoleContent } from "@seminar/contracts";
import { classNames } from "@seminar/utils";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../app/useAppContext";
import { ROLE_CONTENT } from "../content/roles";

type ContentState = "loading" | "error" | "empty" | "success";

export function RoleTabs() {
  const { locale, messages } = useAppContext();
  const [activeRoleId, setActiveRoleId] = useState<string | null>(() => ROLE_CONTENT[0]?.id ?? null);

  useEffect(() => {
    if (!ROLE_CONTENT.length) {
      setActiveRoleId(null);
      return;
    }

    if (!activeRoleId || !ROLE_CONTENT.some((role) => role.id === activeRoleId)) {
      setActiveRoleId(ROLE_CONTENT[0].id);
    }
  }, [activeRoleId]);

  const activeRole = useMemo(
    () => ROLE_CONTENT.find((role) => role.id === activeRoleId),
    [activeRoleId]
  );

  const state: ContentState = !ROLE_CONTENT.length
    ? "empty"
    : !activeRole
      ? "error"
      : activeRole.stories.length
        ? "success"
        : "empty";

  const panelId = activeRole ? `role-panel-${activeRole.id}` : "role-panel-empty";
  const tabId = activeRole ? `role-tab-${activeRole.id}` : undefined;

  return (
    <section aria-label={messages.landing.tabsLabel} className="space-y-4">
      <div role="tablist" aria-label={messages.landing.tabsLabel} className="flex flex-wrap gap-2">
        {ROLE_CONTENT.map((role) => (
          <button
            key={role.id}
            type="button"
            id={`role-tab-${role.id}`}
            role="tab"
            aria-controls={`role-panel-${role.id}`}
            aria-selected={activeRoleId === role.id}
            onClick={() => setActiveRoleId(role.id)}
            className={classNames(
              "rounded-lg px-3 py-2 text-sm font-medium",
              activeRoleId === role.id
                ? "bg-sky-600 text-white"
                : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
            )}
          >
            {role.title[locale]}
          </button>
        ))}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"
      >
        <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
          {messages.landing.storiesTitle}
        </p>
        <TabState state={state} activeRole={activeRole} locale={locale} />
      </div>
    </section>
  );
}

type TabStateProps = {
  state: ContentState;
  activeRole?: RoleContent;
  locale: Locale;
};

function TabState({ state, activeRole, locale }: TabStateProps) {
  const { messages } = useAppContext();

  if (state === "loading") {
    return <p className="text-sm text-slate-600 dark:text-slate-300">{messages.landing.states.loading}</p>;
  }

  if (state === "error") {
    return <p className="text-sm text-red-600 dark:text-red-400">{messages.landing.states.error}</p>;
  }

  if (state === "empty") {
    return <p className="text-sm text-slate-600 dark:text-slate-300">{messages.landing.states.empty}</p>;
  }

  if (!activeRole) {
    return <p className="text-sm text-red-600 dark:text-red-400">{messages.landing.states.error}</p>;
  }

  return (
    <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
      {activeRole.stories.map((story) => (
        <li
          key={`${activeRole.id}:${story.id}`}
          className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <article className="space-y-2">
            <p>
              <span className="font-semibold">{messages.landing.storyFields.problem}:</span>{" "}
              {story.problem[locale]}
            </p>
            <p>
              <span className="font-semibold">{messages.landing.storyFields.solution}:</span>{" "}
              {story.solution[locale]}
            </p>
            <p>
              <span className="font-semibold">{messages.landing.storyFields.result}:</span>{" "}
              {story.result[locale]}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
