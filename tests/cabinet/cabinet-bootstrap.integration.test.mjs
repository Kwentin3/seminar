import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

test("bootstrap admin is create-first and only resets when CABINET_BOOTSTRAP_ALLOW_RESET=1", async (t) => {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-bootstrap-"));
  const staticDir = path.join(fixtureDir, "static");
  const databasePath = path.join(fixtureDir, "cabinet.sqlite");

  await mkdir(staticDir, { recursive: true });
  await writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>bootstrap test</body></html>", {
    encoding: "utf8"
  });

  const baseEnv = {
    ...process.env,
    HOST: "127.0.0.1",
    STATIC_DIR: staticDir,
    DATABASE_PATH: databasePath,
    ADMIN_SECRET: "test-admin-secret",
    CABINET_BOOTSTRAP_ADMIN: "1",
    CABINET_BOOTSTRAP_USERNAME: "bootstrap-admin",
    CABINET_BOOTSTRAP_EMAIL: "bootstrap@example.com",
    TURNSTILE_MODE: "mock",
    ALLOW_TURNSTILE_MOCK: "1",
    TURNSTILE_SECRET_KEY: "dummy"
  };

  const firstRun = await startServer(t, {
    ...baseEnv,
    PORT: "19210",
    CABINET_BOOTSTRAP_PASSWORD: "first-admin-pass"
  });
  await assertLogin(`${firstRun.baseUrl}/api/cabinet/login`, "bootstrap-admin", "first-admin-pass", 200);
  assert.match(firstRun.stdout(), /"status":"created"/);
  await firstRun.stop();

  const secondRun = await startServer(t, {
    ...baseEnv,
    PORT: "19211",
    CABINET_BOOTSTRAP_PASSWORD: "second-admin-pass"
  });
  await assertLogin(`${secondRun.baseUrl}/api/cabinet/login`, "bootstrap-admin", "second-admin-pass", 401);
  await assertLogin(`${secondRun.baseUrl}/api/cabinet/login`, "bootstrap-admin", "first-admin-pass", 200);
  assert.match(secondRun.stdout(), /bootstrap_flag_left_enabled_without_reset/);
  await secondRun.stop();

  const thirdRun = await startServer(t, {
    ...baseEnv,
    PORT: "19212",
    CABINET_BOOTSTRAP_PASSWORD: "third-admin-pass",
    CABINET_BOOTSTRAP_ALLOW_RESET: "1"
  });
  await assertLogin(`${thirdRun.baseUrl}/api/cabinet/login`, "bootstrap-admin", "third-admin-pass", 200);
  await assertLogin(`${thirdRun.baseUrl}/api/cabinet/login`, "bootstrap-admin", "first-admin-pass", 401);
  assert.match(thirdRun.stdout(), /"status":"updated"/);
  await thirdRun.stop();
});

async function startServer(t, env) {
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  const exitPromise = new Promise((resolve) => {
    child.once("exit", resolve);
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const stop = async () => {
    if (child.exitCode === null) {
      child.kill();
    }
    await exitPromise;
  };

  t.after(stop);
  await waitForServerStarted(child);

  const normalizedStderr = () =>
    stderr
      .replace(/\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/, "")
      .replace(/\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/, "")
      .trim();

  assert.equal(normalizedStderr(), "");

  return {
    baseUrl: `http://127.0.0.1:${env.PORT}`,
    stdout: () => stdout,
    stop
  };
}

async function assertLogin(url, login, password, expectedStatus) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login,
      password
    })
  });

  assert.equal(response.status, expectedStatus);
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
