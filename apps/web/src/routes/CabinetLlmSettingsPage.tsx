import type {
  ApiError,
  CabinetLlmSimplifyConnectionTestResponse,
  CabinetLlmSimplifyEffectiveConfig,
  CabinetLlmSimplifyOversizedBehavior,
  CabinetLlmSimplifyRecentFailure,
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
  request_timeout_ms: string;
  max_source_chars: string;
  oversized_behavior: CabinetLlmSimplifyOversizedBehavior;
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
  const copy = messages.cabinet.llmSettings;

  const [status, setStatus] = useState<SettingsStatus>("loading");
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [effectiveConfig, setEffectiveConfig] = useState<CabinetLlmSimplifyEffectiveConfig | null>(null);
  const [recentFailure, setRecentFailure] = useState<CabinetLlmSimplifyRecentFailure | null>(null);
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
        hydrateFromPayload(payload);
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

  const warnings = useMemo(() => {
    if (!form) {
      return [];
    }

    const nextWarnings: string[] = [];
    const parsedMaxTokens = parseOptionalInt(form.max_output_tokens);
    const parsedTimeout = parseRequiredInt(form.request_timeout_ms);
    const parsedInputLimit = parseRequiredInt(form.max_source_chars);
    const normalizedPrompt = form.system_prompt.trim();
    const normalizedTemplate = form.user_prompt_template.trim();

    if (!keyConfigured) {
      nextWarnings.push(copy.warningMissingKey);
    }
    if (parsedMaxTokens !== null && parsedMaxTokens < 1200) {
      nextWarnings.push(copy.warningLowMaxTokens);
    }
    if (parsedTimeout !== null && parsedTimeout > 90_000) {
      nextWarnings.push(copy.warningLongTimeout);
    }
    if (parsedInputLimit !== null && parsedInputLimit > 15_000) {
      nextWarnings.push(copy.warningLargeInputLimit);
    }
    if (form.oversized_behavior === "allow_with_warning") {
      nextWarnings.push(copy.warningAllowOversized);
    }
    if (normalizedPrompt.length < 80) {
      nextWarnings.push(copy.warningWeakSystemPrompt);
    }
    if (!normalizedTemplate.includes("{{source_markdown}}")) {
      nextWarnings.push(copy.warningMissingSourceToken);
    }

    return nextWarnings;
  }, [copy.warningAllowOversized, copy.warningLargeInputLimit, copy.warningLongTimeout, copy.warningLowMaxTokens, copy.warningMissingKey, copy.warningMissingSourceToken, copy.warningWeakSystemPrompt, form, keyConfigured]);

  const connectionLabel = useMemo(() => {
    if (connectionState.status === "idle") {
      return copy.connection.idle;
    }

    if (connectionState.status === "success") {
      return `${copy.connection.success} (${formatShortDate(connectionState.testedAt)})`;
    }

    if (connectionState.status === "missing_key") {
      return copy.connection.missingKey;
    }

    return `${copy.connection.failed}: ${connectionState.message}`;
  }, [connectionState, copy.connection]);

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
        max_output_tokens: form.max_output_tokens.trim().length > 0 ? Number(form.max_output_tokens) : null,
        request_timeout_ms: Number(form.request_timeout_ms),
        max_source_chars: Number(form.max_source_chars),
        oversized_behavior: form.oversized_behavior
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
        setSaveMessage(`${copy.error} (${error.code})`);
        setStatus("ready");
        return;
      }

      const settingsPayload = (await response.json()) as CabinetLlmSimplifySettingsResponse;
      hydrateFromPayload(settingsPayload);
      setSaveMessage(copy.saveSuccess);
      setStatus("ready");
    } catch {
      setErrorCode("internal_error");
      setSaveMessage(`${copy.error} (internal_error)`);
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

  if (status === "error" || !form || !effectiveConfig) {
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
            to="/cabinet/admin/users"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {messages.cabinet.library.userAdmin}
          </Link>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              keyConfigured
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
            }`}
          >
            {keyConfigured ? copy.keyConfigured : copy.keyMissing}
          </span>
          {promptVersion ? (
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {copy.promptVersion.replace("{value}", promptVersion)}
            </span>
          ) : null}
          {updatedAt ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {copy.updatedAt.replace("{value}", formatShortDate(updatedAt))}
              {updatedBy ? ` · ${copy.updatedBy.replace("{value}", updatedBy)}` : ""}
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{copy.connectionHeading}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{connectionLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={status === "saving" || status === "testing"}
                onClick={onTestConnection}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-sky-700"
              >
                {status === "testing" ? copy.testLoading : copy.testIdle}
              </button>
              {saveMessage ? (
                <p className="text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
                  {saveMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <form className="space-y-5" onSubmit={onSave}>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{copy.settingsHeading}</h2>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={form.feature_enabled}
                  onChange={(event) => onChangeField("feature_enabled", event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:focus:ring-sky-700"
                />
                <span>
                  <span className="block font-medium text-slate-900 dark:text-slate-100">{copy.featureToggle}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{copy.featureHint}</span>
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">{copy.modelLabel}</span>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(event) => onChangeField("model", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">{copy.temperatureLabel}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={form.temperature}
                    onChange={(event) => onChangeField("temperature", event.target.value)}
                    placeholder={copy.optionalPlaceholder}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">{copy.maxTokensLabel}</span>
                  <input
                    type="number"
                    min="1"
                    value={form.max_output_tokens}
                    onChange={(event) => onChangeField("max_output_tokens", event.target.value)}
                    placeholder={copy.optionalPlaceholder}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{copy.maxTokensHint}</p>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">{copy.timeoutLabel}</span>
                  <input
                    type="number"
                    min="30000"
                    step="1000"
                    value={form.request_timeout_ms}
                    onChange={(event) => onChangeField("request_timeout_ms", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{copy.timeoutHint}</p>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">{copy.inputLimitLabel}</span>
                  <input
                    type="number"
                    min="2000"
                    step="500"
                    value={form.max_source_chars}
                    onChange={(event) => onChangeField("max_source_chars", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{copy.inputLimitHint}</p>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">{copy.oversizedBehaviorLabel}</span>
                  <select
                    value={form.oversized_behavior}
                    onChange={(event) => onChangeField("oversized_behavior", event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                  >
                    <option value="block">{copy.oversizedBehaviorBlock}</option>
                    <option value="allow_with_warning">{copy.oversizedBehaviorAllow}</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{copy.oversizedBehaviorHint}</p>
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium">{copy.promptLabel}</span>
                <textarea
                  value={form.system_prompt}
                  onChange={(event) => onChangeField("system_prompt", event.target.value)}
                  rows={12}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">{copy.documentPromptLabel}</span>
                <textarea
                  value={form.user_prompt_template}
                  onChange={(event) => onChangeField("user_prompt_template", event.target.value)}
                  rows={14}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">{copy.documentPromptHint}</p>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={status === "saving" || status === "testing"}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-sky-700"
                >
                  {status === "saving" ? copy.saveLoading : copy.saveIdle}
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{copy.effectiveHeading}</h2>
            <dl className="grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
              <ConfigItem label={copy.effectiveProvider} value={effectiveConfig.provider} />
              <ConfigItem label={copy.effectiveModel} value={effectiveConfig.model} />
              <ConfigItem label={copy.effectiveKey} value={effectiveConfig.key_configured ? copy.keyConfigured : copy.keyMissing} />
              <ConfigItem label={copy.effectiveTimeout} value={`${effectiveConfig.request_timeout_ms} ms`} />
              <ConfigItem
                label={copy.effectiveMaxTokens}
                value={effectiveConfig.max_output_tokens === null ? copy.noExplicitOutputCap : String(effectiveConfig.max_output_tokens)}
              />
              <ConfigItem label={copy.effectiveInputLimit} value={`${effectiveConfig.max_source_chars} chars`} />
              <ConfigItem
                label={copy.effectiveOversizedBehavior}
                value={effectiveConfig.oversized_behavior === "block" ? copy.oversizedBehaviorBlock : copy.oversizedBehaviorAllow}
              />
              <ConfigItem label={copy.effectiveHardTimeout} value={`${effectiveConfig.hard_max_request_timeout_ms} ms`} />
              <ConfigItem label={copy.effectiveHardInputLimit} value={`${effectiveConfig.hard_max_source_chars} chars`} />
            </dl>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <p className="font-medium text-slate-900 dark:text-slate-100">{copy.recentFailure}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {recentFailure
                  ? `${recentFailure.error_code} · ${recentFailure.material_slug} · ${formatShortDate(recentFailure.updated_at)}`
                  : copy.noRecentFailure}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{copy.warningsHeading}</h2>
            {warnings.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">{copy.warningsEmpty}</p>
            ) : (
              <ul className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
                {warnings.map((warning) => (
                  <li
                    key={warning}
                    className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );

  function hydrateFromPayload(payload: CabinetLlmSimplifySettingsResponse) {
    setKeyConfigured(payload.key_configured);
    setForm(toFormState(payload));
    setEffectiveConfig(payload.effective_config);
    setRecentFailure(payload.recent_failure);
    setUpdatedAt(payload.settings.updated_at);
    setUpdatedBy(payload.settings.updated_by_username);
    setPromptVersion(payload.settings.prompt_version);
  }
}

function toFormState(payload: CabinetLlmSimplifySettingsResponse): SettingsFormState {
  return {
    feature_enabled: payload.settings.feature_enabled,
    model: payload.settings.model,
    system_prompt: payload.settings.system_prompt,
    user_prompt_template: payload.settings.user_prompt_template,
    temperature: payload.settings.temperature === null ? "" : String(payload.settings.temperature),
    max_output_tokens: payload.settings.max_output_tokens === null ? "" : String(payload.settings.max_output_tokens),
    request_timeout_ms: String(payload.settings.request_timeout_ms),
    max_source_chars: String(payload.settings.max_source_chars),
    oversized_behavior: payload.settings.oversized_behavior
  };
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
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

function parseOptionalInt(value: string) {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseRequiredInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
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
