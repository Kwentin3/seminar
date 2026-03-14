import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../../server/cabinet/passwords.mjs";

test("cabinet simplify generates once, caches by identity, and regenerate overwrites the current row", async (t) => {
  const provider = await startStubDeepSeek(t);
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl,
    LLM_SIMPLIFY_TIMEOUT_MS: "1000",
    LLM_SIMPLIFY_DEFAULT_MAX_OUTPUT_TOKENS: "900"
  });

  const unauthorizedState = await fetch(`${server.baseUrl}/api/cabinet/materials/example-material/simplify`);
  assert.equal(unauthorizedState.status, 401);
  assert.equal((await unauthorizedState.json()).code, "cabinet_unauthorized");

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const initialStateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(initialStateResponse.status, 200);
  const initialState = await initialStateResponse.json();
  assert.equal(initialState.state.status, "idle");

  const firstGenerateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(firstGenerateResponse.status, 200);
  const firstGeneratePayload = await firstGenerateResponse.json();
  assert.equal(firstGeneratePayload.state.status, "ready");
  assert.equal(firstGeneratePayload.state.delivery_mode, "generated");
  assert.match(firstGeneratePayload.state.content, /Упрощённый пересказ #1/);
  assert.equal(provider.requestCount(), 1);
  assert.equal(provider.lastRequest().max_tokens, 900);
  assert.match(provider.lastRequest().messages[1].content, /Название документа:/);
  assert.match(provider.lastRequest().messages[1].content, /Slug документа:/);
  assert.doesNotMatch(provider.lastRequest().messages[1].content, /\{\{source_markdown\}\}/);

  const cachedGenerateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(cachedGenerateResponse.status, 200);
  const cachedGeneratePayload = await cachedGenerateResponse.json();
  assert.equal(cachedGeneratePayload.state.status, "ready");
  assert.equal(cachedGeneratePayload.state.delivery_mode, "cache");
  assert.equal(provider.requestCount(), 1);

  const regenerateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify/regenerate`, {
    method: "POST",
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(regenerateResponse.status, 200);
  const regeneratePayload = await regenerateResponse.json();
  assert.equal(regeneratePayload.state.status, "ready");
  assert.equal(regeneratePayload.state.delivery_mode, "generated");
  assert.match(regeneratePayload.state.content, /Упрощённый пересказ #2/);
  assert.equal(provider.requestCount(), 2);

  const database = new DatabaseSync(server.databasePath, { readOnly: true });
  const cachedRows = database
    .prepare("SELECT status, generated_markdown FROM material_simplifications WHERE material_id = (SELECT id FROM materials WHERE slug = ?)")
    .all(markdownItem.slug);
  database.close();

  assert.equal(cachedRows.length, 1);
  assert.equal(cachedRows[0].status, "ready");
  assert.match(cachedRows[0].generated_markdown, /Упрощённый пересказ #2/);
});

test("cabinet simplify streaming endpoint emits progressive deltas, writes final cache, and regenerate preserves cache discipline", async (t) => {
  const provider = await startStubDeepSeek(t, {
    streamChunks: ["# Поток #1\n\n", "Первая часть.\n\n", "Вторая часть."]
  });
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl,
    LLM_SIMPLIFY_TIMEOUT_MS: "2000"
  });

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const firstStream = await consumeSimplifyStream(server.baseUrl, markdownItem.slug, adminCookie);
  assert.deepEqual(firstStream.eventTypes.slice(0, 4), ["open", "meta", "delta", "delta"]);
  assert.equal(firstStream.doneEvent?.data.result, "normal_success");
  assert.match(firstStream.concatenatedDeltaText, /Первая часть/);
  assert.match(firstStream.concatenatedDeltaText, /Вторая часть/);
  assert.equal(provider.requestCount(), 1);

  const database = new DatabaseSync(server.databasePath, { readOnly: true });
  const readyRow = database
    .prepare("SELECT status, generated_markdown FROM material_simplifications WHERE material_id = (SELECT id FROM materials WHERE slug = ?)")
    .get(markdownItem.slug);
  database.close();

  assert.equal(readyRow.status, "ready");
  assert.match(readyRow.generated_markdown, /Вторая часть/);

  const cachedStateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(cachedStateResponse.status, 200);
  const cachedStatePayload = await cachedStateResponse.json();
  assert.equal(cachedStatePayload.state.status, "ready");
  assert.equal(cachedStatePayload.state.delivery_mode, "cache");
  assert.equal(provider.requestCount(), 1);

  provider.setStreamChunks(["# Поток #2\n\n", "Новая версия пересказа."]);
  const regenerateStream = await consumeSimplifyStream(server.baseUrl, markdownItem.slug, adminCookie, {
    force: true
  });
  assert.equal(regenerateStream.doneEvent?.data.result, "normal_success");
  assert.match(regenerateStream.concatenatedDeltaText, /Новая версия пересказа/);
  assert.equal(provider.requestCount(), 2);

  const databaseAfterRegenerate = new DatabaseSync(server.databasePath, { readOnly: true });
  const refreshedRow = databaseAfterRegenerate
    .prepare("SELECT status, generated_markdown FROM material_simplifications WHERE material_id = (SELECT id FROM materials WHERE slug = ?)")
    .get(markdownItem.slug);
  databaseAfterRegenerate.close();
  assert.equal(refreshedRow.status, "ready");
  assert.match(refreshedRow.generated_markdown, /Новая версия пересказа/);
});

test("cabinet simplify streaming interruptions do not persist partial output as ready cache entries", async (t) => {
  const provider = await startStubDeepSeek(t, {
    streamChunks: ["# Сохранённая версия\n\n", "Нормальный итог."]
  });
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl,
    LLM_SIMPLIFY_TIMEOUT_MS: "2000"
  });

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const warmupStream = await consumeSimplifyStream(server.baseUrl, markdownItem.slug, adminCookie);
  assert.equal(warmupStream.doneEvent?.data.result, "normal_success");
  assert.equal(provider.requestCount(), 1);

  provider.setMode("stream_interrupted");
  provider.setStreamChunks(["Частичный ", "ответ"]);
  const failedRegenerateStream = await consumeSimplifyStream(server.baseUrl, markdownItem.slug, adminCookie, {
    force: true
  });
  assert.equal(failedRegenerateStream.errorEvent?.data.error_code, "stream_interrupted");
  assert.match(failedRegenerateStream.concatenatedDeltaText, /Частичный ответ/);
  assert.equal(failedRegenerateStream.errorEvent?.data.cache_preserved, true);
  assert.equal(provider.requestCount(), 2);

  const cachedStateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(cachedStateResponse.status, 200);
  const cachedStatePayload = await cachedStateResponse.json();
  assert.equal(cachedStatePayload.state.status, "ready");
  assert.equal(cachedStatePayload.state.delivery_mode, "cache");
  assert.match(cachedStatePayload.state.content, /Сохранённая версия/);

  const database = new DatabaseSync(server.databasePath, { readOnly: true });
  const cachedRow = database
    .prepare("SELECT status, generated_markdown FROM material_simplifications WHERE material_id = (SELECT id FROM materials WHERE slug = ?)")
    .get(markdownItem.slug);
  database.close();
  assert.equal(cachedRow.status, "ready");
  assert.match(cachedRow.generated_markdown, /Сохранённая версия/);
});

test("cabinet simplify does not send max_tokens when no explicit output cap is configured", async (t) => {
  const provider = await startStubDeepSeek(t);
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl
  });

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const response = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.state.status, "ready");
  assert.equal(provider.requestCount(), 1);
  assert.equal("max_tokens" in provider.lastRequest(), false);
});

test("cabinet simplify persists typed provider failures and emits redacted diagnostics", async (t) => {
  const provider = await startStubDeepSeek(t, {
    mode: "rate_limit"
  });
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl
  });

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const response = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.state.status, "failed");
  assert.equal(payload.state.error_code, "rate_limit");
  assert.match(payload.state.error_message, /ограничил запросы/i);

  const stateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(stateResponse.status, 200);
  const statePayload = await stateResponse.json();
  assert.equal(statePayload.state.status, "failed");
  assert.equal(statePayload.state.error_code, "rate_limit");
  assert.equal(statePayload.state.can_regenerate, true);

  await waitForCondition(() => server.getStdout().includes("cabinet_material_simplify_provider_call_failed"));
  const stdout = server.getStdout();
  assert.match(stdout, /"event":"cabinet_material_simplify_provider_call_failed"/);
  assert.match(stdout, /"error_code":"rate_limit"/);
  assert.match(stdout, /"provider_http_status":429/);
  assert.doesNotMatch(stdout, /Исходный документ:/);
  assert.doesNotMatch(stdout, /Authorization: Bearer/);
});

test("cabinet simplify marks truncated provider completions as ready-with-warning", async (t) => {
  const provider = await startStubDeepSeek(t, {
    finishReason: "length",
    content: "# Упрощённый пересказ\n\nТекст заметно обрывается на середине мысли"
  });
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl
  });

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const response = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.state.status, "ready");
  assert.equal(payload.state.delivery_mode, "generated");
  assert.equal(payload.state.error_code, "output_truncated");
  assert.match(payload.state.error_message, /обрезан по лимиту длины/i);
  assert.match(payload.state.content, /обрывается/);

  const database = new DatabaseSync(server.databasePath, { readOnly: true });
  const cachedRow = database
    .prepare("SELECT status, error_code, error_message, generated_markdown FROM material_simplifications WHERE material_id = (SELECT id FROM materials WHERE slug = ?)")
    .get(markdownItem.slug);
  database.close();

  assert.equal(cachedRow.status, "ready");
  assert.equal(cachedRow.error_code, "output_truncated");
  assert.match(cachedRow.error_message, /обрезан по лимиту длины/i);
  assert.match(cachedRow.generated_markdown, /обрывается/);

  await waitForCondition(() => server.getStdout().includes("cabinet_material_simplify_provider_call_completed"));
  const stdout = server.getStdout();
  assert.match(stdout, /"finish_reason":"length"/);
  assert.match(stdout, /"output_truncated":true/);
});

test("cabinet simplify settings are admin-only, connection test is terminal, and prompt changes make existing cache stale", async (t) => {
  const provider = await startStubDeepSeek(t);
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl
  });

  const database = new DatabaseSync(server.databasePath);
  const viewerId = "viewer-user";
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
      ) VALUES (?, ?, ?, ?, 'viewer', 1, ?, ?)`
    )
    .run(
      viewerId,
      "viewer-user",
      "viewer@example.com",
      hashPassword("viewer-pass"),
      new Date().toISOString(),
      new Date().toISOString()
    );
  database.close();

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const viewerCookie = await login(server.baseUrl, "viewer-user", "viewer-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const viewerSettingsResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/settings`, {
    headers: {
      Cookie: viewerCookie
    }
  });
  assert.equal(viewerSettingsResponse.status, 403);
  assert.equal((await viewerSettingsResponse.json()).code, "cabinet_forbidden");

  const viewerSimplifyResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: viewerCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(viewerSimplifyResponse.status, 200);
  assert.equal((await viewerSimplifyResponse.json()).state.status, "ready");
  assert.equal(provider.requestCount(), 1);

  const connectionResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/test-connection`, {
    method: "POST",
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(connectionResponse.status, 200);
  const connectionPayload = await connectionResponse.json();
  assert.equal(connectionPayload.status, "success");
  assert.equal(provider.requestCount(), 2);

  const settingsResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/settings`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(settingsResponse.status, 200);
  const settingsPayload = await settingsResponse.json();
  assert.match(settingsPayload.settings.user_prompt_template, /\{\{material_title\}\}/);
  assert.equal(settingsPayload.effective_config.request_timeout_ms, 75000);
  assert.equal(settingsPayload.effective_config.max_source_chars, 20000);
  assert.equal(settingsPayload.effective_config.oversized_behavior, "block");
  assert.equal(settingsPayload.recent_failure, null);

  const updateResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/settings`, {
    method: "PUT",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      feature_enabled: true,
      model: `${settingsPayload.settings.model}-next`,
      system_prompt: `${settingsPayload.settings.system_prompt}\n\nДобавь один короткий итоговый абзац.`,
      user_prompt_template: [
        "CUSTOM TEMPLATE",
        "Doc: {{material_title}}",
        "Slug: {{material_slug}}",
        "Source: {{material_source_path}}",
        "",
        "{{source_markdown}}"
      ].join("\n"),
      temperature: settingsPayload.settings.temperature,
      max_output_tokens: settingsPayload.settings.max_output_tokens,
      request_timeout_ms: 62000,
      max_source_chars: 20000,
      oversized_behavior: "block"
    })
  });
  assert.equal(updateResponse.status, 200);
  const updatePayload = await updateResponse.json();
  assert.notEqual(updatePayload.settings.prompt_version, settingsPayload.settings.prompt_version);
  assert.match(updatePayload.settings.user_prompt_template, /CUSTOM TEMPLATE/);
  assert.equal(updatePayload.settings.request_timeout_ms, 62000);
  assert.equal(updatePayload.settings.max_source_chars, 20000);
  assert.equal(updatePayload.effective_config.request_timeout_ms, 62000);
  assert.equal(updatePayload.effective_config.max_source_chars, 20000);
  assert.equal(updatePayload.effective_config.oversized_behavior, "block");

  const staleStateResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(staleStateResponse.status, 200);
  const staleStatePayload = await staleStateResponse.json();
  assert.equal(staleStatePayload.state.status, "stale");
  assert.match(staleStatePayload.state.content, /Упрощённый пересказ #1/);

  const refreshedResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(refreshedResponse.status, 200);
  const refreshedPayload = await refreshedResponse.json();
  assert.equal(refreshedPayload.state.status, "ready");
  assert.equal(refreshedPayload.state.delivery_mode, "generated");
  assert.equal(provider.requestCount(), 3);
  assert.match(provider.lastRequest().messages[1].content, /CUSTOM TEMPLATE/);
  assert.match(provider.lastRequest().messages[1].content, new RegExp(`Slug: ${markdownItem.slug}`));
  assert.doesNotMatch(provider.lastRequest().messages[1].content, /\{\{material_title\}\}/);
});

test("cabinet simplify settings expose effective config and block oversized sources before provider call", async (t) => {
  const provider = await startStubDeepSeek(t);
  const server = await startServer(t, {
    DEEPSEEK_API_KEY: "test-deepseek-key",
    DEEPSEEK_BASE_URL: provider.baseUrl
  });

  const adminCookie = await login(server.baseUrl, "simplify-admin", "simplify-admin-pass");
  const materials = await fetchMaterials(server.baseUrl, adminCookie);
  const markdownItem = materials.items.find((item) => item.reading_mode === "in_app");
  assert.ok(markdownItem, "expected markdown item");

  const settingsResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/settings`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(settingsResponse.status, 200);
  const settingsPayload = await settingsResponse.json();

  const updateResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/settings`, {
    method: "PUT",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      feature_enabled: settingsPayload.settings.feature_enabled,
      model: settingsPayload.settings.model,
      system_prompt: settingsPayload.settings.system_prompt,
      user_prompt_template: settingsPayload.settings.user_prompt_template,
      temperature: settingsPayload.settings.temperature,
      max_output_tokens: null,
      request_timeout_ms: 60000,
      max_source_chars: 2000,
      oversized_behavior: "block"
    })
  });
  assert.equal(updateResponse.status, 200);
  const updatePayload = await updateResponse.json();
  assert.equal(updatePayload.effective_config.max_output_tokens, null);
  assert.equal(updatePayload.effective_config.request_timeout_ms, 60000);
  assert.equal(updatePayload.effective_config.max_source_chars, 2000);
  assert.equal(updatePayload.effective_config.hard_max_source_chars, 25000);

  const simplifyResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ force: false })
  });
  assert.equal(simplifyResponse.status, 200);
  const simplifyPayload = await simplifyResponse.json();
  assert.equal(simplifyPayload.state.status, "failed");
  assert.equal(simplifyPayload.state.error_code, "content_too_large");
  assert.match(simplifyPayload.state.error_message, /single-pass|лимит|слишком длин/i);
  assert.equal(provider.requestCount(), 0);

  const refreshedSettingsResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/llm-simplify/settings`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(refreshedSettingsResponse.status, 200);
  const refreshedSettingsPayload = await refreshedSettingsResponse.json();
  assert.equal(refreshedSettingsPayload.recent_failure.error_code, "content_too_large");
  assert.equal(refreshedSettingsPayload.recent_failure.material_slug, markdownItem.slug);
});

