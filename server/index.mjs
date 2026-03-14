import express from "express";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import {
  authenticateCabinetRequest,
  clearExpiredSessions,
  clearFailedLoginAttempts,
  createCabinetAuthState,
  createLoginAttemptKey,
  createSession,
  deleteSession,
  isLoginRateLimited,
  readSessionToken,
  registerFailedLoginAttempt,
  serializeClearedSessionCookie,
  serializeSessionCookie
} from "./cabinet/auth.mjs";
import { readCabinetConfig } from "./cabinet/config.mjs";
import { createCabinetAdminUsersService } from "./cabinet/admin-users.mjs";
import { createMaterialSimplifyService } from "./cabinet/material-simplify.mjs";
import { syncMaterialsFromRegistry } from "./cabinet/materials-registry.mjs";
import { hashPassword, verifyPasswordWithFallback } from "./cabinet/passwords.mjs";
import { readLlmSimplifyConfig } from "./llm/config.mjs";
import { createDeepSeekClient } from "./llm/deepseek-client.mjs";
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
const cabinetConfig = readCabinetConfig(process.env);
const llmSimplifyConfig = readLlmSimplifyConfig(process.env);

if (!existsSync(staticDir)) {
  throw new Error(`Static directory does not exist: ${staticDir}. Run "pnpm run build:web" first.`);
}

const db = openDatabase(databasePath);
// Startup runs schema migrations automatically. For the first cabinet go-live on
// a pre-cabinet production DB, a SQLite triplet backup is mandatory before rollout.
applyMigrations(db, migrationsDir);
const materialSyncSummary = syncMaterialsFromRegistry(db, repoRoot);
// This bootstrap path is only for creating or intentionally resetting the first
// cabinet admin. Do not leave reset-enabled bootstrap envs in long-lived production.
const bootstrapAdminSummary = ensureBootstrapAdmin(db, cabinetConfig);
const cabinetAuthState = createCabinetAuthState();
const llmClient = createDeepSeekClient(llmSimplifyConfig);
const materialSimplifyService = createMaterialSimplifyService({
  database: db,
  repoRoot,
  llmConfig: llmSimplifyConfig,
  client: llmClient
});
const cabinetAdminUsersService = createCabinetAdminUsersService({
  database: db
});

const app = express();
app.set("trust proxy", true);
app.use(createRequestContextMiddleware());
app.use(createHttpLifecycleMiddleware());
app.use(express.json({ limit: "64kb" }));

app.get("/api/healthz", (_request, response) => {
  response.status(200).json({ ok: true });
});

