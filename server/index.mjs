import express from "express";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

const COUNTRY_REQUIRED_CODE = "country_required";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const FALLBACK_PHONE_LIMIT_WINDOW_MINUTES = 10;
const FALLBACK_PHONE_LIMIT_MAX_REQUESTS = 3;
const IP_RATE_LIMIT_WINDOW_MINUTES = 10;
const IP_RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const staticDir = resolvePath(process.env.STATIC_DIR, join(repoRoot, "apps", "web", "dist"));
const migrationsDir = resolvePath(process.env.MIGRATIONS_DIR, join(repoRoot, "migrations"));
const databasePath = resolvePath(process.env.DATABASE_PATH, join(repoRoot, "data", "seminar.sqlite"));

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
app.use(express.json({ limit: "64kb" }));

app.get("/api/healthz", (_request, response) => {
  response.status(200).json({ ok: true });
});

app.post("/api/leads", async (request, response) => {
  try {
    const payload = parseCreateLeadRequest(request.body);
    if (!payload.ok) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: payload.message
      });
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
      return jsonError(response, 400, {
        code: "turnstile_failed",
        message: "Turnstile verification failed."
      });
    }

    const normalizedPhone = normalizePhone(payload.data.phone, payload.data.country);
    if (!normalizedPhone.ok) {
      return jsonError(response, normalizedPhone.status, normalizedPhone.error);
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
      return jsonError(response, 500, {
        code: "internal_error",
        message: "Failed to check duplicate leads."
      });
    }

    if (duplicateCount > 0) {
      return jsonError(response, 409, {
        code: "duplicate_lead",
        message: "Lead with this phone already exists in the last 24 hours."
      });
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
        return jsonError(response, 500, {
          code: "internal_error",
          message: "Failed to check fallback request rate."
        });
      }

      if (fallbackPhoneLimitedCount >= FALLBACK_PHONE_LIMIT_MAX_REQUESTS) {
        return jsonError(response, 429, {
          code: "rate_limited",
          message: "Too many requests. Please try again later."
        });
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
        return jsonError(response, 500, {
          code: "internal_error",
          message: "Failed to check request rate."
        });
      }

      if (rateLimitedCount >= IP_RATE_LIMIT_MAX_REQUESTS) {
        return jsonError(response, 429, {
          code: "rate_limited",
          message: "Too many requests. Please try again later."
        });
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

    return response.status(200).json({
      ok: true,
      lead_id: leadId
    });
  } catch (error) {
    console.error("Unhandled /api/leads error", error);
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/admin/leads", (request, response) => {
  try {
    if (!adminSecret) {
      return jsonError(response, 500, {
        code: "internal_error",
        message: "ADMIN_SECRET is not configured."
      });
    }

    const incomingSecret = readString(request.get("X-Admin-Secret"));
    if (!isSecretValid(incomingSecret, adminSecret)) {
      return jsonError(response, 401, {
        code: "admin_unauthorized",
        message: "Unauthorized admin request."
      });
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
    console.error("Unhandled /api/admin/leads error", error);
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.use("/api", (_request, response) => {
  return jsonError(response, 404, {
    code: "invalid_input",
    message: "Unknown API route."
  });
});

app.use(express.static(staticDir, { index: false }));
app.get("*", (request, response, next) => {
  if (request.path.startsWith("/api/")) {
    return next();
  }

  return response.sendFile(join(staticDir, "index.html"), (error) => {
    if (error) {
      next(error);
    }
  });
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return jsonError(response, 400, {
      code: "invalid_input",
      message: "Request body must be valid JSON."
    });
  }

  console.error("Unhandled application error", error);
  return jsonError(response, 500, {
    code: "internal_error",
    message: "Unexpected server error."
  });
});

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
  console.log(`Static directory: ${staticDir}`);
  console.log(`Database path: ${databasePath}`);
  if (!turnstileSecretKey) {
    console.warn("TURNSTILE_SECRET_KEY is not set; captcha verification is disabled.");
  }
  if (!adminSecret) {
    console.warn("ADMIN_SECRET is not set; /api/admin/leads will return config error.");
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

function jsonError(response, status, error) {
  return response.status(status).json(error);
}
