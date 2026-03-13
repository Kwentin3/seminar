import type {
  ApiError,
  CabinetMaterial,
  CabinetMaterialStatus,
  CabinetMaterialsResponse,
  CabinetSessionResponse,
  CabinetUser
} from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../app/useAppContext";

type CabinetStatus = "session-loading" | "loading" | "ready" | "error";

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
        item.source_path,
        ...item.tags
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [categoryFilter, deferredSearch, items, statusFilter, typeFilter]);

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
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
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
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            {messages.cabinet.library.logout}
          </button>
        </div>

        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {messages.cabinet.library.helpfulForLecturer}
        </p>

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
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClassName(item.material_status)}`}
                    >
                      {getStatusLabel(messages.cabinet.library.statuses, item.material_status)}
                    </span>
                    {item.recommended_for_lecture_prep ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        {messages.cabinet.library.recommendedForPrep}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.reading_mode === "in_app"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {item.reading_mode === "in_app"
                        ? messages.cabinet.library.readableInPortal
                        : messages.cabinet.library.externalOnly}
                    </span>
                  </div>
                  {item.summary ? (
                    <p className="text-sm text-slate-700 dark:text-slate-200">{item.summary}</p>
                  ) : null}
                </div>

                <dl className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.status}</dt>
                    <dd>{getStatusLabel(messages.cabinet.library.statuses, item.material_status)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.type}</dt>
                    <dd>{item.material_type}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.category}</dt>
                    <dd>{item.category}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.theme}</dt>
                    <dd>{item.theme ?? item.category}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.audience}</dt>
                    <dd>{item.audience}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.language}</dt>
                    <dd>{item.language}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.access}</dt>
                    <dd>
                      {item.reading_mode === "in_app"
                        ? messages.cabinet.library.readableInPortal
                        : messages.cabinet.library.externalOnly}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">{messages.cabinet.library.fields.curated}</dt>
                    <dd>{item.curation_reviewed_at ?? "-"}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium">{messages.cabinet.library.fields.source}</dt>
                    <dd className="break-all font-mono text-xs">{item.source_path}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium">{messages.cabinet.library.fields.updated}</dt>
                    <dd>{item.source_updated_at ?? "-"}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium">{messages.cabinet.library.fields.tags}</dt>
                    <dd className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3">
                  {item.read_url ? (
                    <Link
                      to={item.read_url}
                      className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
                    >
                      {messages.cabinet.library.readMaterial}
                    </Link>
                  ) : null}

                  <a
                    href={item.open_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-900"
                  >
                    {messages.cabinet.library.openSource}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
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