app.post("/api/cabinet/login", (request, response) => {
  const startedAt = Date.now();

  try {
    const payload = parseCabinetLoginRequest(request.body);
    if (!payload.ok) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: payload.message
      });
    }

    const remoteIp = getRemoteIp(request);
    const attemptKey = createLoginAttemptKey(payload.data.login, remoteIp);
    const now = Date.now();
    if (isLoginRateLimited(cabinetAuthState, attemptKey, now, cabinetConfig)) {
      logger.warn({
        event: "cabinet_login_failed",
        domain: "cabinet",
        module: "cabinet/login-handler",
        duration_ms: elapsedMs(startedAt),
        payload: {
          status_code: 429,
          reason: "rate_limited"
        }
      });
      return jsonError(response, 429, {
        code: "cabinet_rate_limited",
        message: "Слишком много попыток входа. Попробуйте позже."
      });
    }

    const user = findCabinetUserByLogin(db, payload.data.login);
    const isPasswordValid = verifyPasswordWithFallback(payload.data.password, user?.password_hash);
    if (!user || !isPasswordValid) {
      registerFailedLoginAttempt(cabinetAuthState, attemptKey, now, cabinetConfig);
      logger.warn({
        event: "cabinet_login_failed",
        domain: "cabinet",
        module: "cabinet/login-handler",
        duration_ms: elapsedMs(startedAt),
        payload: {
          status_code: 401,
          reason: "invalid_credentials"
        }
      });
      return jsonError(response, 401, {
        code: "cabinet_invalid_credentials",
        message: "Неверный логин или пароль."
      });
    }

    clearFailedLoginAttempts(cabinetAuthState, attemptKey);
    clearExpiredSessions(db);

    const session = createSession(db, user.id, cabinetConfig);
    db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      new Date().toISOString(),
      user.id
    );

    response.setHeader("Set-Cookie", serializeSessionCookie(session.token, cabinetConfig, session.expiresAt));
    logger.info({
      event: "cabinet_login_succeeded",
      domain: "cabinet",
      module: "cabinet/login-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: user.role
      }
    });
    return response.status(200).json({
      ok: true,
      user: sanitizeCabinetUser(user)
    });
  } catch (error) {
    logger.error({
      event: "cabinet_action_failed",
      domain: "cabinet",
      module: "cabinet/login-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/login"
      },
      error: createObsError("cabinet.login_failed", "internal", true, "infra", "cabinet login failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/logout", (request, response) => {
  const startedAt = Date.now();

  try {
    const sessionToken = readSessionToken(request, cabinetConfig);
    deleteSession(db, sessionToken);
    response.setHeader("Set-Cookie", serializeClearedSessionCookie(cabinetConfig));
    logger.info({
      event: "cabinet_logout_succeeded",
      domain: "cabinet",
      module: "cabinet/logout-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200
      }
    });
    return response.status(200).json({ ok: true });
  } catch (error) {
    logger.error({
      event: "cabinet_action_failed",
      domain: "cabinet",
      module: "cabinet/logout-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/logout"
      },
      error: createObsError("cabinet.logout_failed", "internal", true, "infra", "cabinet logout failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/session", (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/session-handler");
    if (!cabinetSession) {
      return undefined;
    }

    return response.status(200).json({
      ok: true,
      user: sanitizeCabinetUser(cabinetSession)
    });
  } catch (error) {
    logger.error({
      event: "cabinet_action_failed",
      domain: "cabinet",
      module: "cabinet/session-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/session"
      },
      error: createObsError("cabinet.session_failed", "internal", true, "infra", "cabinet session failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/materials", (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/materials-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const materials = queryCabinetMaterialRows(db);
    const items = materials.map((row) => toCabinetMaterialApiItem(row));

    const stats =
      cabinetSession.role === "admin"
        ? {
            total_materials: items.length,
            categories: Array.from(new Set(items.map((item) => item.category))).sort()
          }
        : null;

    return response.status(200).json({
      ok: true,
      items,
      viewer_role: cabinetSession.role,
      stats
    });
  } catch (error) {
    logger.error({
      event: "cabinet_action_failed",
      domain: "cabinet",
      module: "cabinet/materials-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials"
      },
      error: createObsError("cabinet.materials_failed", "internal", true, "infra", "cabinet materials failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/materials/:slug", (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/material-detail-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const slug = readString(request.params.slug);
    if (!slug) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "Material slug is required."
      });
    }

    const material = findCabinetMaterialRow(db, slug);
    if (!material) {
      return jsonError(response, 404, {
        code: "invalid_input",
        message: "Material not found."
      });
    }

    const content = readCabinetMaterialContent(repoRoot, material);
    const relatedItems = buildRelatedCabinetItems(queryCabinetMaterialRows(db), material.slug);

    logger.info({
      event: "cabinet_material_read_completed",
      domain: "cabinet",
      module: "cabinet/material-detail-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        slug: material.slug,
        role: cabinetSession.role,
        reading_mode: isInAppReadableMaterial(material) ? "in_app" : "external"
      }
    });

    return response.status(200).json({
      ok: true,
      item: {
        ...toCabinetMaterialApiItem(material),
        content,
        related_items: relatedItems
      }
    });
  } catch (error) {
    logger.error({
      event: "cabinet_action_failed",
      domain: "cabinet",
      module: "cabinet/material-detail-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials/:slug"
      },
      error: createObsError("cabinet.material_read_failed", "internal", true, "infra", "cabinet material detail failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/materials/:slug/simplify", async (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/material-simplify-state-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const slug = readString(request.params.slug);
    if (!slug) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "Material slug is required."
      });
    }

    const result = materialSimplifyService.getSimplifyState(slug);
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_material_simplify_completed",
      domain: "cabinet",
      module: "cabinet/material-simplify-state-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        slug,
        role: cabinetSession.role,
        simplify_status: result.state.status,
        error_code: result.state.error_code,
        delivery_mode: result.state.delivery_mode
      }
    });

    return response.status(200).json({
      ok: true,
      state: result.state
    });
  } catch {
    logger.error({
      event: "cabinet_material_simplify_failed",
      domain: "cabinet",
      module: "cabinet/material-simplify-state-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials/:slug/simplify"
      },
      error: createObsError(
        "cabinet.material_simplify_state_failed",
        "internal",
        true,
        "infra",
        "cabinet material simplify state failed"
      )
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/materials/:slug/simplify", async (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/material-simplify-generate-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const slug = readString(request.params.slug);
    if (!slug) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "Material slug is required."
      });
    }

    const force = request.body?.force === true;
    const result = await materialSimplifyService.generate(slug, { force });
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_material_simplify_completed",
      domain: "cabinet",
      module: "cabinet/material-simplify-generate-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        slug,
        role: cabinetSession.role,
        simplify_status: result.state.status,
        error_code: result.state.error_code,
        delivery_mode: result.state.delivery_mode,
        force
      }
    });

    return response.status(200).json({
      ok: true,
      state: result.state
    });
  } catch {
    logger.error({
      event: "cabinet_material_simplify_failed",
      domain: "cabinet",
      module: "cabinet/material-simplify-generate-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials/:slug/simplify"
      },
      error: createObsError(
        "cabinet.material_simplify_generate_failed",
        "internal",
        true,
        "infra",
        "cabinet material simplify generate failed"
      )
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/materials/:slug/simplify/regenerate", async (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/material-simplify-regenerate-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const slug = readString(request.params.slug);
    if (!slug) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "Material slug is required."
      });
    }

    const result = await materialSimplifyService.generate(slug, { force: true });
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_material_simplify_completed",
      domain: "cabinet",
      module: "cabinet/material-simplify-regenerate-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        slug,
        role: cabinetSession.role,
        simplify_status: result.state.status,
        error_code: result.state.error_code,
        delivery_mode: result.state.delivery_mode,
        force: true
      }
    });

    return response.status(200).json({
      ok: true,
      state: result.state
    });
  } catch {
    logger.error({
      event: "cabinet_material_simplify_failed",
      domain: "cabinet",
      module: "cabinet/material-simplify-regenerate-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials/:slug/simplify/regenerate"
      },
      error: createObsError(
        "cabinet.material_simplify_regenerate_failed",
        "internal",
        true,
        "infra",
        "cabinet material simplify regenerate failed"
      )
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/materials/:slug/simplify/stream", async (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/material-simplify-stream-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const slug = readString(request.params.slug);
    if (!slug) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "Material slug is required."
      });
    }

    const forceRaw = readString(request.query.force);
    const force = forceRaw === "1" || forceRaw === "true";
    let responseClosed = false;
    request.once("close", () => {
      responseClosed = true;
    });

    response.status(200);
    response.setHeader("content-type", "text/event-stream; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.setHeader("connection", "keep-alive");
    response.flushHeaders?.();

    const result = await materialSimplifyService.streamGenerate(slug, {
      force,
      onEvent: async (event) => {
        if (responseClosed || response.writableEnded) {
          return;
        }

        writeSseEvent(response, event.type, event.data);
      }
    });

    if (!result.ok) {
      if (!responseClosed && !response.writableEnded) {
        writeSseEvent(response, "error", {
          error_code: result.error.body.code,
          error_message: result.error.body.message,
          state: null,
          cache_preserved: false
        });
      }
      logger.warn({
        event: "cabinet_material_simplify_stream_failed",
        domain: "cabinet",
        module: "cabinet/material-simplify-stream-handler",
        duration_ms: elapsedMs(startedAt),
        payload: {
          status_code: result.error.status,
          slug,
          role: cabinetSession.role,
          force,
          error_code: result.error.body.code
        }
      });
      if (!responseClosed && !response.writableEnded) {
        response.end();
      }
      return undefined;
    }

    logger.info({
      event: "cabinet_material_simplify_stream_completed",
      domain: "cabinet",
      module: "cabinet/material-simplify-stream-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        slug,
        role: cabinetSession.role,
        force,
        simplify_status: result.state.status,
        error_code: result.state.error_code,
        delivery_mode: result.state.delivery_mode
      }
    });

    if (!responseClosed && !response.writableEnded) {
      response.end();
    }
    return undefined;
  } catch {
    logger.error({
      event: "cabinet_material_simplify_stream_failed",
      domain: "cabinet",
      module: "cabinet/material-simplify-stream-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials/:slug/simplify/stream"
      },
      error: createObsError(
        "cabinet.material_simplify_stream_failed",
        "internal",
        true,
        "infra",
        "cabinet material simplify stream failed"
      )
    });
    if (!response.headersSent) {
      return jsonError(response, 500, {
        code: "internal_error",
        message: "Unexpected server error."
      });
    }

    if (!response.writableEnded) {
      writeSseEvent(response, "error", {
        error_code: "internal_error",
        error_message: "Unexpected server error.",
        state: null,
        cache_preserved: false
      });
      response.end();
    }
    return undefined;
  }
});