async function startStubDeepSeek(t, options = {}) {
  const requests = [];
  let currentMode = options.mode ?? "success";
  let currentStreamChunks = Array.isArray(options.streamChunks) && options.streamChunks.length > 0
    ? [...options.streamChunks]
    : null;
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push(payload);
    const sequence = requests.length;

    if (typeof options.delayMs === "number" && options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    if (payload.stream === true) {
      if (currentMode === "stream_interrupted") {
        response.statusCode = 200;
        response.setHeader("content-type", "text/event-stream");
        const interruptedChunks = currentStreamChunks ?? ["Частичный ответ"];
        for (const chunk of interruptedChunks) {
          response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        }
        response.end();
        return;
      }

      if (currentMode === "stream_timeout_before") {
        response.statusCode = 200;
        response.setHeader("content-type", "text/event-stream");
        await new Promise((resolve) => setTimeout(resolve, 2500));
        response.end();
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      const streamChunks =
        currentStreamChunks ?? [options.content ?? `# Упрощённый пересказ #${sequence}\n\nКороткая версия материала для лектора.`];
      for (const chunk of streamChunks) {
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      response.write(`data: ${JSON.stringify({ choices: [{ finish_reason: options.finishReason ?? "stop" }] })}\n\n`);
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (currentMode === "rate_limit") {
      response.statusCode = 429;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "slow down" } }));
      return;
    }

    if (currentMode === "malformed_json") {
      response.setHeader("content-type", "application/json");
      response.end("{invalid");
      return;
    }

    if (currentMode === "empty_response") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ choices: [{ message: { content: "   " } }] }));
      return;
    }

    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: options.finishReason ?? "stop",
            message: {
              content: options.content ?? `# Упрощённый пересказ #${sequence}\n\nКороткая версия материала для лектора.`
            }
          }
        ]
      })
    );
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requestCount() {
      return requests.length;
    },
    lastRequest() {
      return requests.at(-1) ?? null;
    },
    setMode(nextMode) {
      currentMode = nextMode;
    },
    setStreamChunks(nextChunks) {
      currentStreamChunks = Array.isArray(nextChunks) ? [...nextChunks] : null;
    }
  };
}

