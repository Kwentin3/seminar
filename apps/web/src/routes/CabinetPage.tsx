import type {
  ApiError,
  CabinetMaterial,
  CabinetMaterialStatus,
  CabinetMaterialsResponse,
  CabinetSessionResponse,
  CabinetUser
} from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppMessages } from "../app/messages";
import { useAppContext } from "../app/useAppContext";

type CabinetStatus = "session-loading" | "loading" | "ready" | "error";
type LibraryMessages = AppMessages["cabinet"]["library"];

export function CabinetPage() {
  const navigate = useNavigate();
  const { messages } = useAppContext();

  const [status, setStatus] = useState<CabinetStatus>("session-loading");
  const [user, setUser] = useState<CabinetUser | null>(null);
  const [items, setItems] = useState<CabinetMaterial[]>([]);
  const [stats, setStats] = useState<CabinetMaterialsResponse["stats"]>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const sessionResponse = await fetch("/api/cabinet/session", {
          credentials: "include"
        });

        if (sessionResponse.status === 401) {
          navigate("/cabinet/login?next=%2Fcabinet", { replace: true });
          return;
        }

        if (!sessionResponse.ok) {
          throw new Error("session_failed");
        }

        const sessionPayload = (await sessionResponse.json()) as CabinetSessionResponse;
        if (cancelled) {
          return;
        }

        setUser(sessionPayload.user);
        setStatus("loading");

        const materialsResponse = await fetch("/api/cabinet/materials", {
          credentials: "include"
        });

        if (materialsResponse.status === 401) {
          navigate("/cabinet/login?next=%2Fcabinet", { replace: true });
          return;
        }

        if (!materialsResponse.ok) {
          const error = await readApiError(materialsResponse);
          setErrorCode(error.code);
          setStatus("error");
          return;
        }

        const materialsPayload = (await materialsResponse.json()) as CabinetMaterialsResponse;
        if (cancelled) {
          return;
        }

        setItems(materialsPayload.items);
        setStats(materialsPayload.stats);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorCode("internal_error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const types = useMemo(
    () => Array.from(new Set(items.map((item) => item.material_type))).sort(),
    [items]
  );
  const statuses = useMemo(
    () => Array.from(new Set(items.map((item) => item.material_status))).sort(statusOrderComparator),
    [items]
  );
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== "all" && item.material_status !== statusFilter) {
        return false;
      }
      if (typeFilter !== "all" && item.material_type !== typeFilter) {
        return false;
      }
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.title,
        item.summary ?? "",
        item.category,
        item.theme ?? "",
        item.source_path,
        ...item.tags
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [categoryFilter, deferredSearch, items, statusFilter, typeFilter]);

  const recommendedItems = useMemo(
    () => filteredItems.filter((item) => item.recommended_for_lecture_prep),
    [filteredItems]
  );
  const secondaryItems = useMemo(
    () => filteredItems.filter((item) => !item.recommended_for_lecture_prep),
    [filteredItems]
  );
  const usingDefaultView =
    deferredSearch.trim().length === 0 &&
    statusFilter === "all" &&
    typeFilter === "all" &&
    categoryFilter === "all";
  const showPrepSections =
    usingDefaultView && recommendedItems.length > 0 && secondaryItems.length > 0;

  const onLogout = async () => {
    await fetch("/api/cabinet/logout", {
      method: "POST",
      credentials: "include"
    });
    navigate("/cabinet/login", { replace: true });
  };

  if (status === "session-loading") {
    return <SectionCard title={messages.cabinet.library.heading}>{messages.cabinet.library.sessionLoading}</SectionCard>;
  }

  if (status === "loading") {
    return <SectionCard title={messages.cabinet.library.heading}>{messages.cabinet.library.loading}</SectionCard>;
  }

  if (status === "error") {
    return (
      <SectionCard title={messages.cabinet.library.heading}>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {messages.cabinet.library.errors.generic}
          {errorCode ? ` (${errorCode})` : ""}
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={messages.cabinet.library.heading} description={messages.cabinet.library.description}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <p>
              {messages.cabinet.library.signedInAs} <span className="font-semibold">{user?.username}</span>
            </p>
            {stats ? (
              <p>
                {messages.cabinet.library.adminStats
                  .replace("{count}", String(stats.total_materials))
                  .replace("{categories}", stats.categories.join(", "))}
              </p>
            ) : null}
            <p className="max-w-3xl text-slate-600 dark:text-slate-300">
              {messages.cabinet.library.helpfulForLecturer}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {messages.cabinet.library.logout}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium">{messages.cabinet.library.filters.searchLabel}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={messages.cabinet.library.filters.searchPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">{messages.cabinet.library.filters.statusLabel}</span>
            <select
              aria-label={messages.cabinet.library.filters.statusLabel}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">{messages.cabinet.library.filters.allStatuses}</option>
              {statuses.map((itemStatus) => (
                <option key={itemStatus} value={itemStatus}>
                  {getStatusLabel(messages.cabinet.library.statuses, itemStatus)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">{messages.cabinet.library.filters.typeLabel}</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">{messages.cabinet.library.filters.allTypes}</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">{messages.cabinet.library.filters.categoryLabel}</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">{messages.cabinet.library.filters.allCategories}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredItems.length === 0 ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">{messages.cabinet.library.empty}</p>
        ) : showPrepSections ? (
          <div className="space-y-6">
            <MaterialSection
              heading={messages.cabinet.library.prepStartHeading}
              description={messages.cabinet.library.prepStartDescription}
              items={recommendedItems}
              messages={messages.cabinet.library}
            />
            <MaterialSection
              heading={messages.cabinet.library.restHeading}
              description={messages.cabinet.library.restDescription}
              items={secondaryItems}
              messages={messages.cabinet.library}
            />
          </div>
        ) : (
          <MaterialSection items={filteredItems} messages={messages.cabinet.library} />
        )}
      </div>
    </SectionCard>
  );
}

function MaterialSection({
  heading,
  description,
  items,
  messages
}: {
  heading?: string;
  description?: string;
  items: CabinetMaterial[];
  messages: LibraryMessages;
}) {
  return (
    <section className="space-y-3">
      {heading ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{heading}</h3>
          {description ? <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <MaterialCard key={item.id} item={item} messages={messages} />
        ))}
      </div>
    </section>
  );
}

function MaterialCard({ item, messages }: { item: CabinetMaterial; messages: LibraryMessages }) {
  const visibleTags = item.tags.slice(0, 4);
  const remainingTagCount = Math.max(item.tags.length - visibleTags.length, 0);
  const prepCue = item.recommended_for_lecture_prep ? getPrepCue(messages.prepCues, item.material_status) : null;
  const quietMeta = [item.source_updated_at, item.curation_reviewed_at].filter(Boolean);

  return (
    <article
      className={`space-y-4 rounded-2xl border p-4 shadow-sm transition-colors dark:shadow-none ${
        item.recommended_for_lecture_prep
          ? "border-sky-200 bg-sky-50/40 dark:border-sky-900/80 dark:bg-sky-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClassName(item.material_status)}`}>
            {getStatusLabel(messages.statuses, item.material_status)}
          </span>
          {item.recommended_for_lecture_prep ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {messages.recommendedForPrep}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              item.reading_mode === "in_app"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {item.reading_mode === "in_app" ? messages.readableInPortal : messages.externalOnly}
          </span>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
          {prepCue ? <p className="text-sm text-slate-700 dark:text-slate-200">{prepCue}</p> : null}
          {item.summary ? <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{item.summary}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
          <SecondarySignal>{item.theme ?? item.category}</SecondarySignal>
          <SecondarySignal>{item.material_type}</SecondarySignal>
        </div>

        {quietMeta.length > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.curation_reviewed_at ? `${messages.fields.curated}: ${item.curation_reviewed_at}` : ""}
            {item.curation_reviewed_at && item.source_updated_at ? " · " : ""}
            {item.source_updated_at ? `${messages.fields.updated}: ${item.source_updated_at}` : ""}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {item.read_url ? (
          <Link
            to={item.read_url}
            className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
          >
            {messages.readMaterial}
          </Link>
        ) : null}

        <a
          href={item.open_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
        >
          {messages.openSource}
        </a>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 dark:text-slate-100">
          {messages.contextToggle}
        </summary>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{messages.contextHint}</p>

        <dl className="mt-3 grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
          <div>
            <dt className="font-medium">{messages.fields.theme}</dt>
            <dd>{item.theme ?? item.category}</dd>
          </div>
          <div>
            <dt className="font-medium">{messages.fields.category}</dt>
            <dd>{item.category}</dd>
          </div>
          <div>
            <dt className="font-medium">{messages.fields.audience}</dt>
            <dd>{item.audience}</dd>
          </div>
          <div>
            <dt className="font-medium">{messages.fields.language}</dt>
            <dd>{item.language}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="font-medium">{messages.fields.source}</dt>
            <dd className="break-all font-mono text-xs text-slate-500 dark:text-slate-400">{item.source_path}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="font-medium">{messages.fields.tags}</dt>
            <dd className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
              {remainingTagCount > 0 ? (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  +{remainingTagCount}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

function SecondarySignal({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      {children}
    </span>
  );
}

function getPrepCue(
  messages: { draft: string; working: string; final: string },
  status: CabinetMaterialStatus
) {
  if (status === "final") {
    return messages.final;
  }
  if (status === "working") {
    return messages.working;
  }
  return messages.draft;
}

function getStatusLabel(
  messages: { draft: string; working: string; final: string },
  status: CabinetMaterialStatus
) {
  if (status === "final") {
    return messages.final;
  }
  if (status === "working") {
    return messages.working;
  }
  return messages.draft;
}

function statusBadgeClassName(status: CabinetMaterialStatus) {
  if (status === "final") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
  if (status === "working") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
}

function statusOrderComparator(left: CabinetMaterialStatus, right: CabinetMaterialStatus) {
  const order = {
    final: 0,
    working: 1,
    draft: 2
  };
  return order[left] - order[right];
}

async function readApiError(response: Response): Promise<ApiError> {
  try {
    return (await response.json()) as ApiError;
  } catch {
    return {
      code: "internal_error",
      message: "Request failed."
    };
  }
}