app.get("/api/cabinet/admin/llm-simplify/settings", (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/llm-settings-read-handler");
    if (!adminSession) {
      return undefined;
    }

    const result = materialSimplifyService.getSettings();
    logger.info({
      event: "cabinet_llm_settings_read_completed",
      domain: "cabinet",
      module: "cabinet/llm-settings-read-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role
      }
    });

    return response.status(200).json({
      ok: true,
      key_configured: result.key_configured,
      settings: result.settings,
      effective_config: result.effective_config,
      recent_failure: result.recent_failure
    });
  } catch {
    logger.error({
      event: "cabinet_llm_settings_failed",
      domain: "cabinet",
      module: "cabinet/llm-settings-read-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/llm-simplify/settings"
      },
      error: createObsError("cabinet.llm_settings_read_failed", "internal", true, "infra", "cabinet llm settings read failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.put("/api/cabinet/admin/llm-simplify/settings", (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/llm-settings-update-handler");
    if (!adminSession) {
      return undefined;
    }

    const result = materialSimplifyService.updateSettings(request.body ?? {}, adminSession.userId);
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_llm_settings_update_completed",
      domain: "cabinet",
      module: "cabinet/llm-settings-update-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role
      }
    });

    return response.status(200).json({
      ok: true,
      key_configured: result.key_configured,
      settings: result.settings,
      effective_config: result.effective_config,
      recent_failure: result.recent_failure
    });
  } catch {
    logger.error({
      event: "cabinet_llm_settings_failed",
      domain: "cabinet",
      module: "cabinet/llm-settings-update-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/llm-simplify/settings"
      },
      error: createObsError(
        "cabinet.llm_settings_update_failed",
        "internal",
        true,
        "infra",
        "cabinet llm settings update failed"
      )
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/admin/llm-simplify/test-connection", async (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/llm-test-connection-handler");
    if (!adminSession) {
      return undefined;
    }

    const result = await materialSimplifyService.testConnection();
    logger.info({
      event: "cabinet_llm_connection_test_completed",
      domain: "cabinet",
      module: "cabinet/llm-test-connection-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role,
        connection_status: result.status,
        error_code: result.error_code
      }
    });

    return response.status(200).json(result);
  } catch {
    logger.error({
      event: "cabinet_llm_settings_failed",
      domain: "cabinet",
      module: "cabinet/llm-test-connection-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/llm-simplify/test-connection"
      },
      error: createObsError(
        "cabinet.llm_connection_test_failed",
        "internal",
        true,
        "infra",
        "cabinet llm connection test failed"
      )
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/admin/users", (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/admin-users-list-handler");
    if (!adminSession) {
      return undefined;
    }

    const result = cabinetAdminUsersService.listUsers();
    logger.info({
      event: "cabinet_admin_users_completed",
      domain: "cabinet",
      module: "cabinet/admin-users-list-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role,
        action: "list",
        item_count: result.items.length
      }
    });

    return response.status(200).json({
      ok: true,
      items: result.items
    });
  } catch {
    logger.error({
      event: "cabinet_admin_users_failed",
      domain: "cabinet",
      module: "cabinet/admin-users-list-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/users"
      },
      error: createObsError("cabinet.admin_users_list_failed", "internal", true, "infra", "cabinet admin users list failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/admin/users", (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/admin-users-create-handler");
    if (!adminSession) {
      return undefined;
    }

    const result = cabinetAdminUsersService.createViewer(request.body ?? {});
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_admin_users_completed",
      domain: "cabinet",
      module: "cabinet/admin-users-create-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role,
        action: "create_viewer",
        target_user_id: result.item.id
      }
    });

    return response.status(200).json({
      ok: true,
      item: result.item
    });
  } catch {
    logger.error({
      event: "cabinet_admin_users_failed",
      domain: "cabinet",
      module: "cabinet/admin-users-create-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/users"
      },
      error: createObsError("cabinet.admin_users_create_failed", "internal", true, "infra", "cabinet admin users create failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/admin/users/:id/reset-password", (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/admin-users-reset-password-handler");
    if (!adminSession) {
      return undefined;
    }

    const userId = readString(request.params.id);
    if (!userId) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "User id is required."
      });
    }

    const result = cabinetAdminUsersService.resetPassword(userId, request.body ?? {});
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_admin_users_completed",
      domain: "cabinet",
      module: "cabinet/admin-users-reset-password-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role,
        action: "reset_password",
        target_user_id: result.item.id
      }
    });

    return response.status(200).json({
      ok: true,
      item: result.item
    });
  } catch {
    logger.error({
      event: "cabinet_admin_users_failed",
      domain: "cabinet",
      module: "cabinet/admin-users-reset-password-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/users/:id/reset-password"
      },
      error: createObsError(
        "cabinet.admin_users_reset_password_failed",
        "internal",
        true,
        "infra",
        "cabinet admin users reset password failed"
      )
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.post("/api/cabinet/admin/users/:id/set-active", (request, response) => {
  const startedAt = Date.now();

  try {
    const adminSession = requireCabinetAdmin(request, response, startedAt, "cabinet/admin-users-set-active-handler");
    if (!adminSession) {
      return undefined;
    }

    const userId = readString(request.params.id);
    if (!userId) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "User id is required."
      });
    }

    const result = cabinetAdminUsersService.setActive(userId, request.body ?? {}, adminSession.userId);
    if (!result.ok) {
      return jsonError(response, result.error.status, result.error.body);
    }

    logger.info({
      event: "cabinet_admin_users_completed",
      domain: "cabinet",
      module: "cabinet/admin-users-set-active-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        role: adminSession.role,
        action: result.item.is_active ? "activate" : "deactivate",
        target_user_id: result.item.id
      }
    });

    return response.status(200).json({
      ok: true,
      item: result.item
    });
  } catch {
    logger.error({
      event: "cabinet_admin_users_failed",
      domain: "cabinet",
      module: "cabinet/admin-users-set-active-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/admin/users/:id/set-active"
      },
      error: createObsError("cabinet.admin_users_set_active_failed", "internal", true, "infra", "cabinet admin users set active failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
});

app.get("/api/cabinet/materials/:slug/open", (request, response) => {
  const startedAt = Date.now();

  try {
    const cabinetSession = requireCabinetSession(request, response, startedAt, "cabinet/material-open-handler");
    if (!cabinetSession) {
      return undefined;
    }

    const slug = readString(request.params.slug);
    if (!slug) {
      return jsonError(response, 400, {
        code: "invalid_input",
        message: "Material slug is required."
      });
    }

    const material = db
      .prepare(
        `SELECT
          slug,
          title,
          source_kind,
          source_path
         FROM materials
         WHERE slug = ?
           AND is_active = 1
         LIMIT 1`
      )
      .get(slug);

    if (!material) {
      return jsonError(response, 404, {
        code: "invalid_input",
        message: "Material not found."
      });
    }

    if (material.source_kind === "external_url") {
      return response.redirect(material.source_path);
    }

    const absolutePath = resolveMaterialPath(repoRoot, material.source_path);
    if (!absolutePath || !existsSync(absolutePath)) {
      logger.warn({
      event: "cabinet_material_open_failed",
      domain: "cabinet",
      module: "cabinet/material-open-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 404,
        slug: material.slug
      },
      error: createObsError(
        "cabinet.material_unavailable",
        "dependency",
        false,
        "infra",
        "cabinet material file is unavailable"
      )
    });
      return jsonError(response, 404, {
        code: "invalid_input",
        message: "Material file is unavailable."
      });
    }

    logger.info({
      event: "cabinet_material_open_completed",
      domain: "cabinet",
      module: "cabinet/material-open-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 200,
        slug: material.slug,
        role: cabinetSession.role
      }
    });

    if (material.source_kind === "repo_markdown") {
      response.type("text/markdown; charset=utf-8");
      return response.send(readFileSync(absolutePath, "utf8"));
    }

    return response.sendFile(absolutePath, {
      headers: {
        "Content-Disposition": "inline"
      }
    });
  } catch (error) {
    logger.error({
      event: "cabinet_action_failed",
      domain: "cabinet",
      module: "cabinet/material-open-handler",
      duration_ms: elapsedMs(startedAt),
      payload: {
        status_code: 500,
        endpoint: "/api/cabinet/materials/:slug/open"
      },
      error: createObsError("cabinet.material_open_failed", "internal", true, "infra", "cabinet material open failed")
    });
    return jsonError(response, 500, {
      code: "internal_error",
      message: "Unexpected server error."
    });
  }
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
      database_path: databasePath,
      cabinet_materials_seeded: materialSyncSummary.totalCount
    }
  });
  if (bootstrapAdminSummary.status === "created" || bootstrapAdminSummary.status === "updated") {
    logger.info({
      event: "cabinet_bootstrap_completed",
      domain: "cabinet",
      module: "runtime/server-bootstrap",
      duration_ms: 0,
      payload: {
        status: bootstrapAdminSummary.status
      }
    });
  }
  if (bootstrapAdminSummary.status === "exists") {
    logger.warn({
      event: "runtime_dependency_failed",
      domain: "cabinet",
      module: "runtime/server-bootstrap",
      payload: {
        dependency: "cabinet_bootstrap_admin",
        reason: "bootstrap_flag_left_enabled_without_reset"
      },
      error: createObsError(
        "cabinet.bootstrap_admin_exists",
        "dependency",
        false,
        "infra",
        "bootstrap admin env is still enabled; no reset was performed because CABINET_BOOTSTRAP_ALLOW_RESET is not enabled"
      )
    });
  }
  if (bootstrapAdminSummary.status === "missing") {
    logger.warn({
      event: "runtime_dependency_failed",
      domain: "cabinet",
      module: "runtime/server-bootstrap",
      payload: {
        dependency: "cabinet_bootstrap_admin",
        reason: "no_active_admin_user"
      },
      error: createObsError(
        "cabinet.bootstrap_admin_missing",
        "dependency",
        true,
        "infra",
        "cabinet has no active admin user and bootstrap seed is disabled"
      )
    });
  }
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
  if (!llmSimplifyConfig.apiKey) {
    logger.warn({
      event: "runtime_dependency_failed",
      domain: "runtime",
      module: "runtime/server-bootstrap",
      payload: {
        dependency: "deepseek_api_key",
        reason: "missing_api_key"
      },
      error: createObsError(
        "runtime.deepseek_api_key_missing",
        "dependency",
        true,
        "infra",
        "deepseek api key is not configured"
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

function ensureBootstrapAdmin(database, config) {
  const now = new Date().toISOString();
  const activeAdminCount = queryCount(
    database,
    "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1",
    []
  );

  if (!config.bootstrapAdmin.enabled) {
    return {
      status: activeAdminCount && activeAdminCount > 0 ? "skipped" : "missing"
    };
  }

  const normalizedUsername = config.bootstrapAdmin.username.trim().toLowerCase();
  const normalizedEmail = config.bootstrapAdmin.email?.toLowerCase() ?? null;
  const existing = database
    .prepare(
      `SELECT id
       FROM users
       WHERE lower(username) = ?
          OR (? IS NOT NULL AND lower(email) = ?)
       LIMIT 1`
    )
    .get(normalizedUsername, normalizedEmail, normalizedEmail);

  const passwordHash = hashPassword(config.bootstrapAdmin.password);

  // Bootstrap is env-driven by design so the first admin can be recreated
  // without manual SQL. The env flag should be removed after the intended reset.
  if (existing) {
    if (!config.bootstrapAdmin.allowReset) {
      return { status: "exists", userId: existing.id };
    }

    database
      .prepare(
        `UPDATE users
         SET username = ?,
             email = ?,
             password_hash = ?,
             role = 'admin',
             is_active = 1,
             updated_at = ?
         WHERE id = ?`
      )
      .run(normalizedUsername, normalizedEmail, passwordHash, now, existing.id);
    // Resetting the bootstrap admin password should also invalidate prior sessions
    // so an env-assisted reset does not leave stale authenticated cookies alive.
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
    return { status: "updated", userId: existing.id };
  }

  const userId = randomUUID();
  database
    .prepare(
      `INSERT INTO users (
        id,
        username,
        email,
        password_hash,
        role,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`
    )
    .run(userId, normalizedUsername, normalizedEmail, passwordHash, now, now);

  return { status: "created", userId };
}

function findCabinetUserByLogin(database, login) {
  const normalizedLogin = login.trim().toLowerCase();
  return database
    .prepare(
      `SELECT
        id,
        username,
        email,
        password_hash,
        role,
        is_active
       FROM users
       WHERE is_active = 1
         AND (lower(username) = ? OR lower(email) = ?)
       LIMIT 1`
    )
    .get(normalizedLogin, normalizedLogin);
}

function sanitizeCabinetUser(user) {
  return {
    id: user.userId ?? user.id,
    username: user.username,
    email: typeof user.email === "string" ? user.email : null,
    role: user.role === "admin" ? "admin" : "viewer"
  };
}

function parseCabinetLoginRequest(value) {
  if (!isRecord(value)) {
    return { ok: false, message: "Payload must be an object." };
  }

  const login = readString(value.login);
  if (!login) {
    return { ok: false, message: "login is required." };
  }

  const password = readString(value.password);
  if (!password) {
    return { ok: false, message: "password is required." };
  }

  return {
    ok: true,
    data: {
      login,
      password
    }
  };
}

function requireCabinetSession(request, response, startedAt, moduleName) {
  const cabinetSession = authenticateCabinetRequest(db, request, cabinetConfig);
  if (cabinetSession) {
    return cabinetSession;
  }

  logger.warn({
    event: "cabinet_auth_failed",
    domain: "cabinet",
    module: moduleName,
    duration_ms: elapsedMs(startedAt),
    payload: {
      endpoint: request.path,
      status_code: 401
    },
    error: createObsError("cabinet.unauthorized", "validation", false, "domain", "unauthorized cabinet request")
  });
  jsonError(response, 401, {
    code: "cabinet_unauthorized",
    message: "Требуется вход в кабинет."
  });
  return null;
}

function requireCabinetAdmin(request, response, startedAt, moduleName) {
  const cabinetSession = requireCabinetSession(request, response, startedAt, moduleName);
  if (!cabinetSession) {
    return null;
  }

  if (cabinetSession.role === "admin") {
    return cabinetSession;
  }

  logger.warn({
    event: "cabinet_access_denied",
    domain: "cabinet",
    module: moduleName,
    duration_ms: elapsedMs(startedAt),
    payload: {
      endpoint: request.path,
      status_code: 403,
      role: cabinetSession.role
    },
    error: createObsError("cabinet.forbidden", "validation", false, "domain", "forbidden cabinet admin request")
  });
  jsonError(response, 403, {
    code: "cabinet_forbidden",
    message: "Недостаточно прав для этого действия."
  });
  return null;
}

function parseTagsJson(rawTags) {
  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string" && tag.length > 0) : [];
  } catch {
    return [];
  }
}

function queryCabinetMaterialRows(database) {
  return database
    .prepare(
      `SELECT
        id,
        slug,
        title,
        summary,
        material_status,
        material_type,
        category,
        theme,
        audience,
        language,
        source_updated_at,
        curation_reviewed_at,
        source_kind,
        source_path,
        recommended_for_lecture_prep,
        tags_json
       FROM materials
       WHERE is_active = 1
       ORDER BY
         recommended_for_lecture_prep DESC,
         CASE material_status
           WHEN 'final' THEN 0
           WHEN 'working' THEN 1
           ELSE 2
         END ASC,
         title ASC`
    )
    .all();
}

function findCabinetMaterialRow(database, slug) {
  return database
    .prepare(
      `SELECT
        id,
        slug,
        title,
        summary,
        material_status,
        material_type,
        category,
        theme,
        audience,
        language,
        source_updated_at,
        curation_reviewed_at,
        source_kind,
        source_path,
        recommended_for_lecture_prep,
        tags_json
       FROM materials
       WHERE slug = ?
         AND is_active = 1
       LIMIT 1`
    )
    .get(slug);
}

function toCabinetMaterialApiItem(row) {
  const readingMode = isInAppReadableMaterial(row) ? "in_app" : "external";

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: typeof row.summary === "string" && row.summary.trim().length > 0 ? row.summary : null,
    material_status: row.material_status === "final" || row.material_status === "working" ? row.material_status : "draft",
    material_type: row.material_type,
    category: row.category,
    theme: typeof row.theme === "string" && row.theme.trim().length > 0 ? row.theme : null,
    audience: row.audience,
    language: row.language,
    source_updated_at: typeof row.source_updated_at === "string" && row.source_updated_at.trim().length > 0 ? row.source_updated_at : null,
    curation_reviewed_at:
      typeof row.curation_reviewed_at === "string" && row.curation_reviewed_at.trim().length > 0
        ? row.curation_reviewed_at
        : null,
    source_kind: row.source_kind,
    source_path: row.source_path,
    recommended_for_lecture_prep: row.recommended_for_lecture_prep === 1,
    tags: parseTagsJson(row.tags_json),
    reading_mode: readingMode,
    read_url: readingMode === "in_app" ? `/cabinet/materials/${row.slug}` : null,
    open_url: `/api/cabinet/materials/${row.slug}/open`
  };
}

function isInAppReadableMaterial(material) {
  return material.material_type === "markdown" && material.source_kind === "repo_markdown";
}

function readCabinetMaterialContent(repoRootPath, material) {
  if (!isInAppReadableMaterial(material)) {
    return null;
  }

  const absolutePath = resolveMaterialPath(repoRootPath, material.source_path);
  if (!absolutePath || !existsSync(absolutePath)) {
    return null;
  }

  return {
    format: "markdown",
    markdown: stripMarkdownFrontmatter(readFileSync(absolutePath, "utf8")).trim()
  };
}

function stripMarkdownFrontmatter(text) {
  const normalizedText = typeof text === "string" ? text.replace(/^\uFEFF/, "") : "";
  if (!normalizedText.startsWith("---\n") && !normalizedText.startsWith("---\r\n")) {
    return normalizedText;
  }

  const closingMatch = normalizedText.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!closingMatch) {
    return normalizedText;
  }

  return normalizedText.slice(closingMatch[0].length);
}

function buildRelatedCabinetItems(materialRows, currentSlug) {
  const currentMaterial = materialRows.find((row) => row.slug === currentSlug);
  if (!currentMaterial) {
    return [];
  }

  const currentTags = new Set(parseTagsJson(currentMaterial.tags_json));
  return materialRows
    .filter((row) => row.slug !== currentSlug)
    .map((row) => {
      const tags = parseTagsJson(row.tags_json);
      const sharedTagCount = tags.filter((tag) => currentTags.has(tag)).length;
      const sameCategoryBoost = row.category === currentMaterial.category ? 2 : 0;
      const score = sharedTagCount + sameCategoryBoost;

      return {
        row,
        score
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.row.title.localeCompare(right.row.title, "ru"))
    .slice(0, 3)
    .map((entry) => {
      const item = toCabinetMaterialApiItem(entry.row);
      return {
        slug: item.slug,
        title: item.title,
        material_type: item.material_type,
        read_url: item.read_url,
        open_url: item.open_url
      };
    });
}

function resolveMaterialPath(repoRootPath, sourcePath) {
  const normalizedSourcePath = readString(sourcePath);
  if (!normalizedSourcePath) {
    return null;
  }

  const absolutePath = resolve(repoRootPath, normalizedSourcePath);
  const absoluteRepoRoot = resolve(repoRootPath);
  if (!absolutePath.startsWith(absoluteRepoRoot)) {
    return null;
  }

  return absolutePath;
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

function writeSseEvent(response, eventName, payload) {
  if (response.writableEnded) {
    return;
  }

  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}
