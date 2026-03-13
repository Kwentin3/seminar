import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

function createJsonEvent({ level, event, requestId }) {
  return JSON.stringify({
    ts: "2026-02-28T00:00:00.000Z",
    level,
    event,
    domain: "runtime",
    module: "runtime/http-middleware",
    request_id: requestId,
    payload: {},
    error: null,
    meta: { schema: "obs.event.v0.4" }
  });
}

async function createFakeJournalctlScript(tempDir, lines) {
  if (process.platform === "win32") {
    const scriptPath = path.join(tempDir, "fake-journalctl.cmd");
    const escaped = lines.map((line) => line.replace(/%/g, "%%"));
    const content = ["@echo off", ...escaped.map((line) => `echo ${line}`), ""].join("\r\n");
    await writeFile(scriptPath, content, "utf8");
    return scriptPath;
  }

  const scriptPath = path.join(tempDir, "fake-journalctl.sh");
  const content = `#!/usr/bin/env sh\ncat <<'EOF'\n${lines.join("\n")}\nEOF\n`;
  await writeFile(scriptPath, content, { encoding: "utf8", mode: 0o755 });
  return scriptPath;
}

async function createFakeDockerLogsNodeScript(tempDir, lines) {
  const scriptPath = path.join(tempDir, "logs");
  const scriptBody = `#!/usr/bin/env node\nconst lines = ${JSON.stringify(lines)};\nfor (const line of lines) {\n  process.stdout.write(String(line) + \"\\n\");\n}\n`;
  await writeFile(scriptPath, scriptBody, { encoding: "utf8", mode: 0o755 });
  return scriptPath;
}

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function waitForCondition(predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("condition was not met before timeout");
}

function createNdjsonCollector(stream) {
  const records = [];
  let pending = "";

  stream.on("data", (chunk) => {
    pending += String(chunk);
    while (true) {
      const newLineIndex = pending.indexOf("\n");
      if (newLineIndex === -1) {
        break;
      }
      const line = pending.slice(0, newLineIndex).trim();
      pending = pending.slice(newLineIndex + 1);
      if (!line) {
        continue;
      }
      try {
        records.push(JSON.parse(line));
      } catch {
        // non-JSON output is ignored in collector
      }
    }
  });

  return {
    records
  };
}

async function loadRepoLandingJson(relativePath) {
  const absolutePath = path.resolve(relativePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw);
}

async function createLandingContentFixture(tempDir, mutate) {
  const fixtureDir = path.join(tempDir, "fixture-content", "landing");
  await mkdir(fixtureDir, { recursive: true });

  const manifest = await loadRepoLandingJson("content/landing/manifest.v1.json");
  const step1 = await loadRepoLandingJson("content/landing/step1.hero.v1.json");
  const step2 = await loadRepoLandingJson("content/landing/step2.roles.v1.json");

  if (typeof mutate === "function") {
    mutate({ manifest, step1, step2 });
  }

  const manifestPath = path.join(fixtureDir, "manifest.v1.json");
  const step1Path = path.join(fixtureDir, "step1.hero.v1.json");
  const step2Path = path.join(fixtureDir, "step2.roles.v1.json");

  manifest.modules["landing.step1.hero"].path = step1Path;
  manifest.modules["landing.step2.roles"].path = step2Path;

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(step1Path, JSON.stringify(step1, null, 2), "utf8");
  await writeFile(step2Path, JSON.stringify(step2, null, 2), "utf8");

  return {
    manifestPath,
    step1Path,
    step2Path
  };
}

function spawnAndCollect(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 3_000);
    child.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

