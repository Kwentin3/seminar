import type {
  ApiError,
  CabinetAdminUser,
  CabinetAdminUserMutationResponse,
  CabinetAdminUsersResponse,
  CabinetSessionResponse,
  CreateCabinetAdminViewerRequest,
  ResetCabinetAdminUserPasswordRequest,
  SetCabinetAdminUserActiveRequest
} from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../app/useAppContext";

type PageStatus = "loading" | "ready" | "error" | "forbidden";

type CreateFormState = {
  username: string;
  email: string;
  password: string;
};

type ResetDrafts = Record<string, string>;
type BusyAction = `reset:${string}` | `toggle:${string}` | "create" | null;

const EMPTY_CREATE_FORM: CreateFormState = {
  username: "",
  email: "",
  password: ""
};

export function CabinetUserAdminPage() {
  const navigate = useNavigate();
  const { messages } = useAppContext();
  const copy = messages.cabinet.userAdmin;

  const [status, setStatus] = useState<PageStatus>("loading");
  const [items, setItems] = useState<CabinetAdminUser[]>([]);
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [resetDrafts, setResetDrafts] = useState<ResetDrafts>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const sessionResponse = await fetch("/api/cabinet/session", {
          credentials: "include"
        });
        if (sessionResponse.status === 401) {
          navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fusers", { replace: true });
          return;
        }

        const sessionPayload = (await sessionResponse.json()) as CabinetSessionResponse | ApiError;
        if (!sessionResponse.ok) {
          if (!cancelled) {
            setStatus("error");
            setErrorCode(isApiError(sessionPayload) ? sessionPayload.code : "internal_error");
          }
          return;
        }

        const session = sessionPayload as CabinetSessionResponse;
        if (session.user.role !== "admin") {
          if (!cancelled) {
            setStatus("forbidden");
          }
          return;
        }

        if (!cancelled) {
          setCurrentUserId(session.user.id);
        }

        const usersResponse = await fetch("/api/cabinet/admin/users", {
          credentials: "include"
        });
        if (cancelled) {
          return;
        }

        if (usersResponse.status === 401) {
          navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fusers", { replace: true });
          return;
        }

        if (usersResponse.status === 403) {
          setStatus("forbidden");
          return;
        }

        if (!usersResponse.ok) {
          const error = await readApiError(usersResponse);
          setErrorCode(error.code);
          setStatus("error");
          return;
        }

        const payload = (await usersResponse.json()) as CabinetAdminUsersResponse;
        setItems(payload.items);
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

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      if (left.role !== right.role) {
        return left.role === "admin" ? -1 : 1;
      }
      return left.username.localeCompare(right.username, "ru");
    });
  }, [items]);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyAction("create");
    setCreateMessage(null);
    setRowMessage(null);
    setErrorCode(null);

    try {
      const payload: CreateCabinetAdminViewerRequest = {
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password
      };

      const response = await fetch("/api/cabinet/admin/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fusers", { replace: true });
        return;
      }

      if (response.status === 403) {
        setStatus("forbidden");
        return;
      }

      if (!response.ok) {
        const error = await readApiError(response);
        setErrorCode(error.code);
        setCreateMessage(`${copy.error} (${error.code})`);
        return;
      }

      const result = (await response.json()) as CabinetAdminUserMutationResponse;
      setItems((current) => [result.item, ...current.filter((item) => item.id !== result.item.id)]);
      setCreateForm(EMPTY_CREATE_FORM);
      setResetDrafts((current) => ({
        ...current,
        [result.item.id]: ""
      }));
      setCreateMessage(copy.createSuccess);
    } catch {
      setErrorCode("internal_error");
      setCreateMessage(`${copy.error} (internal_error)`);
    } finally {
      setBusyAction(null);
    }
  };

  const onResetPassword = async (userId: string) => {
    const draft = resetDrafts[userId]?.trim() ?? "";
    if (draft.length === 0) {
      return;
    }

    setBusyAction(`reset:${userId}`);
    setCreateMessage(null);
    setRowMessage(null);
    setErrorCode(null);

    try {
      const payload: ResetCabinetAdminUserPasswordRequest = {
        password: draft
      };
      const response = await fetch(`/api/cabinet/admin/users/${userId}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fusers", { replace: true });
        return;
      }

      if (response.status === 403) {
        const error = await readApiError(response);
        setRowMessage(error.message);
        return;
      }

      if (!response.ok) {
        const error = await readApiError(response);
        setErrorCode(error.code);
        setRowMessage(`${copy.error} (${error.code})`);
        return;
      }

      const result = (await response.json()) as CabinetAdminUserMutationResponse;
      setItems((current) => current.map((item) => (item.id === result.item.id ? result.item : item)));
      setResetDrafts((current) => ({
        ...current,
        [userId]: ""
      }));
      setRowMessage(copy.resetPasswordSuccess);
    } catch {
      setErrorCode("internal_error");
      setRowMessage(`${copy.error} (internal_error)`);
    } finally {
      setBusyAction(null);
    }
  };

  const onToggleActive = async (item: CabinetAdminUser) => {
    setBusyAction(`toggle:${item.id}`);
    setCreateMessage(null);
    setRowMessage(null);
    setErrorCode(null);

    try {
      const payload: SetCabinetAdminUserActiveRequest = {
        is_active: !item.is_active
      };
      const response = await fetch(`/api/cabinet/admin/users/${item.id}/set-active`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fusers", { replace: true });
        return;
      }

      if (response.status === 403) {
        const error = await readApiError(response);
        setRowMessage(error.message);
        return;
      }

      if (!response.ok) {
        const error = await readApiError(response);
        setErrorCode(error.code);
        setRowMessage(`${copy.error} (${error.code})`);
        return;
      }

      const result = (await response.json()) as CabinetAdminUserMutationResponse;
      setItems((current) => current.map((entry) => (entry.id === result.item.id ? result.item : entry)));
      setRowMessage(result.item.is_active ? copy.active : copy.inactive);
    } catch {
      setErrorCode("internal_error");
      setRowMessage(`${copy.error} (internal_error)`);
    } finally {
      setBusyAction(null);
    }
  };

  if (status === "loading") {
    return <SectionCard title={copy.heading}>{copy.loading}</SectionCard>;
  }

  if (status === "forbidden") {
    return (
      <SectionCard title={copy.heading}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">{copy.forbidden}</p>
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            {copy.backToLibrary}
          </Link>
        </div>
      </SectionCard>
    );
  }

  if (status === "error") {
    return (
      <SectionCard title={copy.heading}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {copy.error}
            {errorCode ? ` (${errorCode})` : ""}
          </p>
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            {copy.backToLibrary}
          </Link>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={copy.heading} description={copy.description}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {copy.backToLibrary}
          </Link>
          <Link
            to="/cabinet/admin/llm-simplify"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {copy.openLlmSettings}
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
            {createMessage ?? rowMessage}
          </p>
        </div>

        <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" onSubmit={onCreate}>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{copy.createHeading}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{copy.createDescription}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">{copy.createUsernameLabel}</span>
              <input
                type="text"
                value={createForm.username}
                onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">{copy.createEmailLabel}</span>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">{copy.createPasswordLabel}</span>
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busyAction === "create"}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-sky-700"
          >
            {busyAction === "create" ? copy.createSubmitLoading : copy.createSubmitIdle}
          </button>
        </form>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{copy.tableCaption}</h2>

          {sortedItems.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-200">{copy.empty}</p>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((item) => {
                const rowBusy = busyAction === `reset:${item.id}` || busyAction === `toggle:${item.id}`;
                const resetBusy = busyAction === `reset:${item.id}`;
                const toggleBusy = busyAction === `toggle:${item.id}`;
                const resetDraft = resetDrafts[item.id] ?? "";
                const isSelf = currentUserId === item.id;

                return (
                  <article
                    key={item.id}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.username}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{item.email ?? "no-email"}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-2.5 py-1 font-medium ${item.role === "admin" ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                            {item.role === "admin" ? copy.roleAdmin : copy.roleViewer}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 font-medium ${item.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
                            {item.is_active ? copy.active : copy.inactive}
                          </span>
                        </div>
                      </div>

                      <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <div>
                          <dt className="font-medium">{copy.columns.lastLogin}</dt>
                          <dd>{item.last_login_at ? formatShortDate(item.last_login_at) : copy.neverLoggedIn}</dd>
                        </div>
                        <div>
                          <dt className="font-medium">{copy.columns.updated}</dt>
                          <dd>{formatShortDate(item.updated_at)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                      <label className="space-y-1">
                        <span className="text-sm font-medium">{copy.resetPasswordLabel}</span>
                        <input
                          type="password"
                          value={resetDraft}
                          onChange={(event) =>
                            setResetDrafts((current) => ({
                              ...current,
                              [item.id]: event.target.value
                            }))
                          }
                          disabled={rowBusy}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">{copy.resetPasswordHint}</p>
                      </label>

                      <button
                        type="button"
                        onClick={() => void onResetPassword(item.id)}
                        disabled={rowBusy || resetDraft.trim().length === 0}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-700"
                      >
                        {resetBusy ? copy.resetPasswordLoading : copy.resetPasswordIdle}
                      </button>

                      <button
                        type="button"
                        onClick={() => void onToggleActive(item)}
                        disabled={toggleBusy || (isSelf && item.is_active)}
                        title={isSelf && item.is_active ? copy.selfDeactivateBlocked : undefined}
                        className={`rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-sky-700 ${
                          item.is_active
                            ? "border border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-200"
                            : "border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-200"
                        }`}
                      >
                        {toggleBusy ? copy.toggleLoading : item.is_active ? copy.deactivateIdle : copy.activateIdle}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </SectionCard>
  );
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

function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && typeof (value as ApiError).code === "string";
}

function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
