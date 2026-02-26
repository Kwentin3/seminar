import type { AdminListLeadsResponse, ApiError, LeadRow, Locale } from "@seminar/contracts";

type D1QueryResult<T> = {
  success: boolean;
  error?: string;
  results?: T[];
};

type D1PreparedStatement = {
  bind: (...values: Array<number | string>) => D1PreparedStatement;
  all: <T>() => Promise<D1QueryResult<T>>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

type Env = {
  DB: D1Database;
  ADMIN_SECRET?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

type LeadRowRecord = {
  id: string;
  created_at: string;
  name: string;
  phone_e164: string;
  country: string | null;
  locale: string;
  source: string;
};

const ADMIN_SECRET_HEADER = "X-Admin-Secret";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  try {
    const { request, env } = context;

    if (!env.DB) {
      return jsonError(500, {
        code: "internal_error",
        message: "D1 binding is not configured."
      });
    }

    const configuredSecret = readRequiredString(env.ADMIN_SECRET);
    if (!configuredSecret) {
      return jsonError(500, {
        code: "internal_error",
        message: "ADMIN_SECRET is not configured."
      });
    }

    const incomingSecret = readRequiredString(request.headers.get(ADMIN_SECRET_HEADER));
    if (!isSecretValid(incomingSecret, configuredSecret)) {
      return jsonError(401, {
        code: "admin_unauthorized",
        message: "Unauthorized admin request."
      });
    }

    const requestUrl = new URL(request.url);
    const limit = readLimit(requestUrl.searchParams.get("limit"));

    const result = await env.DB.prepare(
      `SELECT
        id,
        created_at,
        name,
        phone_e164,
        country,
        locale,
        source
      FROM leads
      ORDER BY created_at DESC
      LIMIT ?`
    )
      .bind(limit)
      .all<LeadRowRecord>();

    if (!result.success || !Array.isArray(result.results)) {
      return jsonError(500, {
        code: "internal_error",
        message: "Failed to fetch leads."
      });
    }

    const items = mapLeadRows(result.results);

    const response: AdminListLeadsResponse = {
      ok: true,
      items
    };

    return json(response, 200);
  } catch (error) {
    console.error("Unhandled /api/admin/leads error", error);
    return jsonError(500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
}

function readLimit(rawLimit: string | null): number {
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function mapLeadRows(rows: LeadRowRecord[]): LeadRow[] {
  return rows.map((row) => {
    const locale: Locale = row.locale === "en" ? "en" : "ru";
    const normalizedCountry =
      typeof row.country === "string" && row.country.trim().length > 0 ? row.country : null;

    return {
      id: row.id,
      created_at: row.created_at,
      name: row.name,
      phone_e164: row.phone_e164,
      country: normalizedCountry,
      locale,
      source: row.source
    };
  });
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSecretValid(incomingSecret: string | null, configuredSecret: string): boolean {
  const encoder = new TextEncoder();
  const incoming = encoder.encode(incomingSecret ?? "");
  const configured = encoder.encode(configuredSecret);
  const maxLength = Math.max(incoming.length, configured.length);

  let diff = incoming.length ^ configured.length;
  for (let i = 0; i < maxLength; i += 1) {
    const left = i < incoming.length ? incoming[i] : 0;
    const right = i < configured.length ? configured[i] : 0;
    diff |= left ^ right;
  }

  return diff === 0;
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