test("CLI emits NDJSON and honors level/request_id filters", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-obs-cli-"));
  try {
    const fakeJournalctl = await createFakeJournalctlScript(tempDir, [
      createJsonEvent({ level: "info", event: "http_request_started", requestId: "req_cli_1" }),
      createJsonEvent({ level: "error", event: "http_request_failed", requestId: "req_cli_1" }),
      createJsonEvent({ level: "info", event: "lead_submit_completed", requestId: "req_cli_2" })
    ]);

    const result = await spawnAndCollect(
      process.execPath,
      [path.resolve("scripts/obs/logs.mjs"), "--since", "2026-02-28T00:00:00Z", "--level", "info", "--request-id", "req_cli_1", "--limit", "10"],
      {
        ...process.env,
        OBS_LOG_SOURCE: "journald",
        OBS_JOURNALCTL_BIN: fakeJournalctl
      }
    );

    assert.equal(result.code, 0, `cli failed: ${result.stderr}`);
    const lines = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    assert.equal(lines.length, 1);
    const event = JSON.parse(lines[0]);
    assert.equal(event.level, "info");
    assert.equal(event.request_id, "req_cli_1");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("landing request emits content_bundle_loaded and hero_variant_selected with request correlation", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-landing-obs-happy-"));
  const port = 19_050 + Math.floor(Math.random() * 200);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "landing-obs.sqlite");

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const collector = createNdjsonCollector(server.stdout);
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(`http://${host}:${port}/`);
  assert.equal(response.status, 200, `unexpected status: ${response.status}, stderr: ${stderr}`);
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId, "expected x-request-id header");

  await waitForCondition(() =>
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "content_bundle_loaded" &&
        record.domain === "content"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "hero_variant_selected" &&
        record.domain === "landing"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "http_request_completed" &&
        record.domain === "runtime"
    )
  );

  const loadedEvent = collector.records.find(
    (record) =>
      record.request_id === requestId && record.event === "content_bundle_loaded" && record.domain === "content"
  );
  assert.ok(loadedEvent, "expected content_bundle_loaded");
  assert.equal(typeof loadedEvent.duration_ms, "number");
  assert.equal(/^[A-Za-z0-9_-]{43}$/.test(loadedEvent.payload?.content_bundle_hash ?? ""), true);

  const heroSelectedEvent = collector.records.find(
    (record) =>
      record.request_id === requestId && record.event === "hero_variant_selected" && record.domain === "landing"
  );
  assert.ok(heroSelectedEvent, "expected hero_variant_selected");
  assert.equal(["aggressive", "rational", "partner"].includes(heroSelectedEvent.payload?.variant_id), true);
  assert.equal(["persisted", "random", "fallback"].includes(heroSelectedEvent.payload?.reason), true);
  assert.equal(/^[A-Za-z0-9_-]{43}$/.test(heroSelectedEvent.payload?.content_unit_hash ?? ""), true);
  assert.equal(
    collector.records.some(
      (record) => record.request_id === requestId && record.event === "content_bundle_failed" && record.domain === "content"
    ),
    false
  );
});

test("landing request emits schema violation and landing_render_degraded for invalid content bundle", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-landing-obs-violation-"));
  const port = 19_260 + Math.floor(Math.random() * 200);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "landing-obs-violation.sqlite");

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const fixture = await createLandingContentFixture(tempDir, ({ step1 }) => {
    delete step1.experiment;
  });

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret",
      LANDING_CONTENT_MANIFEST_PATH: fixture.manifestPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const collector = createNdjsonCollector(server.stdout);
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(`http://${host}:${port}/`);
  assert.equal(response.status, 200, `unexpected status: ${response.status}, stderr: ${stderr}`);
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId, "expected x-request-id header");

  await waitForCondition(() =>
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "content_schema_violation_detected" &&
        record.domain === "content"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "landing_render_degraded" &&
        record.domain === "landing"
    )
  );

  const schemaEvent = collector.records.find(
    (record) =>
      record.request_id === requestId &&
      record.event === "content_schema_violation_detected" &&
      record.domain === "content"
  );
  assert.ok(schemaEvent, "expected content_schema_violation_detected");
  assert.equal(typeof schemaEvent.error?.code === "string" && schemaEvent.error.code.startsWith("content."), true);

  const degradedEvent = collector.records.find(
    (record) =>
      record.request_id === requestId &&
      record.event === "landing_render_degraded" &&
      record.domain === "landing"
  );
  assert.ok(degradedEvent, "expected landing_render_degraded");
  assert.equal(typeof degradedEvent.error?.code === "string" && degradedEvent.error.code.startsWith("landing."), true);
});

