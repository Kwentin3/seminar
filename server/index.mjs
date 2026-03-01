import express from "express";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
// DO NOT use console.log for runtime events.
// Use server/obs/logger.mjs instead (CONTRACT-OBS-001).
import { logger } from "./obs/logger.mjs";
import { createRequestContextMiddleware } from "./obs/request-context.mjs";
import {
  ObsLogRetrievalError,
  parseObsHardCapBytes,
  parseObsHardCapLines,
  parseObsLevel,
  parseObsLimit,
  parseObsSource,
  streamObsEvents
} from "./obs/log-retrieval.mjs";
import { observeLandingRequest } from "./landing/content-observability.mjs";

const COUNTRY_REQUIRED_CODE = "country_required";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const FALLBACK_PHONE_LIMIT_WINDOW_MINUTES = 10;
const FALLBACK_PHONE_LIMIT_MAX_REQUESTS = 3;
const IP_RATE_LIMIT_WINDOW_MINUTES = 10;
const IP_RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const OBS_LOG_LIMIT_DEFAULT = 200;
const OBS_LOG_LIMIT_MAX = 2000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const staticDir = resolvePath(process.env.STATIC_DIR, join(repoRoot, "apps", "web", "dist"));
const migrationsDir = resolvePath(process.env.MIGRATIONS_DIR, join(repoRoot, "migrations"));
const databasePath = resolvePath(process.env.DATABASE_PATH, join(repoRoot, "data", "seminar.sqlite"));
const landingContentManifestPath = readString(process.env.LANDING_CONTENT_MANIFEST_PATH);

const host = readString(process.env.HOST) ?? "0.0.0.0";
const port = readPort(process.env.PORT, 8787);
const turnstileSecretKey = readString(process.env.TURNSTILE_SECRET_KEY);
const adminSecret = readString(process.env.ADMIN_SECRET);
const turnstileMode = readString(process.env.TURNSTILE_MODE) === "mock" ? "mock" : "real";
const allowTurnstileMock = process.env.ALLOW_TURNSTILE_MOCK === "1";

if (!existsSync(staticDir)) {
  throw new Error(`Static directory does not exist: ${staticDir}. Run "pnpm run build:web" first.`);
}

const db = openDatabase(databasePath);
applyMigrations(db, migrationsDir);

const app = express();
app.set("trust proxy", true);
app.use(createRequestContextMiddleware());
app.use(createHttpLifecycleMiddleware());
app.use(express.json({ limit: "64kb" }));

app.get("/api/healthz", (_request, response) => {
  response.status(200).json({ ok: true });
});

