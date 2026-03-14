import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

test("cabinet admin can create viewer users, reset passwords, and deactivate/reactivate access", async (t) => {
  const server = await startServer(t);
  const adminCookie = await login(server.baseUrl, "users-admin", "users-admin-pass");

  const initialListResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users`, {
    headers: {
      Cookie: adminCookie
    }
  });
  assert.equal(initialListResponse.status, 200);
  const initialListPayload = await initialListResponse.json();
  assert.ok(initialListPayload.items.some((item) => item.username === "users-admin" && item.role === "admin"));

  const createResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: "lecturer-oleg",
      email: "oleg@example.com",
      password: "viewer-pass-1"
    })
  });
  assert.equal(createResponse.status, 200);
  const createPayload = await createResponse.json();
  assert.equal(createPayload.item.role, "viewer");
  assert.equal(createPayload.item.username, "lecturer-oleg");
  assert.equal(createPayload.item.is_active, true);

  const viewerCookie = await login(server.baseUrl, "oleg@example.com", "viewer-pass-1");
  const viewerSessionResponse = await fetch(`${server.baseUrl}/api/cabinet/session`, {
    headers: {
      Cookie: viewerCookie
    }
  });
  assert.equal(viewerSessionResponse.status, 200);
  assert.equal((await viewerSessionResponse.json()).user.role, "viewer");

  const viewerForbiddenResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users`, {
    headers: {
      Cookie: viewerCookie
    }
  });
  assert.equal(viewerForbiddenResponse.status, 403);
  assert.equal((await viewerForbiddenResponse.json()).code, "cabinet_forbidden");

  const resetResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users/${createPayload.item.id}/reset-password`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      password: "viewer-pass-2"
    })
  });
  assert.equal(resetResponse.status, 200);
  const resetPayload = await resetResponse.json();
  assert.equal(resetPayload.item.id, createPayload.item.id);

  const oldSessionAfterReset = await fetch(`${server.baseUrl}/api/cabinet/session`, {
    headers: {
      Cookie: viewerCookie
    }
  });
  assert.equal(oldSessionAfterReset.status, 401);

  const oldPasswordAfterReset = await fetch(`${server.baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "oleg@example.com",
      password: "viewer-pass-1"
    })
  });
  assert.equal(oldPasswordAfterReset.status, 401);

  const viewerCookieAfterReset = await login(server.baseUrl, "lecturer-oleg", "viewer-pass-2");

  const deactivateResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users/${createPayload.item.id}/set-active`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      is_active: false
    })
  });
  assert.equal(deactivateResponse.status, 200);
  const deactivatePayload = await deactivateResponse.json();
  assert.equal(deactivatePayload.item.is_active, false);

  const viewerSessionAfterDeactivate = await fetch(`${server.baseUrl}/api/cabinet/session`, {
    headers: {
      Cookie: viewerCookieAfterReset
    }
  });
  assert.equal(viewerSessionAfterDeactivate.status, 401);

  const loginWhileInactive = await fetch(`${server.baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "oleg@example.com",
      password: "viewer-pass-2"
    })
  });
  assert.equal(loginWhileInactive.status, 401);

  const reactivateResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users/${createPayload.item.id}/set-active`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      is_active: true
    })
  });
  assert.equal(reactivateResponse.status, 200);
  const reactivatePayload = await reactivateResponse.json();
  assert.equal(reactivatePayload.item.is_active, true);

  const loginAfterReactivate = await fetch(`${server.baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "oleg@example.com",
      password: "viewer-pass-2"
    })
  });
  assert.equal(loginAfterReactivate.status, 200);

  const selfDeactivateResponse = await fetch(`${server.baseUrl}/api/cabinet/admin/users/${initialListPayload.items[0].id}/set-active`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      is_active: false
    })
  });
  assert.equal(selfDeactivateResponse.status, 403);
  assert.equal((await selfDeactivateResponse.json()).code, "cabinet_forbidden");
});

async function startServer(t) {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-admin-users-"));
  const staticDir = path.join(fixtureDir, "static");
  const databasePath = path.join(fixtureDir, "cabinet.sqlite");
  const port = 19700 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;

  await mkdir(staticDir, { recursive: true });
  await writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>cabinet admin users test</body></html>", {
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
      CABINET_BOOTSTRAP_USERNAME: "users-admin",
      CABINET_BOOTSTRAP_EMAIL: "users-admin@example.com",
      CABINET_BOOTSTRAP_PASSWORD: "users-admin-pass",
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: "dummy"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
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
    databasePath
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