test("landing request emits content_bundle_failed when manifest file is missing", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-landing-obs-load-failed-"));
  const port = 19_470 + Math.floor(Math.random() * 200);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "landing-obs-load-failed.sqlite");
  const missingManifest = path.join(tempDir, "missing", "manifest.v1.json");

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret",
      LANDING_CONTENT_MANIFEST_PATH: missingManifest
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const collector = createNdjsonCollector(server.stdout);
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(`http://${host}:${port}/`);
  assert.equal(response.status, 200, `unexpected status: ${response.status}, stderr: ${stderr}`);
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId, "expected x-request-id header");

  await waitForCondition(() =>
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "content_bundle_failed" &&
        record.domain === "content"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "landing_render_degraded" &&
        record.domain === "landing"
    )
  );

  const bundleFailed = collector.records.find(
    (record) =>
      record.request_id === requestId && record.event === "content_bundle_failed" && record.domain === "content"
  );
  assert.ok(bundleFailed, "expected content_bundle_failed");
  assert.equal(
    ["content.bundle_load_failed", "content.bundle_parse_failed"].includes(bundleFailed.error?.code),
    true
  );
});

test("admin auth failure logs only admin_auth_failed with admin.unauthorized", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-admin-auth-failed-"));
  const port = 19_300 + Math.floor(Math.random() * 400);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "admin-auth.sqlite");

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collector = createNdjsonCollector(server.stdout);
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(`http://${host}:${port}/api/admin/leads?limit=1`, {
    headers: { "X-Admin-Secret": "wrong-secret" }
  });
  assert.equal(response.status, 401, `unexpected status: ${response.status}, stderr: ${stderr}`);
  const responseBody = await response.json();
  assert.equal(responseBody.code, "admin_unauthorized");
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId, "expected x-request-id header");

  await waitForCondition(() =>
    collector.records.some(
      (record) => record.request_id === requestId && record.event === "admin_auth_failed" && record.domain === "admin"
    )
  );

  const authFailure = collector.records.find(
    (record) => record.request_id === requestId && record.event === "admin_auth_failed" && record.domain === "admin"
  );
  assert.ok(authFailure, "expected admin_auth_failed event");
  assert.equal(authFailure.error?.code, "admin.unauthorized");
  assert.equal(
    collector.records.some(
      (record) => record.request_id === requestId && record.event === "admin_action_failed" && record.domain === "admin"
    ),
    false
  );
});

test("admin internal failure logs admin_action_failed and not admin_auth_failed", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-admin-action-failed-"));
  const port = 19_800 + Math.floor(Math.random() * 400);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "admin-action.sqlite");
  const missingJournalctl = path.join(tempDir, "missing-journalctl-bin");

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret",
      OBS_LOG_SOURCE: "journald",
      OBS_JOURNALCTL_BIN: missingJournalctl
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collector = createNdjsonCollector(server.stdout);
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(
    `http://${host}:${port}/admin/obs/logs?since=2026-02-28T00:00:00Z&level=info&limit=10`,
    { headers: { "X-Admin-Secret": "test-admin-secret" } }
  );
  assert.equal(response.status, 500, `unexpected status: ${response.status}, stderr: ${stderr}`);
  const responseBody = await response.json();
  assert.equal(responseBody.code, "internal_error");
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId, "expected x-request-id header");

  await waitForCondition(() =>
    collector.records.some(
      (record) =>
        record.request_id === requestId && record.event === "admin_action_failed" && record.error?.code === "admin.obs_logs_failed"
    )
  );

  assert.equal(
    collector.records.some(
      (record) => record.request_id === requestId && record.event === "admin_auth_failed" && record.domain === "admin"
    ),
    false
  );
});

