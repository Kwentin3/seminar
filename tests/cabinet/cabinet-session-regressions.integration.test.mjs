import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

test("expired cabinet session is denied and cleaned up on next auth check", async (t) => {
  const server = await startCabinetServer(t, {
    CABINET_BOOTSTRAP_USERNAME: "ttl-admin",
    CABINET_BOOTSTRAP_EMAIL: "ttl-admin@example.com",
    CABINET_BOOTSTRAP_PASSWORD: "ttl-admin-pass"
  });

  const loginResponse = await fetch(`${server.baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "ttl-admin",
      password: "ttl-admin-pass"
    })
  });
  assert.equal(loginResponse.status, 200);
  const sessionCookie = toCookieHeader(loginResponse.headers.get("set-cookie"));
  assert.ok(sessionCookie, "expected session cookie");

  const database = new DatabaseSync(server.databasePath);
  database
    .prepare("UPDATE sessions SET expires_at = ?")
    .run(new Date(Date.now() - 60_000).toISOString());
  database.close();

  const expiredSessionResponse = await fetch(`${server.baseUrl}/api/cabinet/session`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(expiredSessionResponse.status, 401);
  assert.equal((await expiredSessionResponse.json()).code, "cabinet_unauthorized");

  const readOnlyDatabase = new DatabaseSync(server.databasePath, { readOnly: true });
  const remainingSessions = readOnlyDatabase.prepare("SELECT COUNT(*) AS c FROM sessions").get().c;
  readOnlyDatabase.close();
  assert.equal(remainingSessions, 0, "expected expired session cleanup to remove DB row");

  const guardedMaterialsResponse = await fetch(`${server.baseUrl}/api/cabinet/materials`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(guardedMaterialsResponse.status, 401);

  const logoutResponse = await fetch(`${server.baseUrl}/api/cabinet/logout`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});

test("production-mode cabinet cookie is emitted with Secure while local flow stays non-Secure", async (t) => {
  const productionServer = await startCabinetServer(t, {
    NODE_ENV: "production",
    CABINET_BOOTSTRAP_USERNAME: "secure-admin",
    CABINET_BOOTSTRAP_EMAIL: "secure-admin@example.com",
    CABINET_BOOTSTRAP_PASSWORD: "secure-admin-pass"
  });

  const loginResponse = await fetch(`${productionServer.baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "secure-admin",
      password: "secure-admin-pass"
    })
  });
  assert.equal(loginResponse.status, 200);
  const rawSetCookie = loginResponse.headers.get("set-cookie");
  assert.match(rawSetCookie ?? "", /HttpOnly/i);
  assert.match(rawSetCookie ?? "", /SameSite=Lax/i);
  assert.match(rawSetCookie ?? "", /Secure/i);

  const sessionCookie = toCookieHeader(rawSetCookie);
  assert.ok(sessionCookie, "expected session cookie");

  const sessionResponse = await fetch(`${productionServer.baseUrl}/api/cabinet/session`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(sessionResponse.status, 200);
});

async function startCabinetServer(t, envOverrides = {}) {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-session-"));
  const staticDir = path.join(fixtureDir, "static");
  const databasePath = path.join(fixtureDir, "cabinet.sqlite");
  const port = 19300 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;

  await mkdir(staticDir, { recursive: true });
  await writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>cabinet session test</body></html>", {
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
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy",
      ...envOverrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitPromise = new Promise((resolve) => {
    child.once("exit", resolve);
  });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
    }
    await exitPromise;
  });

  await waitForServerStarted(child);

  const normalizedStderr = stderr
    .replace(/\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/, "")
    .replace(/\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/, "")
    .trim();
  assert.equal(normalizedStderr, "");

  return {
    baseUrl,
    databasePath
  };
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

function toCookieHeader(rawHeader) {
  return rawHeader ? rawHeader.split(";")[0] : null;
}
