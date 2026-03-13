import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

test("cabinet auth flow protects materials and preserves legacy admin access", async (t) => {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-"));
  const staticDir = path.join(fixtureDir, "static");
  const databasePath = path.join(fixtureDir, "cabinet.sqlite");
  const port = 19100 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;

  await mkdir(staticDir, { recursive: true });
  await writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>cabinet test</body></html>", {
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
      CABINET_BOOTSTRAP_USERNAME: "test-admin",
      CABINET_BOOTSTRAP_EMAIL: "admin@example.com",
      CABINET_BOOTSTRAP_PASSWORD: "test-admin-pass",
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  t.after(async () => {
    child.kill();
    await new Promise((resolve) => {
      child.once("exit", resolve);
    });
  });

  await waitForServerStarted(child);

  const unauthorizedSession = await fetch(`${baseUrl}/api/cabinet/session`);
  assert.equal(unauthorizedSession.status, 401);
  assert.equal((await unauthorizedSession.json()).code, "cabinet_unauthorized");

  const loginResponse = await fetch(`${baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "test-admin",
      password: "test-admin-pass"
    })
  });
  assert.equal(loginResponse.status, 200);
  const rawSetCookie = loginResponse.headers.get("set-cookie");
  assert.match(rawSetCookie ?? "", /HttpOnly/i);
  assert.match(rawSetCookie ?? "", /SameSite=Lax/i);
  assert.doesNotMatch(rawSetCookie ?? "", /Secure/i);
  const sessionCookie = toCookieHeader(loginResponse.headers.get("set-cookie"));
  assert.ok(sessionCookie, "expected session cookie");

  const sessionResponse = await fetch(`${baseUrl}/api/cabinet/session`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(sessionResponse.status, 200);
  const sessionPayload = await sessionResponse.json();
  assert.equal(sessionPayload.user.role, "admin");

  const materialsResponse = await fetch(`${baseUrl}/api/cabinet/materials`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(materialsResponse.status, 200);
  const materialsPayload = await materialsResponse.json();
  assert.ok(materialsPayload.items.length > 0, "expected seeded materials");

  const firstMaterial = materialsPayload.items[0];
  const openResponse = await fetch(`${baseUrl}${firstMaterial.open_url}`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(openResponse.status, 200);
  assert.ok((await openResponse.arrayBuffer()).byteLength > 0, "expected material body");

  const logoutResponse = await fetch(`${baseUrl}/api/cabinet/logout`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(logoutResponse.status, 200);

  const materialsAfterLogout = await fetch(`${baseUrl}/api/cabinet/materials`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(materialsAfterLogout.status, 401);

  const adminWrongSecret = await fetch(`${baseUrl}/api/admin/leads?limit=1`, {
    headers: {
      "X-Admin-Secret": "wrong-secret"
    }
  });
  assert.equal(adminWrongSecret.status, 401);

  const cabinetWithAdminSecretOnly = await fetch(`${baseUrl}/api/cabinet/materials`, {
    headers: {
      "X-Admin-Secret": "test-admin-secret"
    }
  });
  assert.equal(cabinetWithAdminSecretOnly.status, 401);

  const adminWithCabinetSessionOnly = await fetch(`${baseUrl}/api/admin/leads?limit=1`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(adminWithCabinetSessionOnly.status, 401);

  const adminValidSecret = await fetch(`${baseUrl}/api/admin/leads?limit=1`, {
    headers: {
      "X-Admin-Secret": "test-admin-secret"
    }
  });
  assert.equal(adminValidSecret.status, 200);

  const database = new DatabaseSync(databasePath, { readOnly: true });
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
  database.close();

  assert.ok(tables.includes("users"), "expected users table");
  assert.ok(tables.includes("sessions"), "expected sessions table");
  assert.ok(tables.includes("materials"), "expected materials table");
  assert.match(stdout, /runtime_server_started/);
  const normalizedStderr = stderr
    .replace(/\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/, "")
    .replace(/\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/, "")
    .trim();
  assert.equal(normalizedStderr, "");
});

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
