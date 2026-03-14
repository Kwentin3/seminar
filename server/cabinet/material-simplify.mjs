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

  return now - updatedAt > llmConfig.requestTimeoutMs * STALE_GENERATING_MULTIPLIER;
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
      error_message: "Документ слишком длинный для текущего MVP-режима."
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

  return llmConfig.defaultMaxOutputTokens;
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
    provider_message: truncateDiagnosticMessage(diagnostics.provider_message),
    abort_fired: diagnostics.abort_fired === true,
    provider_duration_ms:
      typeof diagnostics.duration_ms === "number" && Number.isFinite(diagnostics.duration_ms) ? diagnostics.duration_ms : null,
    response_content_type: readString(diagnostics.response_content_type),
    response_body_length:
      typeof diagnostics.response_body_length === "number" && Number.isFinite(diagnostics.response_body_length)
        ? diagnostics.response_body_length
        : null
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

function readSettingsRow(database) {
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
        updated_at,
        updated_by_user_id
      ) VALUES (?, 'deepseek', 1, 'deepseek-chat', ?, ?, 'v1', NULL, NULL, ?, NULL)`
    )
    .run(
      SETTINGS_ROW_ID,
      defaultPromptConfig.system_prompt,
      defaultPromptConfig.user_prompt_template,
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
        updated_at,
        NULL AS updated_by_username
       FROM llm_simplify_settings
       WHERE id = ?
       LIMIT 1`
    )
    .get(SETTINGS_ROW_ID);
}

function mapSettingsRow(row) {
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

    const settings = mapSettingsRow(readSettingsRow(database));
    return {
      ok: true,
      context: {
        material,
        markdown,
        settings,
        llmConfig,
        keyConfigured: !!llmConfig.apiKey,
        effectiveMaxOutputTokens: getEffectiveMaxOutputTokens(settings, llmConfig),
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
    if (context.markdown.length > llmConfig.maxSourceChars) {
      const storedError = normalizeStoredError({ code: "content_too_large" });
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
      }, llmConfig.requestTimeoutMs);

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
            timeout_ms: llmConfig.requestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
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
          error_code: null,
          error_message: null,
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
            timeout_ms: llmConfig.requestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
            source_chars: context.markdown.length,
            cache_intent: force ? "regenerate" : "cache_miss",
            provider_http_status: providerDiagnostics.provider_http_status,
            provider_duration_ms: providerDiagnostics.provider_duration_ms,
            abort_fired: providerDiagnostics.abort_fired
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
            timeout_ms: llmConfig.requestTimeoutMs,
            max_output_tokens: context.effectiveMaxOutputTokens,
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

  function getSettings() {
    return {
      ok: true,
      ...buildSettingsPayload(mapSettingsRow(readSettingsRow(database)), !!llmConfig.apiKey)
    };
  }

  function updateSettings(input, actorUserId) {
    const featureEnabled = typeof input.feature_enabled === "boolean" ? input.feature_enabled : null;
    const model = readString(input.model);
    const systemPrompt = readString(input.system_prompt);
    const userPromptTemplate = readString(input.user_prompt_template);
    const temperature = readNullableFiniteNumber(input.temperature);
    const maxOutputTokens = readNullablePositiveInt(input.max_output_tokens);
    if (featureEnabled === null || !model || !systemPrompt || !userPromptTemplate) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "feature_enabled, model, system_prompt, and user_prompt_template are required."
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
        now,
        actorUserId ?? null,
        SETTINGS_ROW_ID
      );

    return {
      ok: true,
      ...buildSettingsPayload(mapSettingsRow(readSettingsRow(database)), !!llmConfig.apiKey)
    };
  }

  async function testConnection() {
    const settings = mapSettingsRow(readSettingsRow(database));
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
        maxOutputTokens: settings.max_output_tokens,
        signal: AbortSignal.timeout(llmConfig.requestTimeoutMs)
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
    getSettings,
    updateSettings,
    testConnection
  };
}