test("cabinet flow emits canon-compliant cabinet events without schema violations", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-obs-flow-"));
  const port = 19_150 + Math.floor(Math.random() * 400);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "cabinet-obs.sqlite");

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>cabinet obs test</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret",
      CABINET_BOOTSTRAP_ADMIN: "1",
      CABINET_BOOTSTRAP_USERNAME: "obs-admin",
      CABINET_BOOTSTRAP_EMAIL: "obs-admin@example.com",
      CABINET_BOOTSTRAP_PASSWORD: "obs-admin-pass"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collector = createNdjsonCollector(server.stdout);
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const unauthorized = await fetch(`http://${host}:${port}/api/cabinet/session`);
  assert.equal(unauthorized.status, 401, `unexpected status: ${unauthorized.status}, stderr: ${stderr}`);
  const unauthorizedRequestId = unauthorized.headers.get("x-request-id");
  assert.ok(unauthorizedRequestId, "expected x-request-id header");

  const login = await fetch(`http://${host}:${port}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "obs-admin",
      password: "obs-admin-pass"
    })
  });
  assert.equal(login.status, 200, `unexpected status: ${login.status}, stderr: ${stderr}`);
  const loginRequestId = login.headers.get("x-request-id");
  assert.ok(loginRequestId, "expected x-request-id header");
  const sessionCookie = login.headers.get("set-cookie")?.split(";")[0] ?? null;
  assert.ok(sessionCookie, "expected cabinet session cookie");

  const materials = await fetch(`http://${host}:${port}/api/cabinet/materials`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(materials.status, 200, `unexpected status: ${materials.status}, stderr: ${stderr}`);
  const materialsRequestId = materials.headers.get("x-request-id");
  assert.ok(materialsRequestId, "expected x-request-id header");
  const materialsPayload = await materials.json();
  assert.ok(materialsPayload.items.length > 0, "expected materials");

  const open = await fetch(`http://${host}:${port}${materialsPayload.items[0].open_url}`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(open.status, 200, `unexpected status: ${open.status}, stderr: ${stderr}`);
  const openRequestId = open.headers.get("x-request-id");
  assert.ok(openRequestId, "expected x-request-id header");

  const logout = await fetch(`http://${host}:${port}/api/cabinet/logout`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(logout.status, 200, `unexpected status: ${logout.status}, stderr: ${stderr}`);
  const logoutRequestId = logout.headers.get("x-request-id");
  assert.ok(logoutRequestId, "expected x-request-id header");

  await waitForCondition(() =>
    collector.records.some(
      (record) =>
        record.request_id === unauthorizedRequestId &&
        record.event === "cabinet_auth_failed" &&
        record.domain === "cabinet"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === loginRequestId &&
        record.event === "cabinet_login_succeeded" &&
        record.domain === "cabinet"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === openRequestId &&
        record.event === "cabinet_material_open_completed" &&
        record.domain === "cabinet"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === logoutRequestId &&
        record.event === "cabinet_logout_succeeded" &&
        record.domain === "cabinet"
    )
  );

  const cabinetRequestIds = [unauthorizedRequestId, loginRequestId, materialsRequestId, openRequestId, logoutRequestId];
  for (const requestId of cabinetRequestIds) {
    assert.equal(
      collector.records.some(
        (record) => record.request_id === requestId && record.event === "obs.schema_violation_detected"
      ),
      false,
      `did not expect schema violation for ${requestId}`
    );
    assert.equal(
      collector.records.some((record) => record.request_id === requestId && record.event === "unknown"),
      false,
      `did not expect unknown event for ${requestId}`
    );
  }

  const authFailure = collector.records.find(
    (record) => record.request_id === unauthorizedRequestId && record.event === "cabinet_auth_failed"
  );
  assert.ok(authFailure, "expected cabinet_auth_failed");
  assert.equal(authFailure.error?.code, "cabinet.unauthorized");

  const loginSuccess = collector.records.find(
    (record) => record.request_id === loginRequestId && record.event === "cabinet_login_succeeded"
  );
  assert.ok(loginSuccess, "expected cabinet_login_succeeded");
  assert.equal(loginSuccess.payload?.role, "admin");

  const openCompleted = collector.records.find(
    (record) => record.request_id === openRequestId && record.event === "cabinet_material_open_completed"
  );
  assert.ok(openCompleted, "expected cabinet_material_open_completed");
  assert.equal(typeof openCompleted.duration_ms, "number");
});

test("admin /admin/obs/logs streams NDJSON with auth and limits", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-obs-endpoint-"));
  const port = 18_700 + Math.floor(Math.random() * 500);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "obs-test.sqlite");
  const fakeJournalctl = await createFakeJournalctlScript(tempDir, [
    createJsonEvent({ level: "info", event: "http_request_started", requestId: "req_http_1" }),
    createJsonEvent({ level: "info", event: "lead_submit_completed", requestId: "req_http_1" }),
    createJsonEvent({ level: "info", event: "http_request_completed", requestId: "req_http_1" })
  ]);

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret",
      OBS_LOG_SOURCE: "journald",
      OBS_JOURNALCTL_BIN: fakeJournalctl
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(
    `http://${host}:${port}/admin/obs/logs?since=2026-02-28T00:00:00Z&level=info&request_id=req_http_1&limit=2`,
    {
      headers: { "X-Admin-Secret": "test-admin-secret" }
    }
  );

  assert.equal(response.status, 200, `unexpected status: ${response.status}, stderr: ${stderr}`);
  assert.equal(response.headers.get("content-type")?.startsWith("application/x-ndjson"), true);
  const body = await response.text();
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  assert.equal(lines.length, 2);
  for (const line of lines) {
    const event = JSON.parse(line);
    assert.equal(event.level, "info");
    assert.equal(event.request_id, "req_http_1");
  }
});

