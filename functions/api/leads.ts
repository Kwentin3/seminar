import type { ApiError, CreateLeadRequest, CreateLeadResponse, Locale } from "@seminar/contracts";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

type D1Result = {
  success: boolean;
  error?: string;
};

type D1QueryResult<T> = {
  success: boolean;
  error?: string;
  results?: T[];
};

type D1PreparedStatement = {
  bind: (...values: Array<number | string | null>) => D1PreparedStatement;
  run: () => Promise<D1Result>;
  all: <T>() => Promise<D1QueryResult<T>>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

type Env = {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_MODE?: string;
  CF_PAGES_BRANCH?: string;
  ALLOW_TURNSTILE_MOCK?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

type NormalizedPhone =
  | { ok: true; phoneE164: string; country: string | null }
  | { ok: false; status: number; error: ApiError };

type TurnstileMode = "real" | "mock";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const COUNTRY_REQUIRED_CODE = "country_required";
const FALLBACK_PHONE_LIMIT_WINDOW_MINUTES = 10;
const FALLBACK_PHONE_LIMIT_MAX_REQUESTS = 3;
let hasLoggedLocalEnvPresence = false;

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const { request, env } = context;
    if (env.CF_PAGES_BRANCH === "local") {
      logLocalEnvPresence(env);
    }

    const turnstileMode = resolveTurnstileMode(env);

    if (!env.DB) {
      return jsonError(500, {
        code: "config_missing",
        message: "D1 binding (DB) is not configured."
      });
    }

    if (turnstileMode === "real" && !env.TURNSTILE_SECRET_KEY) {
      return jsonError(500, {
        code: "config_missing",
        message: "TURNSTILE_SECRET_KEY is not configured."
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, {
        code: "invalid_input",
        message: "Request body must be valid JSON."
      });
    }

    const parsedBody = parseCreateLeadRequest(body);
    if (!parsedBody.ok) {
      return jsonError(400, {
        code: "invalid_input",
        message: parsedBody.message
      });
    }

    const payload = parsedBody.data;
    const remoteIp = request.headers.get("CF-Connecting-IP");
    const ipHash = remoteIp ? await sha256Hex(remoteIp) : null;

    const turnstileOk = await verifyTurnstileToken({
      mode: turnstileMode,
      token: payload.turnstile_token,
      secretKey: env.TURNSTILE_SECRET_KEY,
      remoteIp
    });
    if (!turnstileOk) {
      return jsonError(400, {
        code: "turnstile_failed",
        message: "Turnstile verification failed."
      });
    }

    const normalizedPhone = normalizePhone(payload.phone, payload.country);
    if (!normalizedPhone.ok) {
      return jsonError(normalizedPhone.status, normalizedPhone.error);
    }

    const duplicateCount = await queryCount(
      env.DB,
      `SELECT COUNT(*) AS c
      FROM leads
      WHERE phone_e164 = ?
      AND datetime(created_at) >= datetime('now', '-1 day')`,
      [normalizedPhone.phoneE164]
    );
    if (duplicateCount === null) {
      return jsonError(500, {
        code: "internal_error",
        message: "Failed to check duplicate leads."
      });
    }

    if (duplicateCount > 0) {
      return jsonError(409, {
        code: "duplicate_lead",
        message: "Lead with this phone already exists in the last 24 hours."
      });
    }

    if (!ipHash) {
      console.warn("CF-Connecting-IP is missing; applying fallback rate limit by phone_e164.");
      const fallbackPhoneLimitedCount = await queryCount(
        env.DB,
        `SELECT COUNT(*) AS c
        FROM leads
        WHERE phone_e164 = ?
        AND datetime(created_at) >= datetime('now', '-${FALLBACK_PHONE_LIMIT_WINDOW_MINUTES} minutes')`,
        [normalizedPhone.phoneE164]
      );
      if (fallbackPhoneLimitedCount === null) {
        return jsonError(500, {
          code: "internal_error",
          message: "Failed to check fallback request rate."
        });
      }

      if (fallbackPhoneLimitedCount >= FALLBACK_PHONE_LIMIT_MAX_REQUESTS) {
        return jsonError(429, {
          code: "rate_limited",
          message: "Too many requests. Please try again later."
        });
      }
    } else {
      const rateLimitedCount = await queryCount(
        env.DB,
        `SELECT COUNT(*) AS c
        FROM leads
        WHERE ip_hash = ?
        AND datetime(created_at) >= datetime('now', '-10 minutes')`,
        [ipHash]
      );
      if (rateLimitedCount === null) {
        return jsonError(500, {
          code: "internal_error",
          message: "Failed to check request rate."
        });
      }

      if (rateLimitedCount >= 5) {
        return jsonError(429, {
          code: "rate_limited",
          message: "Too many requests. Please try again later."
        });
      }
    }

    const leadId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const userAgent = request.headers.get("User-Agent") ?? "";

    const result = await env.DB.prepare(
      `INSERT INTO leads (
        id,
        created_at,
        name,
        phone_e164,
        country,
        locale,
        source,
        user_agent,
        ip_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        leadId,
        createdAt,
        payload.name.trim(),
        normalizedPhone.phoneE164,
        normalizedPhone.country,
        payload.locale,
        payload.source,
        userAgent,
        ipHash
      )
      .run();

    if (!result.success) {
      return jsonError(500, {
        code: "internal_error",
        message: "Failed to store lead."
      });
    }

    const response: CreateLeadResponse = {
      ok: true,
      lead_id: leadId
    };

    return json(response, 200);
  } catch (error) {
    console.error("Unhandled /api/leads error", error);
    return jsonError(500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
}

function normalizePhone(rawPhone: string, rawCountry?: string): NormalizedPhone {
  const trimmedPhone = rawPhone.trim();
  if (!trimmedPhone) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "invalid_phone",
        message: "Phone number is required."
      }
    };
  }

  const normalizedCountry = rawCountry?.trim().toUpperCase();
  const normalizedInput = trimmedPhone.startsWith("00") ? `+${trimmedPhone.slice(2)}` : trimmedPhone;

  const parsedFromInput = normalizedInput.startsWith("+")
    ? parsePhoneNumberFromString(normalizedInput)
    : null;

  const parsedWithCountry =
    !parsedFromInput && normalizedCountry
      ? parsePhoneNumberFromString(normalizedInput, normalizedCountry as CountryCode)
      : null;

  const digits = normalizedInput.replace(/\D+/g, "");
  const parsedByAutoDetect =
    !parsedFromInput && !parsedWithCountry && digits.length >= 7
      ? parsePhoneNumberFromString(`+${digits}`)
      : null;

  const parsed = parsedFromInput ?? parsedWithCountry ?? parsedByAutoDetect;
  if (!parsed || !parsed.isValid()) {
    if (!normalizedCountry && !normalizedInput.startsWith("+")) {
      return {
        ok: false,
        status: 422,
        error: {
          code: COUNTRY_REQUIRED_CODE,
          message: "Country is required to normalize this phone number."
        }
      };
    }

    return {
      ok: false,
      status: 400,
      error: {
        code: "invalid_phone",
        message: "Phone number is invalid."
      }
    };
  }

  const country = parsed.country ?? normalizedCountry ?? null;
  if (!country) {
    return {
        ok: false,
        status: 422,
        error: {
          code: COUNTRY_REQUIRED_CODE,
          message: "Country is required to normalize this phone number."
        }
      };
  }

  return {
    ok: true,
    phoneE164: parsed.number,
    country
  };
}

async function verifyTurnstileToken(params: {
  mode: TurnstileMode;
  token: string;
  secretKey?: string;
  remoteIp: string | null;
}): Promise<boolean> {
  const { mode, token, secretKey, remoteIp } = params;
  if (mode === "mock") {
    return token === "dev-ok";
  }

  if (!token || !secretKey) {
    return false;
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: token
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

async function queryCount(
  db: D1Database,
  query: string,
  values: Array<number | string | null>
): Promise<number | null> {
  const result = await db.prepare(query).bind(...values).all<{ c?: number | string | null }>();
  if (!result.success || !Array.isArray(result.results) || result.results.length === 0) {
    return null;
  }

  const rawCount = result.results[0]?.c;
  if (typeof rawCount === "number") {
    return Number.isFinite(rawCount) ? rawCount : null;
  }

  if (typeof rawCount === "string") {
    const parsed = Number(rawCount);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function jsonError(status: number, error: ApiError): Response {
  return json(error, status);
}

function parseCreateLeadRequest(
  value: unknown
): { ok: true; data: CreateLeadRequest } | { ok: false; message: string } {
  if (!isRecord(value)) {
    return { ok: false, message: "Payload must be an object." };
  }

  const name = readString(value.name);
  if (!name) {
    return { ok: false, message: "name is required." };
  }

  const phone = readString(value.phone);
  if (!phone) {
    return { ok: false, message: "phone is required." };
  }

  const token = readTurnstileToken(value.turnstile_token);
  if (token === null) {
    return { ok: false, message: "turnstile_token is required." };
  }

  const locale = readLocale(value.locale);
  if (!locale) {
    return { ok: false, message: "locale must be ru or en." };
  }

  const source = readString(value.source) ?? "landing";
  const countryRaw = readString(value.country);
  const country = countryRaw ? countryRaw.toUpperCase() : undefined;
  if (country && !/^[A-Z]{2}$/.test(country)) {
    return { ok: false, message: "country must be a 2-letter code." };
  }

  return {
    ok: true,
    data: {
      name,
      phone,
      turnstile_token: token,
      locale,
      source,
      ...(country ? { country } : {})
    }
  };
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readLocale(value: unknown): Locale | null {
  if (value === "ru" || value === "en") {
    return value;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTurnstileToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim();
}

function resolveTurnstileMode(env: Env): TurnstileMode {
  const requestedMock = env.TURNSTILE_MODE === "mock";
  const isLocalPagesBranch = env.CF_PAGES_BRANCH === "local";
  const isMockAllowed = env.ALLOW_TURNSTILE_MOCK === "1";

  if (requestedMock && isLocalPagesBranch && isMockAllowed) {
    return "mock";
  }

  if (requestedMock) {
    if (!isLocalPagesBranch) {
      console.warn("TURNSTILE_MODE=mock ignored because CF_PAGES_BRANCH is not local.");
    }

    if (!isMockAllowed) {
      console.warn("TURNSTILE_MODE=mock ignored because ALLOW_TURNSTILE_MOCK is not set to 1.");
    }
  }

  return "real";
}

function logLocalEnvPresence(env: Env): void {
  if (hasLoggedLocalEnvPresence) {
    return;
  }

  hasLoggedLocalEnvPresence = true;
  console.info("[/api/leads] Local env presence", {
    turnstileModePresent: isPresentString(env.TURNSTILE_MODE),
    allowTurnstileMockPresent: isPresentString(env.ALLOW_TURNSTILE_MOCK),
    turnstileSecretKeyPresent: isPresentString(env.TURNSTILE_SECRET_KEY),
    dbBindingPresent: Boolean(env.DB)
  });
}

function isPresentString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