app.post("/api/leads", async (request, response) => {
  const startedAt = Date.now();
  logger.info({
    event: "lead_submit_started",
    domain: "leads",
    module: "leads/submit-handler",
    payload: {
      source: readString(request.body?.source) ?? "landing",
      locale: readLocale(request.body?.locale) ?? "unknown"
    }
  });

  const failLead = (status, errorBody, obsError) =>
    respondLeadFailure({
      response,
      status,
      errorBody,
      startedAt,
      obsError
    });

  try {
    const payload = parseCreateLeadRequest(request.body);
    if (!payload.ok) {
      return failLead(
        400,
        {
        code: "invalid_input",
        message: payload.message
        },
        createObsError("leads.validation_failed", "validation", false, "domain", payload.message)
      );
    }

    const remoteIp = getRemoteIp(request);
    const ipHash = remoteIp ? sha256Hex(remoteIp) : null;

    const turnstileOk = await verifyTurnstileToken({
      token: payload.data.turnstile_token,
      secretKey: turnstileSecretKey,
      mode: turnstileMode,
      allowMock: allowTurnstileMock,
      remoteIp
    });

    if (!turnstileOk) {
      return failLead(
        400,
        {
        code: "turnstile_failed",
        message: "Turnstile verification failed."
        },
        createObsError(
          "leads.turnstile_failed",
          "dependency",
          true,
          "external",
          "turnstile verification failed"
        )
      );
    }

    const normalizedPhone = normalizePhone(payload.data.phone, payload.data.country);
    if (!normalizedPhone.ok) {
      return failLead(
        normalizedPhone.status,
        normalizedPhone.error,
        createObsError(
          normalizedPhone.error.code === COUNTRY_REQUIRED_CODE ? "leads.country_required" : "leads.validation_failed",
          "validation",
          false,
          "domain",
          normalizedPhone.error.message
        )
      );
    }

    const duplicateCount = queryCount(
      db,
      `SELECT COUNT(*) AS c
       FROM leads
       WHERE phone_e164 = ?
       AND datetime(created_at) >= datetime('now', '-1 day')`,
      [normalizedPhone.phoneE164]
    );

    if (duplicateCount === null) {
      return failLead(
        500,
        {
        code: "internal_error",
        message: "Failed to check duplicate leads."
        },
        createObsError("leads.internal_error", "internal", true, "infra", "duplicate check failed")
      );
    }

    if (duplicateCount > 0) {
      return failLead(
        409,
        {
        code: "duplicate_lead",
        message: "Lead with this phone already exists in the last 24 hours."
        },
        createObsError("leads.duplicate_lead", "validation", false, "domain", "duplicate lead")
      );
    }

    if (!ipHash) {
      const fallbackPhoneLimitedCount = queryCount(
        db,
        `SELECT COUNT(*) AS c
         FROM leads
         WHERE phone_e164 = ?
         AND datetime(created_at) >= datetime('now', '-${FALLBACK_PHONE_LIMIT_WINDOW_MINUTES} minutes')`,
        [normalizedPhone.phoneE164]
      );

      if (fallbackPhoneLimitedCount === null) {
        return failLead(
          500,
          {
          code: "internal_error",
          message: "Failed to check fallback request rate."
          },
          createObsError("leads.internal_error", "internal", true, "infra", "fallback rate limit check failed")
        );
      }

      if (fallbackPhoneLimitedCount >= FALLBACK_PHONE_LIMIT_MAX_REQUESTS) {
        return failLead(
          429,
          {
          code: "rate_limited",
          message: "Too many requests. Please try again later."
          },
          createObsError("leads.rate_limited", "validation", true, "domain", "fallback phone rate limit")
        );
      }
    } else {
      const rateLimitedCount = queryCount(
        db,
        `SELECT COUNT(*) AS c
         FROM leads
         WHERE ip_hash = ?
         AND datetime(created_at) >= datetime('now', '-${IP_RATE_LIMIT_WINDOW_MINUTES} minutes')`,
        [ipHash]
      );

      if (rateLimitedCount === null) {
        return failLead(
          500,
          {
          code: "internal_error",
          message: "Failed to check request rate."
          },
          createObsError("leads.internal_error", "internal", true, "infra", "ip rate limit check failed")
        );
      }

      if (rateLimitedCount >= IP_RATE_LIMIT_MAX_REQUESTS) {
        return failLead(
          429,
          {
          code: "rate_limited",
          message: "Too many requests. Please try again later."
          },
          createObsError("leads.rate_limited", "validation", true, "domain", "ip rate limit")
        );
      }
    }

    const leadId = randomUUID();
    const createdAt = new Date().toISOString();
    const userAgent = request.get("user-agent") ?? "";

    const statement = db.prepare(
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
    );

    statement.run(
      leadId,
      createdAt,
      payload.data.name.trim(),
      normalizedPhone.phoneE164,
      normalizedPhone.country,
      payload.data.locale,
      payload.data.source,
      userAgent,
      ipHash
    );

    logger.info({
      event: "lead_submit_completed",
      domain: "leads",
      module: "leads/submit-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        source: payload.data.source
      }
    });

    return response.status(200).json({
      ok: true,
      lead_id: leadId
    });
  } catch (error) {
    logger.error({
      event: "lead_submit_failed",
      domain: "leads",
      module: "leads/submit-handler",
      duration_ms: elapsedMs(startedAt),
      payload: { status_code: 500, reason: "unhandled_exception" },
      error: createObsError("leads.unhandled_exception", "internal", true, "infra", "unhandled /api/leads error")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/admin/leads", (request, response) => {
  const startedAt = Date.now();
  try {
    if (!authenticateAdminRequest(request, response, startedAt, "admin/leads-handler")) {
      return undefined;
    }

    const limit = readLimit(request.query.limit);
    const statement = db.prepare(
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
    );
    const rows = statement.all(limit);

    return response.status(200).json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        name: row.name,
        phone_e164: row.phone_e164,
        country: typeof row.country === "string" && row.country.trim().length > 0 ? row.country : null,
        locale: row.locale === "en" ? "en" : "ru",
        source: row.source
      }))
    });
  } catch (error) {
    logger.error({
      event: "admin_action_failed",
      domain: "admin",
      module: "admin/leads-handler",
      duration_ms: elapsedMs(startedAt),
      payload: { status_code: 500, endpoint: "/api/admin/leads" },
      error: createObsError("admin.leads_query_failed", "internal", true, "infra", "admin leads query failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/admin/obs/logs", async (request, response) => {
  const startedAt = Date.now();
  try {
    if (!authenticateAdminRequest(request, response, startedAt, "admin/obs-logs-handler")) {
      return undefined;
    }

    const since = readString(request.query.since);
    if (!since) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "since is required."
      });
    }

    const levelRaw = readString(request.query.level);
    const level = levelRaw ? parseObsLevel(levelRaw, { required: true }) : undefined;
    if (levelRaw && !level) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "level must be debug|info|warn|error."
      });
    }

    const limit = parseObsLimit(request.query.limit, {
      defaultValue: OBS_LOG_LIMIT_DEFAULT,
      maxValue: OBS_LOG_LIMIT_MAX
    });
    const requestId = readString(request.query.request_id);
    const until = readString(request.query.until);
    const source = parseObsSource(process.env.OBS_LOG_SOURCE, { required: true });
    if (!source) {
      throw new ObsLogRetrievalError("OBS_LOG_SOURCE must be explicitly configured", {
        code: "obs_source_invalid",
        status: 500
      });
    }
    const hardCapLines = parseObsHardCapLines(process.env.OBS_LOG_HARD_CAP_LINES);
    const hardCapBytes = parseObsHardCapBytes(process.env.OBS_LOG_HARD_CAP_BYTES);
    const abortController = new AbortController();
    request.once("close", () => {
      abortController.abort();
    });
    logger.info({
      event: "obs_log_source_selected",
      domain: "obs",
      module: "admin/obs-logs-handler",
      payload: {
        source,
        limit,
        hard_cap_lines: hardCapLines,
        hard_cap_bytes: hardCapBytes
      }
    });
    const events = [];
    const retrieval = await streamObsEvents({
      source,
      since,
      until,
      level,
      requestId,
      limit,
      signal: abortController.signal,
      hardCapLines,
      hardCapBytes,
      onEvent: (event) => {
        events.push(event);
      }
    });

    if (abortController.signal.aborted) {
      return undefined;
    }

    logger.info({
      event: "obs_log_retrieval_completed",
      domain: "obs",
      module: "admin/obs-logs-handler",
      payload: {
        source: retrieval.source,
        emitted_count: retrieval.emitted_count,
        emitted_bytes: retrieval.emitted_bytes,
        hard_cap_lines: retrieval.hard_cap_lines,
        hard_cap_bytes: retrieval.hard_cap_bytes
      }
    });

    response.status(200);
    response.setHeader("content-type", "application/x-ndjson; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    for (const event of events) {
      response.write(`${JSON.stringify(event)}\n`);
    }
    response.end();
    return undefined;
  } catch (error) {
    const retrievalFailure = normalizeObsRetrievalFailure(error);
    if (retrievalFailure.code === "obs_budget_exceeded") {
      logger.warn({
        event: "obs_log_retrieval_limited",
        domain: "obs",
        module: "admin/obs-logs-handler",
        duration_ms: elapsedMs(startedAt),
        payload: {
          status_code: retrievalFailure.status,
          reason: retrievalFailure.code,
          details: retrievalFailure.details
        },
        error: createObsError(
          "obs.log_budget_exceeded",
          "validation",
          false,
          "obs",
          "obs log retrieval exceeded configured budget"
        )
      });
    }

    logger.error({
      event: "admin_action_failed",
      domain: "admin",
      module: "admin/obs-logs-handler",
      duration_ms: elapsedMs(startedAt),
      payload: { status_code: retrievalFailure.status, endpoint: "/admin/obs/logs" },
      error: createObsError("admin.obs_logs_failed", "internal", true, "infra", "obs log retrieval failed")
    });

    if (!response.headersSent) {
      return jsonError(response, retrievalFailure.status, {
        code: retrievalFailure.code,
        message: retrievalFailure.message
      });
    }

    response.end();
    return undefined;
  }
});

