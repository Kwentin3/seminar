import type { AdminListLeadsResponse, ApiError, LeadRow, Locale } from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import { useMemo, useState, type FormEvent } from "react";
import { useAppContext } from "../app/useAppContext";

type AdminStatus = "idle" | "loading" | "success" | "error";
type AdminErrorCode = ApiError["code"] | "secret_required";

const LEADS_LIMIT = 50;
const SECRET_REQUIRED_CODE = "secret_required";

export function AdminPage() {
  const { locale, messages } = useAppContext();

  const [adminSecret, setAdminSecret] = useState("");
  const [status, setStatus] = useState<AdminStatus>("idle");
  const [items, setItems] = useState<LeadRow[]>([]);
  const [errorCode, setErrorCode] = useState<AdminErrorCode | null>(null);
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);

  const submitDisabled = status === "loading";
  const statusMessage = useMemo(() => {
    if (status === "loading") {
      return messages.admin.states.loading;
    }

    if (status === "error") {
      if (errorCode === "secret_required") {
        return messages.admin.states.secretRequired;
      }

      if (errorCode === "admin_unauthorized") {
        return messages.admin.states.unauthorized;
      }

      return messages.admin.states.error;
    }

    if (status === "success" && items.length === 0) {
      return messages.admin.emptyHint;
    }

    if (status === "success") {
      return messages.admin.states.success;
    }

    return messages.admin.states.idle;
  }, [errorCode, items.length, messages.admin, status]);

  const onLoadLeads = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const secret = adminSecret.trim();
    if (!secret) {
      setStatus("error");
      setErrorCode(SECRET_REQUIRED_CODE);
      return;
    }

    setStatus("loading");
    setErrorCode(null);
    setCopiedLeadId(null);

    try {
      const result = await fetchAdminLeads(secret);
      if (!result.ok) {
        setStatus("error");
        setErrorCode(result.error.code);
        return;
      }

      setItems(result.items);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorCode("internal_error");
    }
  };

  const onCopyPhone = async (row: LeadRow) => {
    if (!navigator.clipboard?.writeText) {
      setStatus("error");
      setErrorCode("internal_error");
      return;
    }

    try {
      await navigator.clipboard.writeText(row.phone_e164);
      setCopiedLeadId(row.id);
    } catch {
      setStatus("error");
      setErrorCode("internal_error");
    }
  };

  return (
    <SectionCard title={messages.admin.heading} description={messages.admin.description}>
      <div className="space-y-4">
        <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={onLoadLeads}>
          <label className="w-full space-y-1 md:max-w-sm">
            <span className="text-sm font-medium">{messages.admin.secretLabel}</span>
            <input
              type="password"
              value={adminSecret}
              onChange={(event) => setAdminSecret(event.target.value)}
              placeholder={messages.admin.secretPlaceholder}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-sky-400 dark:focus:ring-sky-900"
            />
          </label>

          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-sky-700"
          >
            {status === "loading" ? messages.admin.loadButtonLoading : messages.admin.loadButtonIdle}
          </button>
        </form>

        <p
          className="min-h-5 text-sm text-slate-700 dark:text-slate-200"
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {statusMessage}
        </p>

        {status === "success" && items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <caption className="sr-only">{messages.admin.tableCaption}</caption>
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.createdAt}</th>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.name}</th>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.phone}</th>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.country}</th>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.locale}</th>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.source}</th>
                  <th className="px-3 py-2 text-left font-semibold">{messages.admin.columns.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatCreatedAt(row.created_at, locale)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{row.phone_e164}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.country ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.locale}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.source}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onCopyPhone(row)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-600 dark:text-slate-200 dark:focus:ring-sky-700"
                      >
                        {copiedLeadId === row.id ? messages.admin.copiedPhone : messages.admin.copyPhone}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

async function fetchAdminLeads(
  adminSecret: string
): Promise<{ ok: true; items: LeadRow[] } | { ok: false; error: ApiError }> {
  const response = await fetch(`/api/admin/leads?limit=${LEADS_LIMIT}`, {
    method: "GET",
    headers: {
      "X-Admin-Secret": adminSecret
    }
  });

  if (!response.ok) {
    return {
      ok: false,
      error: await readApiError(response)
    };
  }

  const payload = (await response.json()) as unknown;
  if (!isAdminListLeadsResponse(payload)) {
    return {
      ok: false,
      error: {
        code: "internal_error",
        message: "Malformed admin response."
      }
    };
  }

  return {
    ok: true,
    items: payload.items
  };
}

async function readApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as Partial<ApiError>;
    if (payload && typeof payload.code === "string" && typeof payload.message === "string") {
      return {
        code: payload.code as ApiError["code"],
        message: payload.message
      };
    }
  } catch {
    // ignore malformed body and fallback to generic error
  }

  return {
    code: "internal_error",
    message: "Request failed."
  };
}

function isAdminListLeadsResponse(payload: unknown): payload is AdminListLeadsResponse {
  if (!isRecord(payload) || payload.ok !== true || !Array.isArray(payload.items)) {
    return false;
  }

  return payload.items.every((item) => isLeadRow(item));
}

function isLeadRow(value: unknown): value is LeadRow {
  if (!isRecord(value)) {
    return false;
  }

  const locale = value.locale;
  const isLocaleValid = locale === "ru" || locale === "en";
  const isCountryValid = value.country === null || typeof value.country === "string";

  return (
    typeof value.id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.name === "string" &&
    typeof value.phone_e164 === "string" &&
    isCountryValid &&
    isLocaleValid &&
    typeof value.source === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatCreatedAt(createdAt: string, locale: Locale): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return createdAt;
  }

  return parsed.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
