import type { ApiError, CabinetLoginRequest, CabinetSessionResponse } from "@seminar/contracts";
import { SectionCard } from "@seminar/ui";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../app/useAppContext";

type LoginStatus = "checking" | "idle" | "loading" | "error";

export function CabinetLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { messages } = useAppContext();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>("checking");
  const [errorCode, setErrorCode] = useState<ApiError["code"] | null>(null);

  const nextPath = searchParams.get("next") || "/cabinet";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/cabinet/session", {
          credentials: "include"
        });

        if (cancelled) {
          return;
        }

        if (response.ok) {
          navigate("/cabinet", { replace: true });
          return;
        }

        setStatus("idle");
      } catch {
        if (!cancelled) {
          setStatus("idle");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setErrorCode(null);

    const payload: CabinetLoginRequest = {
      login,
      password
    };

    try {
      const response = await fetch("/api/cabinet/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await readApiError(response);
        setStatus("error");
        setErrorCode(error.code);
        return;
      }

      const body = (await response.json()) as CabinetSessionResponse;
      if (!body.ok) {
        setStatus("error");
        setErrorCode("internal_error");
        return;
      }

      navigate(nextPath, { replace: true });
    } catch {
      setStatus("error");
      setErrorCode("internal_error");
    }
  };

  const message =
    status === "checking"
      ? messages.cabinet.login.checkingSession
      : status === "error"
        ? getLoginErrorMessage(messages.cabinet.login.errors, errorCode)
        : null;

  return (
    <SectionCard
      title={messages.cabinet.login.heading}
      description={messages.cabinet.login.description}
      className="mx-auto max-w-xl"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.cabinet.login.loginLabel}</span>
          <input
            type="text"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.cabinet.login.passwordLabel}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900"
          />
        </label>

        {message ? (
          <p className="text-sm text-slate-700 dark:text-slate-200" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "loading" || status === "checking"}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading"
            ? messages.cabinet.login.submitLoading
            : messages.cabinet.login.submitIdle}
        </button>
      </form>
    </SectionCard>
  );
}

function getLoginErrorMessage(
  messages: { invalidCredentials: string; rateLimited: string; generic: string },
  errorCode: ApiError["code"] | null
) {
  if (errorCode === "cabinet_invalid_credentials") {
    return messages.invalidCredentials;
  }

  if (errorCode === "cabinet_rate_limited") {
    return messages.rateLimited;
  }

  if (errorCode) {
    return messages.generic;
  }

  return null;
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
