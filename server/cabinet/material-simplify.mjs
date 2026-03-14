import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../obs/logger.mjs";
import {
  getDefaultSimplifyPromptConfig,
  renderSimplifyUserPrompt
} from "./material-simplify-prompts.mjs";

const FEATURE_KIND = "simple_retell";
const SETTINGS_ROW_ID = "default";
const STALE_GENERATING_MULTIPLIER = 2;
const MIN_REQUEST_TIMEOUT_MS = 30_000;
const MIN_MAX_SOURCE_CHARS = 2_000;
const DEFAULT_OVERSIZED_BEHAVIOR = "block";
const inflightGenerations = new Map();

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNullableFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number") {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function readNullablePositiveInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return null;
  }

  return value;
}

function readOversizedBehavior(value) {
  return value === "allow_with_warning" ? "allow_with_warning" : value === "block" ? "block" : null;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalStringify(value) {
  return JSON.stringify(value);
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

function readMaterialContent(repoRoot, material) {
  const absolutePath = resolveMaterialPath(repoRoot, material.source_path);
  if (!absolutePath || !existsSync(absolutePath)) {
    return null;
  }

  return stripMarkdownFrontmatter(readFileSync(absolutePath, "utf8")).trim();
}

function buildPromptVersion(nowIso) {
  const compact = readString(nowIso)?.replace(/[-:TZ.]/g, "").slice(0, 14);
  return compact ? `v${compact}` : "v1";
}

function createSourceHash(material, markdown) {
  return sha256Hex(
    canonicalStringify({
      slug: material.slug,
      source_path: material.source_path,
      title: material.title,
      markdown
    })
  );
}

function createPromptHash(settings) {
  return sha256Hex(
    canonicalStringify({
      system_prompt: settings.system_prompt,
      user_prompt_template: settings.user_prompt_template
    })
  );
}

function createConfigHash(settings) {
  return sha256Hex(
    canonicalStringify({
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      max_output_tokens: settings.max_output_tokens
    })
  );
}

function truncateDiagnosticMessage(value, maxLength = 160) {
  const normalized = readString(value)?.replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function mapStoredStatus(row) {
  if (!row) {
    return null;
  }

  if (row.status === "ready" || row.status === "generating") {
    return row.status;
  }

  return "failed";
}

function mapRowToPayload(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: mapStoredStatus(row),
    content: readString(row.generated_markdown),
    provider: readString(row.provider),
    model: readString(row.model),
    generated_at: readString(row.generated_at),
    updated_at: readString(row.updated_at),
    error_code: readString(row.error_code),
    error_message: readString(row.error_message),
    source_updated_at_snapshot: readString(row.source_updated_at_snapshot)
  };
}

function makeState(base, overrides = {}) {
  return {
    feature_enabled: base.featureEnabled,
    key_configured: base.keyConfigured,
    provider: base.provider,
    model: base.model,
    prompt_version: base.promptVersion,
    status: "idle",
    disabled_reason: null,
    delivery_mode: null,
    content: null,
    generated_at: null,
    updated_at: null,
    error_code: null,
    error_message: null,
    source_updated_at_snapshot: base.sourceUpdatedAtSnapshot,
    can_generate: base.canGenerate,
    can_regenerate: false,
    ...overrides
  };
}

function isGeneratingStale(row, llmConfig, now = Date.now()) {
  if (!row || row.status !== "generating") {
    return false;
  }

  const updatedAt = Date.parse(row.updated_at);
  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  return now - updatedAt > llmConfig.defaultRequestTimeoutMs * STALE_GENERATING_MULTIPLIER;
}

function normalizeStoredError(error) {
  if (!error || typeof error !== "object") {
    return {
      error_code: "provider_error",
      error_message: "Не удалось получить пересказ."
    };
  }

  const code = readString(error.code) ?? "provider_error";
  if (code === "config_missing") {
    return {
      error_code: code,
      error_message: "DeepSeek API key не настроен."
    };
  }

  if (code === "invalid_key") {
    return {
      error_code: code,
      error_message: "DeepSeek API key отклонён провайдером."
    };
  }

  if (code === "timeout") {
    return {
      error_code: code,
      error_message: "Генерация заняла слишком много времени."
    };
  }

  if (code === "timeout_before_first_chunk") {
    return {
      error_code: code,
      error_message: "Модель слишком долго не начинала ответ. Попробуйте ещё раз."
    };
  }

  if (code === "timeout_mid_stream") {
    return {
      error_code: code,
      error_message: "Генерация прервалась по таймауту после начала ответа."
    };
  }

  if (code === "stream_open_failed") {
    return {
      error_code: code,
      error_message: "Не удалось открыть поток ответа от модели."
    };
  }

  if (code === "stream_interrupted") {
    return {
      error_code: code,
      error_message: "Поток ответа прервался до завершения."
    };
  }

  if (code === "upstream_http_error") {
    return {
      error_code: code,
      error_message: "Провайдер временно недоступен. Попробуйте позже."
    };
  }

  if (code === "rate_limit") {
    return {
      error_code: code,
      error_message: "Провайдер временно ограничил запросы. Попробуйте позже."
    };
  }

  if (code === "response_parse_error") {
    return {
      error_code: code,
      error_message: "Провайдер вернул неожиданный ответ. Попробуйте позже."
    };
  }

  if (code === "empty_response") {
    return {
      error_code: code,
      error_message: "Провайдер вернул пустой ответ. Попробуйте перегенерировать."
    };
  }

  if (code === "content_too_large") {
    return {
      error_code: code,
      error_message: readString(error.message) ?? "Документ слишком длинный для текущего MVP-режима."
    };
  }

  if (code === "output_truncated") {
    return {
      error_code: code,
      error_message: "Ответ провайдера был обрезан по лимиту длины. Увеличьте max output tokens и перегенерируйте."
    };
  }

  return {
    error_code: code,
    error_message: "Не удалось получить пересказ."
  };
}

function getEffectiveMaxOutputTokens(settings, llmConfig) {
  if (typeof settings.max_output_tokens === "number" && Number.isInteger(settings.max_output_tokens) && settings.max_output_tokens > 0) {
    return settings.max_output_tokens;
  }

  if (
    typeof llmConfig.defaultMaxOutputTokens === "number" &&
    Number.isInteger(llmConfig.defaultMaxOutputTokens) &&
    llmConfig.defaultMaxOutputTokens > 0
  ) {
    return llmConfig.defaultMaxOutputTokens;
  }

  return null;
}

function getEffectiveRequestTimeoutMs(settings, llmConfig) {
  const configured = typeof settings.request_timeout_ms === "number" && Number.isInteger(settings.request_timeout_ms)
    ? settings.request_timeout_ms
    : llmConfig.defaultRequestTimeoutMs;

  return Math.min(configured, llmConfig.hardMaxRequestTimeoutMs);
}

function getEffectiveMaxSourceChars(settings, llmConfig) {
  const configured = typeof settings.max_source_chars === "number" && Number.isInteger(settings.max_source_chars)
    ? settings.max_source_chars
    : llmConfig.defaultMaxSourceChars;

  return Math.min(configured, llmConfig.hardMaxSourceChars);
}

function assessSourceSize(markdownLength, settings, llmConfig) {
  const configuredLimit = getEffectiveMaxSourceChars(settings, llmConfig);
  const hardLimit = llmConfig.hardMaxSourceChars;

  if (markdownLength > hardLimit) {
    return {
      block: true,
      oversized: true,
      reason: "hard_guardrail",
      configured_limit: configuredLimit,
      hard_limit: hardLimit
    };
  }

  if (markdownLength > configuredLimit && settings.oversized_behavior === "block") {
    return {
      block: true,
      oversized: true,
      reason: "configured_limit",
      configured_limit: configuredLimit,
      hard_limit: hardLimit
    };
  }

  return {
    block: false,
    oversized: markdownLength > configuredLimit,
    reason: markdownLength > configuredLimit ? "allow_with_warning" : null,
    configured_limit: configuredLimit,
    hard_limit: hardLimit
  };
}

function getProviderDiagnostics(error) {
  const diagnostics = error?.diagnostics;
  if (!diagnostics || typeof diagnostics !== "object") {
    return {
      stage: null,
      provider_http_status: null,
      provider_message: null,
      abort_fired: false,
      provider_duration_ms: null,
      response_content_type: null,
      response_body_length: null
    };
  }

  return {
    stage: readString(diagnostics.stage),
    provider_http_status:
      typeof diagnostics.provider_http_status === "number" && Number.isInteger(diagnostics.provider_http_status)
        ? diagnostics.provider_http_status
        : null,
    finish_reason: readString(diagnostics.finish_reason),
    output_truncated: diagnostics.output_truncated === true,
    provider_message: truncateDiagnosticMessage(diagnostics.provider_message),
    abort_fired: diagnostics.abort_fired === true,
    provider_duration_ms:
      typeof diagnostics.duration_ms === "number" && Number.isFinite(diagnostics.duration_ms) ? diagnostics.duration_ms : null,
    time_to_first_chunk_ms:
      typeof diagnostics.time_to_first_chunk_ms === "number" && Number.isFinite(diagnostics.time_to_first_chunk_ms)
        ? diagnostics.time_to_first_chunk_ms
        : null,
    stream_duration_ms:
      typeof diagnostics.stream_duration_ms === "number" && Number.isFinite(diagnostics.stream_duration_ms)
        ? diagnostics.stream_duration_ms
        : null,
    first_chunk_at_ms:
      typeof diagnostics.first_chunk_at_ms === "number" && Number.isFinite(diagnostics.first_chunk_at_ms)
        ? diagnostics.first_chunk_at_ms
        : null,
    last_chunk_at_ms:
      typeof diagnostics.last_chunk_at_ms === "number" && Number.isFinite(diagnostics.last_chunk_at_ms)
        ? diagnostics.last_chunk_at_ms
        : null,
    streamed_chars:
      typeof diagnostics.streamed_chars === "number" && Number.isFinite(diagnostics.streamed_chars)
        ? diagnostics.streamed_chars
        : null,
    received_done: diagnostics.received_done === true,
    response_content_type: readString(diagnostics.response_content_type),
    response_body_length:
      typeof diagnostics.response_body_length === "number" && Number.isFinite(diagnostics.response_body_length)
        ? diagnostics.response_body_length
        : null
  };
}

function readLatestFailedSimplification(database) {
  return database
    .prepare(
      `SELECT
        materials.slug AS material_slug,
        material_simplifications.error_code AS error_code,
        material_simplifications.updated_at AS updated_at
       FROM material_simplifications
       JOIN materials ON materials.id = material_simplifications.material_id
       WHERE material_simplifications.feature_kind = ?
         AND material_simplifications.status = 'failed'
         AND material_simplifications.error_code IS NOT NULL
       ORDER BY datetime(material_simplifications.updated_at) DESC
       LIMIT 1`
    )
    .get(FEATURE_KIND);
}

function mapRecentFailureRow(row) {
  if (!row) {
    return null;
  }

  return {
    material_slug: readString(row.material_slug),
    error_code: readString(row.error_code),
    updated_at: readString(row.updated_at)
  };
}

function upsertSimplificationRow(database, row) {
  database
    .prepare(
      `INSERT INTO material_simplifications (
        id,
        material_id,
        feature_kind,
        provider,
        model,
        source_hash,
        source_updated_at_snapshot,
        prompt_hash,
        config_hash,
        status,
        generated_markdown,
        error_code,
        error_message,
        created_at,
        updated_at,
        generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(material_id, feature_kind, provider, model, source_hash, prompt_hash, config_hash)
      DO UPDATE SET
        status = excluded.status,
        generated_markdown = excluded.generated_markdown,
        error_code = excluded.error_code,
        error_message = excluded.error_message,
        source_updated_at_snapshot = excluded.source_updated_at_snapshot,
        updated_at = excluded.updated_at,
        generated_at = excluded.generated_at`
    )
    .run(
      row.id,
      row.material_id,
      row.feature_kind,
      row.provider,
      row.model,
      row.source_hash,
      row.source_updated_at_snapshot,
      row.prompt_hash,
      row.config_hash,
      row.status,
      row.generated_markdown,
      row.error_code,
      row.error_message,
      row.created_at,
      row.updated_at,
      row.generated_at
    );
}

function readCurrentRow(database, identity) {
  return database
    .prepare(
      `SELECT
        id,
        material_id,
        provider,
        model,
        source_updated_at_snapshot,
        status,
        generated_markdown,
        error_code,
        error_message,
        created_at,
        updated_at,
        generated_at
       FROM material_simplifications
       WHERE material_id = ?
         AND feature_kind = ?
         AND provider = ?
         AND model = ?
         AND source_hash = ?
         AND prompt_hash = ?
         AND config_hash = ?
       LIMIT 1`
    )
    .get(
      identity.materialId,
      FEATURE_KIND,
      identity.provider,
      identity.model,
      identity.sourceHash,
      identity.promptHash,
      identity.configHash
    );
}

function readLatestRowForMaterial(database, materialId) {
  return database
    .prepare(
      `SELECT
        id,
        material_id,
        provider,
        model,
        source_updated_at_snapshot,
        status,
        generated_markdown,
        error_code,
        error_message,
        created_at,
        updated_at,
        generated_at
       FROM material_simplifications
       WHERE material_id = ?
         AND feature_kind = ?
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`
    )
    .get(materialId, FEATURE_KIND);
}

function readSettingsRow(database, llmConfig) {
  const defaultPromptConfig = getDefaultSimplifyPromptConfig();
  const row = database
    .prepare(
      `SELECT
        llm_simplify_settings.provider,
        llm_simplify_settings.feature_enabled,
        llm_simplify_settings.model,
        llm_simplify_settings.system_prompt,
        llm_simplify_settings.user_prompt_template,
        llm_simplify_settings.prompt_version,
        llm_simplify_settings.temperature,
        llm_simplify_settings.max_output_tokens,
        llm_simplify_settings.request_timeout_ms,
        llm_simplify_settings.max_source_chars,
        llm_simplify_settings.oversized_behavior,
        llm_simplify_settings.updated_at,
        users.username AS updated_by_username
       FROM llm_simplify_settings
       LEFT JOIN users ON users.id = llm_simplify_settings.updated_by_user_id
       WHERE llm_simplify_settings.id = ?
       LIMIT 1`
    )
    .get(SETTINGS_ROW_ID);

  if (row) {
    return row;
  }

  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO llm_simplify_settings (
        id,
        provider,
        feature_enabled,
        model,
        system_prompt,
        user_prompt_template,
        prompt_version,
        temperature,
        max_output_tokens,
        request_timeout_ms,
        max_source_chars,
        oversized_behavior,
        updated_at,
        updated_by_user_id
      ) VALUES (?, 'deepseek', 1, 'deepseek-chat', ?, ?, 'v1', NULL, NULL, ?, ?, ?, ?, NULL)`
    )
    .run(
      SETTINGS_ROW_ID,
      defaultPromptConfig.system_prompt,
      defaultPromptConfig.user_prompt_template,
      llmConfig.defaultRequestTimeoutMs,
      llmConfig.defaultMaxSourceChars,
      DEFAULT_OVERSIZED_BEHAVIOR,
      now
    );

  return database
    .prepare(
      `SELECT
        provider,
        feature_enabled,
        model,
        system_prompt,
        user_prompt_template,
        prompt_version,
        temperature,
        max_output_tokens,
        request_timeout_ms,
        max_source_chars,
        oversized_behavior,
        updated_at,
        NULL AS updated_by_username
       FROM llm_simplify_settings
       WHERE id = ?
       LIMIT 1`
    )
    .get(SETTINGS_ROW_ID);
}

function mapSettingsRow(row, llmConfig) {
  const defaultPromptConfig = getDefaultSimplifyPromptConfig();
  return {
    provider: readString(row.provider) ?? "deepseek",
    feature_enabled: row.feature_enabled === 1,
    model: readString(row.model) ?? "deepseek-chat",
    system_prompt: readString(row.system_prompt) ?? defaultPromptConfig.system_prompt,
    user_prompt_template: readString(row.user_prompt_template) ?? defaultPromptConfig.user_prompt_template,
    prompt_version: readString(row.prompt_version) ?? "v1",
    temperature: typeof row.temperature === "number" && Number.isFinite(row.temperature) ? row.temperature : null,
    max_output_tokens:
      typeof row.max_output_tokens === "number" && Number.isInteger(row.max_output_tokens) && row.max_output_tokens > 0
        ? row.max_output_tokens
        : null,
    request_timeout_ms:
      typeof row.request_timeout_ms === "number" && Number.isInteger(row.request_timeout_ms) && row.request_timeout_ms > 0
        ? row.request_timeout_ms
        : llmConfig.defaultRequestTimeoutMs,
    max_source_chars:
      typeof row.max_source_chars === "number" && Number.isInteger(row.max_source_chars) && row.max_source_chars > 0
        ? row.max_source_chars
        : llmConfig.defaultMaxSourceChars,
    oversized_behavior: readOversizedBehavior(row.oversized_behavior) ?? DEFAULT_OVERSIZED_BEHAVIOR,
    updated_at: readString(row.updated_at) ?? new Date().toISOString(),
    updated_by_username: readString(row.updated_by_username)
  };
}

function readMaterialRow(database, slug) {
  return database
    .prepare(
      `SELECT
        id,
        slug,
        title,
        source_path,
        source_updated_at,
        material_type,
        source_kind
       FROM materials
       WHERE slug = ?
         AND is_active = 1
       LIMIT 1`
    )
    .get(slug);
}

function createIdentity(context) {
  return {
    key: [
      context.material.id,
      FEATURE_KIND,
      context.settings.provider,
      context.settings.model,
      context.sourceHash,
      context.promptHash,
      context.configHash
    ].join("::"),
    materialId: context.material.id,
    provider: context.settings.provider,
    model: context.settings.model,
    sourceHash: context.sourceHash,
    promptHash: context.promptHash,
    configHash: context.configHash
  };
}

function createUserPrompt(settings, material, markdown) {
  return renderSimplifyUserPrompt(settings.user_prompt_template, material, markdown);
}

function mapContextToBase(context) {
  return {
    featureEnabled: context.settings.feature_enabled,
    keyConfigured: context.keyConfigured,
    provider: context.settings.provider,
    model: context.settings.model,
    promptVersion: context.settings.prompt_version,
    canGenerate: context.settings.feature_enabled && context.keyConfigured,
    sourceUpdatedAtSnapshot: context.material.source_updated_at ?? null
  };
}

function hasCachedFallbackState(state) {
  return state?.status === "ready" || state?.status === "stale";
}

function buildCacheIntent(force, currentState) {
  if (force) {
    return "regenerate";
  }

  if (currentState?.status === "stale") {
    return "stale_refresh";
  }

  return "cache_miss";
}

function createStoredRowSeed(context, currentRow, nowIso) {
  return {
    id: currentRow?.id ?? randomUUID(),
    material_id: context.material.id,
    feature_kind: FEATURE_KIND,
    provider: context.settings.provider,
    model: context.settings.model,
    source_hash: context.sourceHash,
    source_updated_at_snapshot: context.material.source_updated_at ?? null,
    prompt_hash: context.promptHash,
    config_hash: context.configHash,
    created_at: currentRow?.created_at ?? nowIso
  };
}

function buildTooLargeError(context) {
  return normalizeStoredError({
    code: "content_too_large",
    message:
      context.sourceSizeAssessment.reason === "hard_guardrail"
        ? `Документ превышает жёсткий single-pass guardrail (${context.sourceSizeAssessment.hard_limit} символов).`
        : `Документ превышает настроенный single-pass лимит (${context.sourceSizeAssessment.configured_limit} символов).`
  });
}

async function emitStreamEvent(onEvent, type, data) {
  if (typeof onEvent !== "function") {
    return;
  }

  await onEvent({
    type,
    data
  });
}

function resolveState(context, currentRow, latestRow) {
  const base = mapContextToBase(context);

  if (!context.settings.feature_enabled) {
    return makeState(base, {
      status: "disabled",
      disabled_reason: "feature_disabled",
      can_generate: false
    });
  }

  if (!context.keyConfigured) {
    return makeState(base, {
      status: "disabled",
      disabled_reason: "key_missing",
      can_generate: false
    });
  }

  if (currentRow && currentRow.status === "generating" && !isGeneratingStale(currentRow, context.llmConfig)) {
    return makeState(base, {
      ...mapRowToPayload(currentRow),
      status: "generating",
      can_generate: false
    });
  }

  if (currentRow && currentRow.status === "ready") {
    return makeState(base, {
      ...mapRowToPayload(currentRow),
      status: "ready",
      delivery_mode: "cache",
      can_regenerate: true
    });
  }

  if (currentRow && currentRow.status === "failed") {
    return makeState(base, {
      ...mapRowToPayload(currentRow),
      status: "failed",
      can_regenerate: true
    });
  }

  if (latestRow && latestRow.status === "ready" && readString(latestRow.generated_markdown)) {
    return makeState(base, {
      ...mapRowToPayload(latestRow),
      status: "stale",
      delivery_mode: "cache",
      can_regenerate: true
    });
  }

  return makeState(base, {
    status: "idle"
  });
}

function buildSettingsPayload(settings, keyConfigured) {
  return {
    key_configured: keyConfigured,
    settings
  };
}

function buildEffectiveConfig(settings, keyConfigured, llmConfig) {
  return {
    provider: settings.provider,
    model: settings.model,
    key_configured: keyConfigured,
    request_timeout_ms: getEffectiveRequestTimeoutMs(settings, llmConfig),
    max_output_tokens: getEffectiveMaxOutputTokens(settings, llmConfig),
    max_source_chars: getEffectiveMaxSourceChars(settings, llmConfig),
    oversized_behavior: settings.oversized_behavior,
    hard_max_request_timeout_ms: llmConfig.hardMaxRequestTimeoutMs,
    hard_max_source_chars: llmConfig.hardMaxSourceChars
  };
}

function buildSettingsResult(database, settings, keyConfigured, llmConfig) {
  return {
    ok: true,
    key_configured: keyConfigured,
    settings,
    effective_config: buildEffectiveConfig(settings, keyConfigured, llmConfig),
    recent_failure: mapRecentFailureRow(readLatestFailedSimplification(database))
  };
}

export function createMaterialSimplifyService({ database, repoRoot, llmConfig, client }) {
  function loadContext(slug) {
    const material = readMaterialRow(database, slug);
    if (!material) {
      return {
        ok: false,
        error: {
          status: 404,
          body: {
            code: "invalid_input",
            message: "Material not found."
          }
        }
      };
    }

    if (material.material_type !== "markdown" || material.source_kind !== "repo_markdown") {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "Simplify is available only for markdown materials."
          }
        }
      };
    }

    const markdown = readMaterialContent(repoRoot, material);
    if (!markdown) {
      return {
        ok: false,
        error: {
          status: 404,
          body: {
            code: "invalid_input",
            message: "Material source is unavailable."
          }
        }
      };
    }

    const settings = mapSettingsRow(readSettingsRow(database, llmConfig), llmConfig);
    const sourceSizeAssessment = assessSourceSize(markdown.length, settings, llmConfig);
    return {
      ok: true,
      context: {
        material,
        markdown,
        settings,
        llmConfig,
        keyConfigured: !!llmConfig.apiKey,
        effectiveRequestTimeoutMs: getEffectiveRequestTimeoutMs(settings, llmConfig),
        effectiveMaxOutputTokens: getEffectiveMaxOutputTokens(settings, llmConfig),
        effectiveMaxSourceChars: getEffectiveMaxSourceChars(settings, llmConfig),
        sourceSizeAssessment,
        sourceHash: createSourceHash(material, markdown),
        promptHash: createPromptHash(settings),
        configHash: createConfigHash({
          ...settings,
          max_output_tokens: getEffectiveMaxOutputTokens(settings, llmConfig)
        })
      }
    };
  }

  function getSimplifyState(slug) {
    const loaded = loadContext(slug);
    if (!loaded.ok) {
      return loaded;
    }

    const context = loaded.context;
    const identity = createIdentity(context);
    const currentRow = readCurrentRow(database, identity);
    const latestRow = readLatestRowForMaterial(database, context.material.id);
    return {
      ok: true,
      state: resolveState(context, currentRow, latestRow)
    };
  }

  async function generate(slug, { force = false } = {}) {
    const loaded = loadContext(slug);
    if (!loaded.ok) {
      return loaded;
    }

    const context = loaded.context;
    const identity = createIdentity(context);
    const currentRow = readCurrentRow(database, identity);
    const latestRow = readLatestRowForMaterial(database, context.material.id);
    const currentState = resolveState(context, currentRow, latestRow);

    if (!force && currentState.status === "ready") {
      return {
        ok: true,
        state: currentState
      };
    }

    if (currentState.status === "disabled") {
      return {
        ok: true,
        state: currentState
      };
    }

    const existingInflight = inflightGenerations.get(identity.key);
    if (existingInflight) {
      return existingInflight;
    }

    const now = new Date().toISOString();
    if (context.sourceSizeAssessment.block) {
      const storedError = normalizeStoredError({
        code: "content_too_large",
        message:
          context.sourceSizeAssessment.reason === "hard_guardrail"
            ? `Документ превышает жёсткий single-pass guardrail (${context.sourceSizeAssessment.hard_limit} символов).`
            : `Документ превышает настроенный single-pass лимит (${context.sourceSizeAssessment.configured_limit} символов).`
      });
      upsertSimplificationRow(database, {
        id: currentRow?.id ?? randomUUID(),
        material_id: context.material.id,
        feature_kind: FEATURE_KIND,
        provider: context.settings.provider,
        model: context.settings.model,
        source_hash: context.sourceHash,
        source_updated_at_snapshot: context.material.source_updated_at ?? null,
        prompt_hash: context.promptHash,
        config_hash: context.configHash,
        status: "failed",
        generated_markdown: null,
        error_code: storedError.error_code,
        error_message: storedError.error_message,
        created_at: currentRow?.created_at ?? now,
        updated_at: now,
        generated_at: null
      });

      return {
        ok: true,
        state: makeState(mapContextToBase(context), {
          status: "failed",
          error_code: storedError.error_code,
          error_message: storedError.error_message,
          updated_at: now,
          can_regenerate: true
        })
      };
    }

    const generationPromise = (async () => {
      upsertSimplificationRow(database, {
        id: currentRow?.id ?? randomUUID(),
        material_id: context.material.id,
        feature_kind: FEATURE_KIND,
        provider: context.settings.provider,
        model: context.settings.model,
        source_hash: context.sourceHash,
        source_updated_at_snapshot: context.material.source_updated_at ?? null,
        prompt_hash: context.promptHash,
        config_hash: context.configHash,
        status: "generating",
        generated_markdown: null,
        error_code: null,
        error_message: null,
        created_at: currentRow?.created_at ?? now,
        updated_at: now,
        generated_at: null
      });

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, context.effectiveRequestTimeoutMs);

      try {
        logger.info({
          event: "cabinet_material_simplify_provider_call_started",
          domain: "cabinet",
          module: "cabinet/material-simplify-service",
          payload: {
            slug: context.material.slug,
            material_id: context.material.id,
            provider: context.settings.provider,
            model: context.settings.model,
            timeout_ms: context.effectiveRequestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
            max_source_chars: context.effectiveMaxSourceChars,
            oversized_source: context.sourceSizeAssessment.oversized,
            source_chars: context.markdown.length,
            cache_intent: force ? "regenerate" : "cache_miss",
            abort_fired: false
          }
        });

        const completion = await client.createChatCompletion({
          model: context.settings.model,
          systemPrompt: context.settings.system_prompt,
          userPrompt: createUserPrompt(context.settings, context.material, context.markdown),
          temperature: context.settings.temperature,
          maxOutputTokens: context.effectiveMaxOutputTokens,
          signal: abortController.signal
        });

        const completedAt = new Date().toISOString();
        const content = completion.content.trim();
        const providerDiagnostics = getProviderDiagnostics(completion);
        upsertSimplificationRow(database, {
          id: currentRow?.id ?? randomUUID(),
          material_id: context.material.id,
          feature_kind: FEATURE_KIND,
          provider: context.settings.provider,
          model: context.settings.model,
          source_hash: context.sourceHash,
          source_updated_at_snapshot: context.material.source_updated_at ?? null,
          prompt_hash: context.promptHash,
          config_hash: context.configHash,
          status: "ready",
          generated_markdown: content,
          error_code: providerDiagnostics.output_truncated ? "output_truncated" : null,
          error_message: providerDiagnostics.output_truncated
            ? "Ответ провайдера был обрезан по лимиту длины. Увеличьте max output tokens и перегенерируйте."
            : null,
          created_at: currentRow?.created_at ?? now,
          updated_at: completedAt,
          generated_at: completedAt
        });

        logger.info({
          event: "cabinet_material_simplify_provider_call_completed",
          domain: "cabinet",
          module: "cabinet/material-simplify-service",
          payload: {
            slug: context.material.slug,
            material_id: context.material.id,
            provider: context.settings.provider,
            model: context.settings.model,
            timeout_ms: context.effectiveRequestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
            max_source_chars: context.effectiveMaxSourceChars,
            oversized_source: context.sourceSizeAssessment.oversized,
            source_chars: context.markdown.length,
            cache_intent: force ? "regenerate" : "cache_miss",
            provider_http_status: providerDiagnostics.provider_http_status,
            provider_duration_ms: providerDiagnostics.provider_duration_ms,
            abort_fired: providerDiagnostics.abort_fired,
            finish_reason: providerDiagnostics.finish_reason,
            output_truncated: providerDiagnostics.output_truncated
          }
        });

        return {
          ok: true,
          state: makeState(mapContextToBase(context), {
            status: "ready",
            delivery_mode: "generated",
            content,
            generated_at: completedAt,
            updated_at: completedAt,
            error_code: providerDiagnostics.output_truncated ? "output_truncated" : null,
            error_message: providerDiagnostics.output_truncated
              ? "Ответ провайдера был обрезан по лимиту длины. Увеличьте max output tokens и перегенерируйте."
              : null,
            can_regenerate: true
          })
        };
      } catch (error) {
        const failedAt = new Date().toISOString();
        const storedError = normalizeStoredError(error);
        const providerDiagnostics = getProviderDiagnostics(error);
        upsertSimplificationRow(database, {
          id: currentRow?.id ?? randomUUID(),
          material_id: context.material.id,
          feature_kind: FEATURE_KIND,
          provider: context.settings.provider,
          model: context.settings.model,
          source_hash: context.sourceHash,
          source_updated_at_snapshot: context.material.source_updated_at ?? null,
          prompt_hash: context.promptHash,
          config_hash: context.configHash,
          status: "failed",
          generated_markdown: null,
          error_code: storedError.error_code,
          error_message: storedError.error_message,
          created_at: currentRow?.created_at ?? now,
          updated_at: failedAt,
          generated_at: null
        });

        logger.warn({
          event: "cabinet_material_simplify_provider_call_failed",
          domain: "cabinet",
          module: "cabinet/material-simplify-service",
          payload: {
            slug: context.material.slug,
            material_id: context.material.id,
            provider: context.settings.provider,
            model: context.settings.model,
            timeout_ms: context.effectiveRequestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
            max_source_chars: context.effectiveMaxSourceChars,
            oversized_source: context.sourceSizeAssessment.oversized,
            source_chars: context.markdown.length,
            cache_intent: force ? "regenerate" : "cache_miss",
            error_code: storedError.error_code,
            error_stage: providerDiagnostics.stage,
            provider_http_status: providerDiagnostics.provider_http_status,
            provider_message: providerDiagnostics.provider_message,
            provider_duration_ms: providerDiagnostics.provider_duration_ms,
            response_content_type: providerDiagnostics.response_content_type,
            response_body_length: providerDiagnostics.response_body_length,
            abort_fired: providerDiagnostics.abort_fired
          }
        });

        return {
          ok: true,
          state: makeState(mapContextToBase(context), {
            status: "failed",
            error_code: storedError.error_code,
            error_message: storedError.error_message,
            updated_at: failedAt,
            can_regenerate: true
          })
        };
      } finally {
        clearTimeout(timeoutId);
      }
    })()
      .finally(() => {
        inflightGenerations.delete(identity.key);
      });

    inflightGenerations.set(identity.key, generationPromise);
    return generationPromise;
  }

  async function streamGenerate(slug, { force = false, onEvent } = {}) {
    const loaded = loadContext(slug);
    if (!loaded.ok) {
      return loaded;
    }

    const context = loaded.context;
    const identity = createIdentity(context);
    const currentRow = readCurrentRow(database, identity);
    const latestRow = readLatestRowForMaterial(database, context.material.id);
    const currentState = resolveState(context, currentRow, latestRow);
    const hasCachedFallback = hasCachedFallbackState(currentState);
    const cacheIntent = buildCacheIntent(force, currentState);

    await emitStreamEvent(onEvent, "open", {
      slug: context.material.slug,
      force
    });
    await emitStreamEvent(onEvent, "meta", {
      provider: context.settings.provider,
      model: context.settings.model,
      prompt_version: context.settings.prompt_version,
      timeout_ms: context.effectiveRequestTimeoutMs,
      max_output_tokens: context.effectiveMaxOutputTokens,
      max_source_chars: context.effectiveMaxSourceChars,
      source_chars: context.markdown.length,
      cache_intent: cacheIntent,
      has_cached_fallback: hasCachedFallback
    });

    if (!force && currentState.status === "ready") {
      await emitStreamEvent(onEvent, "done", {
        result: "cache_ready",
        state: currentState
      });
      return {
        ok: true,
        state: currentState
      };
    }

    if (currentState.status === "disabled") {
      await emitStreamEvent(onEvent, "error", {
        error_code: currentState.disabled_reason === "key_missing" ? "config_missing" : "feature_disabled",
        error_message: currentState.disabled_reason === "key_missing"
          ? "DeepSeek API key не настроен."
          : "Reader-пересказ сейчас отключён.",
        state: currentState,
        cache_preserved: hasCachedFallback
      });
      return {
        ok: true,
        state: currentState
      };
    }

    if (context.sourceSizeAssessment.oversized && context.sourceSizeAssessment.reason === "allow_with_warning") {
      await emitStreamEvent(onEvent, "warning", {
        code: "oversized_source",
        message: "Документ превышает preferred single-pass limit и может отвечать нестабильно."
      });
    }

    if (context.sourceSizeAssessment.block) {
      const now = new Date().toISOString();
      const storedError = buildTooLargeError(context);
      const failedState = makeState(mapContextToBase(context), {
        status: "failed",
        error_code: storedError.error_code,
        error_message: storedError.error_message,
        updated_at: now,
        can_regenerate: true
      });

      if (!hasCachedFallback) {
        upsertSimplificationRow(database, {
          ...createStoredRowSeed(context, currentRow, now),
          status: "failed",
          generated_markdown: null,
          error_code: storedError.error_code,
          error_message: storedError.error_message,
          updated_at: now,
          generated_at: null
        });
      }

      await emitStreamEvent(onEvent, "error", {
        error_code: storedError.error_code,
        error_message: storedError.error_message,
        state: hasCachedFallback ? currentState : failedState,
        cache_preserved: hasCachedFallback
      });
      return {
        ok: true,
        state: hasCachedFallback ? currentState : failedState
      };
    }

    const existingInflight = inflightGenerations.get(identity.key);
    if (existingInflight) {
      const result = await existingInflight;
      if (result.ok && result.state.status === "ready") {
        await emitStreamEvent(onEvent, "done", {
          result: "normal_success",
          state: result.state
        });
      } else if (result.ok) {
        await emitStreamEvent(onEvent, "error", {
          error_code: result.state.error_code ?? "stream_open_failed",
          error_message: result.state.error_message ?? "Поток уже выполняется в другом запросе.",
          state: result.state,
          cache_preserved: hasCachedFallback
        });
      }
      return result;
    }

    if (currentState.status === "generating") {
      await emitStreamEvent(onEvent, "error", {
        error_code: "stream_open_failed",
        error_message: "Генерация уже выполняется. Дождитесь завершения текущего запроса.",
        state: currentState,
        cache_preserved: hasCachedFallback
      });
      return {
        ok: true,
        state: currentState
      };
    }

    const now = new Date().toISOString();
    const persistInterimState = !hasCachedFallback;
    if (persistInterimState) {
      upsertSimplificationRow(database, {
        ...createStoredRowSeed(context, currentRow, now),
        status: "generating",
        generated_markdown: null,
        error_code: null,
        error_message: null,
        updated_at: now,
        generated_at: null
      });
    }

    const generationPromise = (async () => {
      const startedAt = Date.now();
      let firstChunkLogged = false;
      let observedStreamedChars = 0;

      try {
        logger.info({
          event: "cabinet_material_simplify_stream_started",
          domain: "cabinet",
          module: "cabinet/material-simplify-service",
          payload: {
            slug: context.material.slug,
            material_id: context.material.id,
            provider: context.settings.provider,
            model: context.settings.model,
            mode: "stream",
            timeout_ms: context.effectiveRequestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
            max_source_chars: context.effectiveMaxSourceChars,
            oversized_source: context.sourceSizeAssessment.oversized,
            source_chars: context.markdown.length,
            cache_intent: cacheIntent,
            cache_preserved: hasCachedFallback
          }
        });

        const completion = await client.streamChatCompletion({
          model: context.settings.model,
          systemPrompt: context.settings.system_prompt,
          userPrompt: createUserPrompt(context.settings, context.material, context.markdown),
          temperature: context.settings.temperature,
          maxOutputTokens: context.effectiveMaxOutputTokens,
          signal: AbortSignal.timeout(context.effectiveRequestTimeoutMs),
          onDelta: async (delta) => {
            observedStreamedChars += delta.length;
            if (!firstChunkLogged) {
              firstChunkLogged = true;
              logger.info({
                event: "cabinet_material_simplify_first_chunk_detected",
                domain: "cabinet",
                module: "cabinet/material-simplify-service",
                payload: {
                  slug: context.material.slug,
                  material_id: context.material.id,
                  provider: context.settings.provider,
                  model: context.settings.model,
                  mode: "stream",
                  cache_intent: cacheIntent,
                  time_to_first_chunk_ms: Date.now() - startedAt
                }
              });
            }

            await emitStreamEvent(onEvent, "delta", {
              text: delta,
              streamed_chars: observedStreamedChars
            });
          }
        });

        const completedAt = new Date().toISOString();
        const providerDiagnostics = getProviderDiagnostics(completion);
        const content = completion.content.trim();
        if (providerDiagnostics.output_truncated) {
          const storedError = normalizeStoredError({ code: "output_truncated" });
          const failedState = makeState(mapContextToBase(context), {
            status: "failed",
            error_code: storedError.error_code,
            error_message: storedError.error_message,
            updated_at: completedAt,
            can_regenerate: true
          });

          if (persistInterimState) {
            upsertSimplificationRow(database, {
              ...createStoredRowSeed(context, currentRow, now),
              status: "failed",
              generated_markdown: null,
              error_code: storedError.error_code,
              error_message: storedError.error_message,
              updated_at: completedAt,
              generated_at: null
            });
          }

          logger.warn({
            event: "cabinet_material_simplify_stream_failed",
            domain: "cabinet",
            module: "cabinet/material-simplify-service",
            payload: {
              slug: context.material.slug,
              material_id: context.material.id,
              provider: context.settings.provider,
              model: context.settings.model,
              mode: "stream",
              cache_intent: cacheIntent,
              cache_preserved: hasCachedFallback,
              cache_write_skipped: true,
              error_code: storedError.error_code,
              finish_reason: providerDiagnostics.finish_reason,
              received_done: providerDiagnostics.received_done,
              time_to_first_chunk_ms: providerDiagnostics.time_to_first_chunk_ms,
              stream_duration_ms: providerDiagnostics.stream_duration_ms,
              first_chunk_at_ms: providerDiagnostics.first_chunk_at_ms,
              last_chunk_at_ms: providerDiagnostics.last_chunk_at_ms,
              streamed_chars: providerDiagnostics.streamed_chars,
              provider_http_status: providerDiagnostics.provider_http_status
            }
          });

          await emitStreamEvent(onEvent, "warning", {
            code: storedError.error_code,
            message: storedError.error_message
          });
          await emitStreamEvent(onEvent, "error", {
            error_code: storedError.error_code,
            error_message: storedError.error_message,
            state: hasCachedFallback ? currentState : failedState,
            cache_preserved: hasCachedFallback
          });
          return {
            ok: true,
            state: hasCachedFallback ? currentState : failedState
          };
        }

        upsertSimplificationRow(database, {
          ...createStoredRowSeed(context, currentRow, now),
          status: "ready",
          generated_markdown: content,
          error_code: null,
          error_message: null,
          updated_at: completedAt,
          generated_at: completedAt
        });

        const readyState = makeState(mapContextToBase(context), {
          status: "ready",
          delivery_mode: "generated",
          content,
          generated_at: completedAt,
          updated_at: completedAt,
          can_regenerate: true
        });

        logger.info({
          event: "cabinet_material_simplify_stream_completed",
          domain: "cabinet",
          module: "cabinet/material-simplify-service",
          payload: {
            slug: context.material.slug,
            material_id: context.material.id,
            provider: context.settings.provider,
            model: context.settings.model,
            mode: "stream",
            cache_intent: cacheIntent,
            cache_preserved: hasCachedFallback,
            cache_write_success: true,
            finish_reason: providerDiagnostics.finish_reason,
            received_done: providerDiagnostics.received_done,
            time_to_first_chunk_ms: providerDiagnostics.time_to_first_chunk_ms,
            stream_duration_ms: providerDiagnostics.stream_duration_ms,
            first_chunk_at_ms: providerDiagnostics.first_chunk_at_ms,
            last_chunk_at_ms: providerDiagnostics.last_chunk_at_ms,
            streamed_chars: providerDiagnostics.streamed_chars,
            provider_http_status: providerDiagnostics.provider_http_status
          }
        });

        await emitStreamEvent(onEvent, "done", {
          result: "normal_success",
          state: readyState
        });
        return {
          ok: true,
          state: readyState
        };
      } catch (error) {
        const failedAt = new Date().toISOString();
        const storedError = normalizeStoredError(error);
        const providerDiagnostics = getProviderDiagnostics(error);
        const failedState = makeState(mapContextToBase(context), {
          status: "failed",
          error_code: storedError.error_code,
          error_message: storedError.error_message,
          updated_at: failedAt,
          can_regenerate: true
        });

        if (persistInterimState) {
          upsertSimplificationRow(database, {
            ...createStoredRowSeed(context, currentRow, now),
            status: "failed",
            generated_markdown: null,
            error_code: storedError.error_code,
            error_message: storedError.error_message,
            updated_at: failedAt,
            generated_at: null
          });
        }

        logger.warn({
          event: "cabinet_material_simplify_stream_failed",
          domain: "cabinet",
          module: "cabinet/material-simplify-service",
          payload: {
            slug: context.material.slug,
            material_id: context.material.id,
            provider: context.settings.provider,
            model: context.settings.model,
            mode: "stream",
            cache_intent: cacheIntent,
            cache_preserved: hasCachedFallback,
            cache_write_skipped: true,
            error_code: storedError.error_code,
            error_stage: providerDiagnostics.stage,
            provider_http_status: providerDiagnostics.provider_http_status,
            provider_message: providerDiagnostics.provider_message,
            provider_duration_ms: providerDiagnostics.provider_duration_ms,
            response_content_type: providerDiagnostics.response_content_type,
            response_body_length: providerDiagnostics.response_body_length,
            abort_fired: providerDiagnostics.abort_fired,
            finish_reason: providerDiagnostics.finish_reason,
            received_done: providerDiagnostics.received_done,
            time_to_first_chunk_ms: providerDiagnostics.time_to_first_chunk_ms,
            stream_duration_ms: providerDiagnostics.stream_duration_ms,
            first_chunk_at_ms: providerDiagnostics.first_chunk_at_ms,
            last_chunk_at_ms: providerDiagnostics.last_chunk_at_ms,
            streamed_chars: providerDiagnostics.streamed_chars
          }
        });

        await emitStreamEvent(onEvent, "error", {
          error_code: storedError.error_code,
          error_message: storedError.error_message,
          state: hasCachedFallback ? currentState : failedState,
          cache_preserved: hasCachedFallback
        });
        return {
          ok: true,
          state: hasCachedFallback ? currentState : failedState
        };
      }
    })().finally(() => {
      inflightGenerations.delete(identity.key);
    });

    inflightGenerations.set(identity.key, generationPromise);
    return generationPromise;
  }

  function getSettings() {
    const settings = mapSettingsRow(readSettingsRow(database, llmConfig), llmConfig);
    return buildSettingsResult(database, settings, !!llmConfig.apiKey, llmConfig);
  }

  function updateSettings(input, actorUserId) {
    const featureEnabled = typeof input.feature_enabled === "boolean" ? input.feature_enabled : null;
    const model = readString(input.model);
    const systemPrompt = readString(input.system_prompt);
    const userPromptTemplate = readString(input.user_prompt_template);
    const temperature = readNullableFiniteNumber(input.temperature);
    const maxOutputTokens = readNullablePositiveInt(input.max_output_tokens);
    const requestTimeoutMs = readNullablePositiveInt(input.request_timeout_ms);
    const maxSourceChars = readNullablePositiveInt(input.max_source_chars);
    const oversizedBehavior = readOversizedBehavior(input.oversized_behavior);
    if (featureEnabled === null || !model || !systemPrompt || !userPromptTemplate || !requestTimeoutMs || !maxSourceChars || !oversizedBehavior) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message:
              "feature_enabled, model, system_prompt, user_prompt_template, request_timeout_ms, max_source_chars, and oversized_behavior are required."
          }
        }
      };
    }

    if (!userPromptTemplate.includes("{{source_markdown}}")) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "user_prompt_template must include {{source_markdown}}."
          }
        }
      };
    }

    if (requestTimeoutMs < MIN_REQUEST_TIMEOUT_MS || requestTimeoutMs > llmConfig.hardMaxRequestTimeoutMs) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: `request_timeout_ms must stay between ${MIN_REQUEST_TIMEOUT_MS} and ${llmConfig.hardMaxRequestTimeoutMs}.`
          }
        }
      };
    }

    if (maxSourceChars < MIN_MAX_SOURCE_CHARS || maxSourceChars > llmConfig.hardMaxSourceChars) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: `max_source_chars must stay between ${MIN_MAX_SOURCE_CHARS} and ${llmConfig.hardMaxSourceChars}.`
          }
        }
      };
    }

    const now = new Date().toISOString();
    const promptVersion = buildPromptVersion(now);
    database
      .prepare(
        `UPDATE llm_simplify_settings
         SET feature_enabled = ?,
             model = ?,
             system_prompt = ?,
             user_prompt_template = ?,
             prompt_version = ?,
             temperature = ?,
             max_output_tokens = ?,
             request_timeout_ms = ?,
             max_source_chars = ?,
             oversized_behavior = ?,
             updated_at = ?,
             updated_by_user_id = ?
         WHERE id = ?`
      )
      .run(
        featureEnabled ? 1 : 0,
        model,
        systemPrompt,
        userPromptTemplate,
        promptVersion,
        temperature,
        maxOutputTokens,
        requestTimeoutMs,
        maxSourceChars,
        oversizedBehavior,
        now,
        actorUserId ?? null,
        SETTINGS_ROW_ID
      );

    return buildSettingsResult(database, mapSettingsRow(readSettingsRow(database, llmConfig), llmConfig), !!llmConfig.apiKey, llmConfig);
  }

  async function testConnection() {
    const settings = mapSettingsRow(readSettingsRow(database, llmConfig), llmConfig);
    const testedAt = new Date().toISOString();
    if (!llmConfig.apiKey) {
      return {
        ok: true,
        status: "missing_key",
        key_configured: false,
        provider: settings.provider,
        model: settings.model,
        error_code: "config_missing",
        error_message: "DeepSeek API key не настроен.",
        tested_at: testedAt
      };
    }

    try {
      await client.createChatCompletion({
        model: settings.model,
        systemPrompt: settings.system_prompt,
        userPrompt: "Ответь ровно одной строкой: OK",
        temperature: settings.temperature,
        maxOutputTokens: getEffectiveMaxOutputTokens(settings, llmConfig),
        signal: AbortSignal.timeout(getEffectiveRequestTimeoutMs(settings, llmConfig))
      });

      return {
        ok: true,
        status: "success",
        key_configured: true,
        provider: settings.provider,
        model: settings.model,
        error_code: null,
        error_message: null,
        tested_at: testedAt
      };
    } catch (error) {
      const storedError = normalizeStoredError(error);
      return {
        ok: true,
        status: "failed",
        key_configured: true,
        provider: settings.provider,
        model: settings.model,
        error_code: storedError.error_code,
        error_message: storedError.error_message,
        tested_at: testedAt
      };
    }
  }

  return {
    getSimplifyState,
    generate,
    streamGenerate,
    getSettings,
    updateSettings,
    testConnection
  };
}
