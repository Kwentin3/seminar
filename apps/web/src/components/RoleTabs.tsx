import type { Locale, RoleKey, Step2RolesModule } from "@seminar/contracts";
import { classNames } from "@seminar/utils";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../app/useAppContext";

type ContentState = "loading" | "error" | "empty" | "success";

type RoleTabsProps = {
  content: Step2RolesModule;
  activeRoleId?: RoleKey | null;
  onRoleChange?: (roleId: RoleKey) => void;
};

export function RoleTabs({ content, activeRoleId: externalActiveRoleId, onRoleChange }: RoleTabsProps) {
  const { locale, messages } = useAppContext();
  const orderedRoles = useMemo(
    () =>
      content.roles_order.map((roleKey) => ({
        id: roleKey,
        ...content.roles[roleKey]
      })),
    [content]
  );
  const [internalActiveRoleId, setInternalActiveRoleId] = useState<RoleKey | null>(
    () => orderedRoles[0]?.id ?? null
  );
  const activeRoleId = externalActiveRoleId ?? internalActiveRoleId;

  useEffect(() => {
    if (externalActiveRoleId !== undefined) {
      return;
    }

    if (!orderedRoles.length) {
      setInternalActiveRoleId(null);
      return;
    }

    if (!activeRoleId || !orderedRoles.some((role) => role.id === activeRoleId)) {
      setInternalActiveRoleId(orderedRoles[0].id);
    }
  }, [activeRoleId, externalActiveRoleId, orderedRoles]);

  const setActiveRoleId = (roleId: RoleKey) => {
    if (externalActiveRoleId === undefined) {
      setInternalActiveRoleId(roleId);
    }
    onRoleChange?.(roleId);
  };

  const activeRole = useMemo(() => orderedRoles.find((role) => role.id === activeRoleId), [activeRoleId, orderedRoles]);

  const state: ContentState = !orderedRoles.length
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
        {orderedRoles.map((role) => (
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
            {role.label.i18n[locale]}
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
  activeRole?: Step2RolesModule["roles"][RoleKey] & { id: RoleKey };
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
          <p>{story.text.i18n[locale]}</p>
        </li>
      ))}
    </ul>
  );
}