app.use("/api", (_request, response) => {
  return jsonError(response, 404, {
    code: "invalid_input",
    message: "Unknown API route."
  });
});

app.use(express.static(staticDir, { index: false }));
app.get("*", async (request, response, next) => {
  if (request.path.startsWith("/api/")) {
    return next();
  }

  if (request.path === "/") {
    await observeLandingRequest({
      logger,
      request,
      repoRoot,
      manifestPathOverride: landingContentManifestPath
    });
  }

  return response.sendFile(join(staticDir, "index.html"), (error) => {
    if (error) {
      next(error);
    }
  });
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    logger.warn({
      event: "http_request_failed",
      domain: "runtime",
      module: "runtime/http-middleware",
      payload: { status_code: 400, reason: "invalid_json" },
      error: createObsError("runtime.invalid_json", "validation", false, "domain", "request body must be valid json")
    });
    return jsonError(response, 400, {
      code: "invalid_input",
      message: "Request body must be valid JSON."
    });
  }

  logger.error({
    event: "http_request_failed",
    domain: "runtime",
    module: "runtime/http-middleware",
    payload: { status_code: 500, reason: "unhandled_error" },
    error: createObsError("runtime.unhandled_error", "internal", true, "infra", "unhandled application error")
  });
  return jsonError(response, 500, {
    code: "internal_error",
    message: "Unexpected server error."
  });
});

