import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
