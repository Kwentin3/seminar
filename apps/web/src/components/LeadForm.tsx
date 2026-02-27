import type { ApiError, CreateLeadRequest } from "@seminar/contracts";
import { useMemo, useState, type FormEvent } from "react";
import { useAppContext } from "../app/useAppContext";
import { TurnstileWidget } from "./TurnstileWidget";

type FormStatus = "idle" | "loading" | "success" | "error";

type CountryOption = "RU" | "US" | "KZ" | "DE" | "GB" | "FR";

const COUNTRY_REQUIRED_CODE = "country_required";
const COUNTRY_OPTIONS: CountryOption[] = ["RU", "US", "KZ", "DE", "GB", "FR"];

export function LeadForm() {
  const { locale, messages } = useAppContext();
  const siteKey = import.meta.env.TURNSTILE_SITE_KEY;
  const isTurnstileEnabled = Boolean(siteKey);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<CountryOption | "">("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);
  const [countryRequired, setCountryRequired] = useState(false);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const submitDisabled = status === "loading";
  const statusMessage = useMemo(() => {
    if (status === "success") {
      return messages.landing.leadForm.success;
    }

    if (status !== "error" || !errorCode) {
      return null;
    }

    if (errorCode === "turnstile_failed") {
      return messages.landing.leadForm.errors.turnstile;
    }

    if (errorCode === COUNTRY_REQUIRED_CODE) {
      return messages.landing.leadForm.errors.countryRequired;
    }

    if (errorCode === "duplicate_lead") {
      return messages.landing.leadForm.errors.duplicateLead;
    }

    if (errorCode === "rate_limited") {
      return messages.landing.leadForm.errors.rateLimited;
    }

    return messages.landing.leadForm.errors.generic;
  }, [errorCode, messages.landing.leadForm, status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !phone.trim()) {
      setStatus("error");
      setErrorCode("invalid_input");
      return;
    }

    if (countryRequired && !country) {
      setStatus("error");
      setErrorCode(COUNTRY_REQUIRED_CODE);
      return;
    }

    if (isTurnstileEnabled && !token) {
      setStatus("error");
      setErrorCode("turnstile_failed");
      return;
    }

    setStatus("loading");
    setErrorCode(null);

    const payload: CreateLeadRequest = {
      name: name.trim(),
      phone: phone.trim(),
      locale,
      source: "landing",
      turnstile_token: isTurnstileEnabled ? token : "captcha-disabled",
      ...(country ? { country } : {})
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setStatus("success");
        setCountryRequired(false);
        setName("");
        setPhone("");
        setCountry("");
        setToken("");
        setTurnstileResetKey((current) => current + 1);
        return;
      }

      const apiError = await readApiError(response);
      setErrorCode(apiError.code);
      setStatus("error");

      if (response.status === 422 && apiError.code === COUNTRY_REQUIRED_CODE) {
        setCountryRequired(true);
      }
    } catch {
      setErrorCode("internal_error");
      setStatus("error");
    } finally {
      setToken("");
      setTurnstileResetKey((current) => current + 1);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {messages.landing.leadForm.description}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">{messages.landing.leadForm.nameLabel}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">{messages.landing.leadForm.phoneLabel}</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {countryRequired ? (
        <label className="space-y-1">
          <span className="text-sm font-medium">{messages.landing.leadForm.countryLabel}</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value as CountryOption | "")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            required
          >
            <option value="">{messages.landing.leadForm.countryPlaceholder}</option>
            {COUNTRY_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {messages.landing.leadForm.countries[code]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {messages.landing.leadForm.countryHint}
          </p>
        </label>
      ) : null}

      {isTurnstileEnabled ? (
        <TurnstileWidget
          siteKey={siteKey ?? ""}
          locale={locale}
          resetKey={turnstileResetKey}
          onTokenChange={setToken}
        />
      ) : null}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={submitDisabled}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading"
            ? messages.landing.leadForm.submitLoading
            : messages.landing.leadForm.submitIdle}
        </button>

        <p
          className="min-h-5 text-sm text-slate-700 dark:text-slate-200"
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {statusMessage}
        </p>
      </div>
    </form>
  );
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