app.listen(port, host, () => {
  logger.info({
    event: "runtime_server_started",
    domain: "runtime",
    module: "runtime/server-bootstrap",
    payload: {
      host,
      port,
      static_dir: staticDir,
      database_path: databasePath
    }
  });
  if (!turnstileSecretKey) {
    logger.warn({
      event: "runtime_dependency_failed",
      domain: "runtime",
      module: "runtime/server-bootstrap",
      payload: {
        dependency: "turnstile",
        reason: "missing_secret_key"
      },
      error: createObsError(
        "runtime.turnstile_not_configured",
        "dependency",
        true,
        "infra",
        "turnstile secret key is not configured"
      )
    });
  }
  if (!adminSecret) {
    logger.warn({
      event: "runtime_dependency_failed",
      domain: "runtime",
      module: "runtime/server-bootstrap",
      payload: {
        dependency: "admin_secret",
        reason: "missing_admin_secret"
      },
      error: createObsError(
        "runtime.admin_secret_missing",
        "dependency",
        true,
        "infra",
        "admin secret is not configured"
      )
    });
  }
});

function openDatabase(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  return database;
}

function applyMigrations(database, migrationsPath) {
  if (!existsSync(migrationsPath)) {
    throw new Error(`Migrations directory does not exist: ${migrationsPath}`);
  }

  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const migrationFiles = readdirSync(migrationsPath)
    .filter((name) => extname(name).toLowerCase() === ".sql")
    .sort((left, right) => left.localeCompare(right));

  for (const migrationName of migrationFiles) {
    const alreadyApplied = database
      .prepare("SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1")
      .get(migrationName);

    if (alreadyApplied) {
      continue;
    }

    const sql = readFileSync(join(migrationsPath, migrationName), "utf8");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)")
        .run(migrationName, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

function queryCount(database, query, values) {
  try {
    const row = database.prepare(query).get(...values);
    const rawCount = row?.c;
    if (typeof rawCount === "number") {
      return Number.isFinite(rawCount) ? rawCount : null;
    }

    if (typeof rawCount === "bigint") {
      return Number(rawCount);
    }

    if (typeof rawCount === "string") {
      const parsed = Number(rawCount);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizePhone(rawPhone, rawCountry) {
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
      ? parsePhoneNumberFromString(normalizedInput, normalizedCountry)
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

async function verifyTurnstileToken({ token, secretKey, mode, allowMock, remoteIp }) {
  if (mode === "mock" && allowMock) {
    return token === "dev-ok";
  }

  if (!secretKey) {
    return true;
  }

  if (!token) {
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
    const result = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!result.ok) {
      return false;
    }

    const payload = await result.json();
    return payload?.success === true;
  } catch {
    return false;
  }
}

function parseCreateLeadRequest(value) {
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

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function readLocale(value) {
  return value === "ru" || value === "en" ? value : null;
}

function readTurnstileToken(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim();
}

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getRemoteIp(request) {
  const forwarded = request.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const ip = request.socket?.remoteAddress;
  return typeof ip === "string" && ip.trim().length > 0 ? ip : null;
}

function readLimit(value) {
  if (Array.isArray(value)) {
    return readLimit(value[0]);
  }

  if (typeof value !== "string" || value.length === 0) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function isSecretValid(incomingSecret, configuredSecret) {
  const incoming = Buffer.from(incomingSecret ?? "", "utf8");
  const configured = Buffer.from(configuredSecret, "utf8");
  const maxLength = Math.max(incoming.length, configured.length);
  let diff = incoming.length ^ configured.length;

  for (let index = 0; index < maxLength; index += 1) {
    const left = index < incoming.length ? incoming[index] : 0;
    const right = index < configured.length ? configured[index] : 0;
    diff |= left ^ right;
  }

  return diff === 0;
}

function resolvePath(candidate, fallback) {
  const raw = readString(candidate);
  return raw ? resolve(raw) : resolve(fallback);
}

function readPort(rawPort, fallback) {
  if (!rawPort) {
    return fallback;
  }

  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function createHttpLifecycleMiddleware() {
  return (request, response, next) => {
    const startedAt = Date.now();
    logger.info({
      event: "http_request_started",
      domain: "runtime",
      module: "runtime/http-middleware",
      payload: {
        method: request.method,
        path: request.path
      }
    });

    let finalized = false;
    const finalize = () => {
      if (finalized) {
        return;
      }
      finalized = true;
      logger.info({
        event: "http_request_completed",
        domain: "runtime",
        module: "runtime/http-middleware",
        duration_ms: elapsedMs(startedAt),
        payload: {
          method: request.method,
          path: request.path,
          status_code: response.statusCode
        }
      });
      logger.flushRequestDiagnostics();
    };

    response.once("finish", finalize);
    response.once("close", finalize);

    next();
  };
}

function elapsedMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

function createObsError(code, category, retryable, origin, message) {
  return {
    code,
    category,
    retryable,
    origin,
    message: readString(message) ?? "operation failed"
  };
}

function normalizeObsRetrievalFailure(error) {
  if (error instanceof ObsLogRetrievalError) {
    if (error.code === "obs_invalid_input") {
      return {
        status: error.status,
        code: "invalid_input",
        message: error.message,
        details: error.details ?? null
      };
    }

    if (error.code === "obs_budget_exceeded") {
      return {
        status: 413,
        code: "obs_budget_exceeded",
        message: "OBS log retrieval exceeded configured budget.",
        details: error.details ?? null
      };
    }

    if (error.code === "obs_source_invalid") {
      return {
        status: 500,
        code: "internal_error",
        message: "OBS_LOG_SOURCE must be set to journald or docker.",
        details: error.details ?? null
      };
    }

    if (error.code === "obs_source_unavailable") {
      return {
        status: 500,
        code: "internal_error",
        message: "OBS log source is unavailable.",
        details: error.details ?? null
      };
    }
  }

  return {
    status: 500,
    code: "internal_error",
    message: "Unexpected server error.",
    details: null
  };
}

function respondLeadFailure({ response, status, errorBody, startedAt, obsError }) {
  logger.error({
    event: "lead_submit_failed",
    domain: "leads",
    module: "leads/submit-handler",
    duration_ms: elapsedMs(startedAt),
    payload: {
      status_code: status,
      reason: errorBody.code
    },
    error: obsError
  });
  return jsonError(response, status, errorBody);
}

function authenticateAdminRequest(request, response, startedAt, moduleName) {
  if (!adminSecret) {
    logger.error({
      event: "admin_action_failed",
      domain: "admin",
      module: moduleName,
      duration_ms: elapsedMs(startedAt),
      payload: { endpoint: request.path, status_code: 500 },
      error: createObsError(
        "admin.secret_missing",
        "dependency",
        true,
        "infra",
        "admin secret is not configured"
      )
    });
    jsonError(response, 500, {
      code: "internal_error",
      message: "ADMIN_SECRET is not configured."
    });
    return false;
  }

  const incomingSecret = readString(request.get("X-Admin-Secret"));
  if (!isSecretValid(incomingSecret, adminSecret)) {
    logger.warn({
      event: "admin_auth_failed",
      domain: "admin",
      module: moduleName,
      duration_ms: elapsedMs(startedAt),
      payload: { endpoint: request.path, status_code: 401 },
      error: createObsError("admin.unauthorized", "validation", false, "domain", "unauthorized admin request")
    });
    jsonError(response, 401, {
      code: "admin_unauthorized",
      message: "Unauthorized admin request."
    });
    return false;
  }

  logger.info({
    event: "admin_auth_succeeded",
    domain: "admin",
    module: moduleName,
    duration_ms: elapsedMs(startedAt),
    payload: { endpoint: request.path }
  });
  return true;
}

function jsonError(response, status, error) {
  return response.status(status).json(error);
}
