import type {
  ApiError,
  CabinetLlmSimplifyConnectionTestResponse,
  CabinetLlmSimplifySettingsResponse,
  CabinetSessionResponse,
  UpdateCabinetLlmSimplifySettingsRequest
} from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../app/useAppContext";

type SettingsStatus = "loading" | "ready" | "saving" | "testing" | "error" | "forbidden";

type SettingsFormState = {
  feature_enabled: boolean;
  model: string;
  system_prompt: string;
  user_prompt_template: string;
  temperature: string;
  max_output_tokens: string;
};

type ConnectionState =
  | {
      status: "idle";
      message: string | null;
    }
  | {
      status: "success" | "missing_key" | "failed";
      message: string;
      testedAt: string;
    };

export function CabinetLlmSettingsPage() {
  const navigate = useNavigate();
  const { messages } = useAppContext();
  const [status, setStatus] = useState<SettingsStatus>("loading");
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "idle",
    message: null
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const sessionResponse = await fetch("/api/cabinet/session", {
          credentials: "include"
        });
        if (sessionResponse.status === 401) {
          navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fllm-simplify", { replace: true });
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

        const cabinetSession = sessionPayload as CabinetSessionResponse;
        if (cabinetSession.user.role !== "admin") {
          if (!cancelled) {
            setStatus("forbidden");
          }
          return;
        }

        const settingsResponse = await fetch("/api/cabinet/admin/llm-simplify/settings", {
          credentials: "include"
        });

        if (cancelled) {
          return;
        }

        if (settingsResponse.status === 401) {
          navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fllm-simplify", { replace: true });
          return;
        }

        if (settingsResponse.status === 403) {
          setStatus("forbidden");
          return;
        }

        if (!settingsResponse.ok) {
          const error = await readApiError(settingsResponse);
          setErrorCode(error.code);
          setStatus("error");
          return;
        }

        const payload = (await settingsResponse.json()) as CabinetLlmSimplifySettingsResponse;
        setKeyConfigured(payload.key_configured);
        setForm(toFormState(payload));
        setUpdatedAt(payload.settings.updated_at);
        setUpdatedBy(payload.settings.updated_by_username);
        setPromptVersion(payload.settings.prompt_version);
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

  const connectionLabel = useMemo(() => {
    if (connectionState.status === "idle") {
      return messages.cabinet.llmSettings.connection.idle;
    }

    if (connectionState.status === "success") {
      return `${messages.cabinet.llmSettings.connection.success} (${formatShortDate(connectionState.testedAt)})`;
    }

    if (connectionState.status === "missing_key") {
      return messages.cabinet.llmSettings.connection.missingKey;
    }

    return `${messages.cabinet.llmSettings.connection.failed}: ${connectionState.message}`;
  }, [connectionState, messages.cabinet.llmSettings.connection]);

  const onChangeField = (field: keyof SettingsFormState, value: string | boolean) => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value
      };
    });
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) {
      return;
    }

    setStatus("saving");
    setErrorCode(null);
    setSaveMessage(null);

    try {
      const payload: UpdateCabinetLlmSimplifySettingsRequest = {
        feature_enabled: form.feature_enabled,
        model: form.model.trim(),
        system_prompt: form.system_prompt.trim(),
        user_prompt_template: form.user_prompt_template.trim(),
        temperature: form.temperature.trim().length > 0 ? Number(form.temperature) : null,
        max_output_tokens: form.max_output_tokens.trim().length > 0 ? Number(form.max_output_tokens) : null
      };

      const response = await fetch("/api/cabinet/admin/llm-simplify/settings", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fllm-simplify", { replace: true });
        return;
      }

      if (response.status === 403) {
        setStatus("forbidden");
        return;
      }

      if (!response.ok) {
        const error = await readApiError(response);
        setErrorCode(error.code);
        setSaveMessage(`${messages.cabinet.llmSettings.error} (${error.code})`);
        setStatus("ready");
        return;
      }

      const settingsPayload = (await response.json()) as CabinetLlmSimplifySettingsResponse;
      setKeyConfigured(settingsPayload.key_configured);
      setForm(toFormState(settingsPayload));
      setUpdatedAt(settingsPayload.settings.updated_at);
      setUpdatedBy(settingsPayload.settings.updated_by_username);
      setPromptVersion(settingsPayload.settings.prompt_version);
      setSaveMessage(messages.cabinet.llmSettings.saveSuccess);
      setStatus("ready");
    } catch {
      setErrorCode("internal_error");
      setSaveMessage(`${messages.cabinet.llmSettings.error} (internal_error)`);
      setStatus("ready");
    }
  };

  const onTestConnection = async () => {
    setStatus("testing");
    setSaveMessage(null);
    setConnectionState({
      status: "idle",
      message: null
    });
    setErrorCode(null);

    try {
      const response = await fetch("/api/cabinet/admin/llm-simplify/test-connection", {
        method: "POST",
        credentials: "include"
      });

      if (response.status === 401) {
        navigate("/cabinet/login?next=%2Fcabinet%2Fadmin%2Fllm-simplify", { replace: true });
        return;
      }

      if (response.status === 403) {
        setStatus("forbidden");
        return;
      }

      if (!response.ok) {
        const error = await readApiError(response);
        setErrorCode(error.code);
        setConnectionState({
          status: "failed",
          message: error.message,
          testedAt: new Date().toISOString()
        });
        setStatus("ready");
        return;
      }

      const payload = (await response.json()) as CabinetLlmSimplifyConnectionTestResponse;
      setConnectionState({
        status: payload.status,
        message: payload.error_message ?? payload.status,
        testedAt: payload.tested_at
      });
      setStatus("ready");
    } catch {
      setErrorCode("internal_error");
      setConnectionState({
        status: "failed",
        message: "internal_error",
        testedAt: new Date().toISOString()
      });
      setStatus("ready");
    }
  };

  if (status === "loading") {
    return <SectionCard title={messages.cabinet.llmSettings.heading}>{messages.cabinet.llmSettings.loading}</SectionCard>;
  }

  if (status === "forbidden") {
    return (
      <SectionCard title={messages.cabinet.llmSettings.heading}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">{messages.cabinet.llmSettings.forbidden}</p>
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            {messages.cabinet.llmSettings.backToLibrary}
          </Link>
        </div>
      </SectionCard>
    );
  }

  if (status === "error" || !form) {
    return (
      <SectionCard title={messages.cabinet.llmSettings.heading}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {messages.cabinet.llmSettings.error}
            {errorCode ? ` (${errorCode})` : ""}
          </p>
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            {messages.cabinet.llmSettings.backToLibrary}
          </Link>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={messages.cabinet.llmSettings.heading} description={messages.cabinet.llmSettings.description}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <Link
            to="/cabinet"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {messages.cabinet.llmSettings.backToLibrary}
          </Link>
          <Link
            to="/cabinet/admin/users"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {messages.cabinet.library.userAdmin}
          </Link>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${keyConfigured ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
            {keyConfigured ? messages.cabinet.llmSettings.keyConfigured : messages.cabinet.llmSettings.keyMissing}
          </span>
          {promptVersion ? (
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {messages.cabinet.llmSettings.promptVersion.replace("{value}", promptVersion)}
            </span>
          ) : null}
          {updatedAt ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {messages.cabinet.llmSettings.updatedAt.replace("{value}", formatShortDate(updatedAt))}
              {updatedBy ? ` · ${messages.cabinet.llmSettings.updatedBy.replace("{value}", updatedBy)}` : ""}
            </span>
          ) : null}
        </div>

        <form className="space-y-5" onSubmit={onSave}>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.feature_enabled}
              onChange={(event) => onChangeField("feature_enabled", event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-sky-700"
            />
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">{messages.cabinet.llmSettings.featureToggle}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{messages.cabinet.llmSettings.featureHint}</span>
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">{messages.cabinet.llmSettings.modelLabel}</span>
              <input
                type="text"
                value={form.model}
                onChange={(event) => onChangeField("model", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">{messages.cabinet.llmSettings.temperatureLabel}</span>
              <input
                type="number"
                step="0.1"
                value={form.temperature}
                onChange={(event) => onChangeField("temperature", event.target.value)}
                placeholder={messages.cabinet.llmSettings.optionalPlaceholder}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">{messages.cabinet.llmSettings.maxTokensLabel}</span>
              <input
                type="number"
                min="1"
                value={form.max_output_tokens}
                onChange={(event) => onChangeField("max_output_tokens", event.target.value)}
                placeholder={messages.cabinet.llmSettings.optionalPlaceholder}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium">{messages.cabinet.llmSettings.promptLabel}</span>
            <textarea
              value={form.system_prompt}
              onChange={(event) => onChangeField("system_prompt", event.target.value)}
              rows={12}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">{messages.cabinet.llmSettings.documentPromptLabel}</span>
            <textarea
              value={form.user_prompt_template}
              onChange={(event) => onChangeField("user_prompt_template", event.target.value)}
              rows={14}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">{messages.cabinet.llmSettings.documentPromptHint}</p>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={status === "saving" || status === "testing"}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-sky-700"
            >
              {status === "saving" ? messages.cabinet.llmSettings.saveLoading : messages.cabinet.llmSettings.saveIdle}
            </button>
            <button
              type="button"
              disabled={status === "saving" || status === "testing"}
              onClick={onTestConnection}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-700"
            >
              {status === "testing" ? messages.cabinet.llmSettings.testLoading : messages.cabinet.llmSettings.testIdle}
            </button>
            <p className="text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
              {saveMessage ?? connectionLabel}
            </p>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}

function toFormState(payload: CabinetLlmSimplifySettingsResponse): SettingsFormState {
  return {
    feature_enabled: payload.settings.feature_enabled,
    model: payload.settings.model,
    system_prompt: payload.settings.system_prompt,
    user_prompt_template: payload.settings.user_prompt_template,
    temperature: payload.settings.temperature === null ? "" : String(payload.settings.temperature),
    max_output_tokens: payload.settings.max_output_tokens === null ? "" : String(payload.settings.max_output_tokens)
  };
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