async function consumeSimplifyStream(baseUrl, slug, cookie, options = {}) {
  const response = await fetch(`${baseUrl}/api/cabinet/materials/${slug}/simplify/stream?force=${options.force ? "1" : "0"}`, {
    headers: {
      Cookie: cookie,
      Accept: "text/event-stream"
    }
  });

  assert.equal(response.status, 200);
  assert.ok(response.body, "expected streaming response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const nextFrame = takeNextSseFrame(buffer);
      if (!nextFrame) {
        break;
      }

      buffer = nextFrame.rest;
      const event = parseStreamFrame(nextFrame.frame);
      if (event) {
        events.push(event);
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    const event = parseStreamFrame(buffer);
    if (event) {
      events.push(event);
    }
  }

  return {
    events,
    eventTypes: events.map((event) => event.type),
    concatenatedDeltaText: events
      .filter((event) => event.type === "delta")
      .map((event) => event.data.text)
      .join(""),
    doneEvent: events.find((event) => event.type === "done") ?? null,
    errorEvent: events.find((event) => event.type === "error") ?? null
  };
}

function takeNextSseFrame(buffer) {
  const unixIndex = buffer.indexOf("\n\n");
  if (unixIndex >= 0) {
    return {
      frame: buffer.slice(0, unixIndex),
      rest: buffer.slice(unixIndex + 2)
    };
  }

  const windowsIndex = buffer.indexOf("\r\n\r\n");
  if (windowsIndex >= 0) {
    return {
      frame: buffer.slice(0, windowsIndex),
      rest: buffer.slice(windowsIndex + 4)
    };
  }

  return null;
}

function parseStreamFrame(frame) {
  const normalizedFrame = frame.replace(/\r/g, "");
  const lines = normalizedFrame.split("\n");
  const type = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!type || data.length === 0) {
    return null;
  }

  return {
    type,
    data: JSON.parse(data)
  };
}