test("admin /admin/obs/logs supports docker source via docker logs adapter", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "seminar-obs-endpoint-docker-"));
  const port = 18_100 + Math.floor(Math.random() * 500);
  const host = "127.0.0.1";
  const staticDir = path.join(tempDir, "static");
  const staticIndex = path.join(staticDir, "index.html");
  const databasePath = path.join(tempDir, "obs-docker-test.sqlite");
  await createFakeDockerLogsNodeScript(tempDir, [
    createJsonEvent({ level: "info", event: "http_request_started", requestId: "req_docker_1" }),
    createJsonEvent({ level: "info", event: "lead_submit_completed", requestId: "req_docker_1" }),
    createJsonEvent({ level: "warn", event: "landing_render_degraded", requestId: "req_docker_2" })
  ]);

  await mkdir(staticDir, { recursive: true });
  await writeFile(staticIndex, "<!doctype html><html><body>ok</body></html>", "utf8");

  const server = spawn(process.execPath, [path.resolve("server/index.mjs")], {
    cwd: tempDir,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STATIC_DIR: staticDir,
      DATABASE_PATH: databasePath,
      MIGRATIONS_DIR: path.resolve("migrations"),
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ADMIN_SECRET: "test-admin-secret",
      OBS_LOG_SOURCE: "docker",
      OBS_DOCKER_BIN: process.execPath,
      OBS_DOCKER_CONTAINER: "seminar-app"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const collector = createNdjsonCollector(server.stdout);

  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  t.after(async () => {
    await stopProcess(server);
    await rm(tempDir, { recursive: true, force: true });
  });

  await waitForServer(`http://${host}:${port}/api/healthz`);

  const response = await fetch(
    `http://${host}:${port}/admin/obs/logs?since=2026-02-28T00:00:00Z&level=info&request_id=req_docker_1&limit=10`,
    {
      headers: { "X-Admin-Secret": "test-admin-secret" }
    }
  );

  assert.equal(response.status, 200, `unexpected status: ${response.status}, stderr: ${stderr}`);
  assert.equal(response.headers.get("content-type")?.startsWith("application/x-ndjson"), true);
  const requestId = response.headers.get("x-request-id");
  assert.ok(requestId, "expected x-request-id header");
  const body = await response.text();
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  assert.equal(lines.length, 2);

  for (const line of lines) {
    const event = JSON.parse(line);
    assert.equal(event.level, "info");
    assert.equal(event.request_id, "req_docker_1");
  }

  await waitForCondition(() =>
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "obs_log_source_selected" &&
        record.domain === "obs" &&
        record.payload?.source === "docker"
    ) &&
    collector.records.some(
      (record) =>
        record.request_id === requestId &&
        record.event === "obs_log_retrieval_completed" &&
        record.domain === "obs" &&
        record.payload?.source === "docker" &&
        typeof record.payload?.emitted_count === "number" &&
        typeof record.payload?.emitted_bytes === "number"
    )
  );
});