async function startServer(t, extraEnv) {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-simplify-"));
  const staticDir = path.join(fixtureDir, "static");
  const databasePath = path.join(fixtureDir, "cabinet.sqlite");
  const port = 19600 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;

  await mkdir(staticDir, { recursive: true });
  await writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>cabinet simplify test</body></html>", {
    encoding: "utf8"
  });

  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      ADMIN_SECRET: "test-admin-secret",
      CABINET_BOOTSTRAP_ADMIN: "1",
      CABINET_BOOTSTRAP_USERNAME: "simplify-admin",
      CABINET_BOOTSTRAP_EMAIL: "simplify-admin@example.com",
      CABINET_BOOTSTRAP_PASSWORD: "simplify-admin-pass",
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ...extraEnv
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => {
        child.once("exit", resolve);
      });
    }
    await rm(fixtureDir, { recursive: true, force: true });
  });

  await waitForServerStarted(child);

  const normalizedStderr = stderr
    .replace(/\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/, "")
    .replace(/\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/, "")
    .trim();
  assert.equal(normalizedStderr, "");

  return {
    baseUrl,
    databasePath,
    getStdout() {
      return stdout;
    }
  };
}

async function login(baseUrl, login, password) {
  const response = await fetch(`${baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login,
      password
    })
  });

  assert.equal(response.status, 200);
  return toCookieHeader(response.headers.get("set-cookie"));
}

async function fetchMaterials(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/cabinet/materials`, {
    headers: {
      Cookie: cookie
    }
  });
  assert.equal(response.status, 200);
  return response.json();
}

function waitForServerStarted(child) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      if (chunk.includes("runtime_server_started")) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`server exited before startup (code=${code})`));
    };

    const cleanup = () => {
      child.stdout.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout.on("data", onData);
    child.on("exit", onExit);
  });
}

async function waitForCondition(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("condition was not met before timeout");
}

function toCookieHeader(rawHeader) {
  return rawHeader ? rawHeader.split(";")[0] : null;
}
