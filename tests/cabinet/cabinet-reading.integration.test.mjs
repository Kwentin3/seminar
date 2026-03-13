import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

test("cabinet material detail route requires auth and returns frontmatter-free markdown for in-app reading", async (t) => {
  const server = await startCabinetServer(t, {
    CABINET_BOOTSTRAP_USERNAME: "reader-admin",
    CABINET_BOOTSTRAP_EMAIL: "reader-admin@example.com",
    CABINET_BOOTSTRAP_PASSWORD: "reader-admin-pass"
  });

  const unauthorizedDetailResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/example-material`);
  assert.equal(unauthorizedDetailResponse.status, 401);
  assert.equal((await unauthorizedDetailResponse.json()).code, "cabinet_unauthorized");

  const loginResponse = await fetch(`${server.baseUrl}/api/cabinet/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: "reader-admin",
      password: "reader-admin-pass"
    })
  });
  assert.equal(loginResponse.status, 200);
  const sessionCookie = toCookieHeader(loginResponse.headers.get("set-cookie"));
  assert.ok(sessionCookie, "expected session cookie");

  const materialsResponse = await fetch(`${server.baseUrl}/api/cabinet/materials`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(materialsResponse.status, 200);
  const materialsPayload = await materialsResponse.json();
  assert.ok(materialsPayload.items.some((item) => item.material_status === "final"), "expected at least one final material");
  assert.ok(materialsPayload.items.some((item) => item.material_status === "working"), "expected at least one working material");
  assert.ok(
    materialsPayload.items.some((item) => item.recommended_for_lecture_prep === true),
    "expected lecture-prep recommendation signal"
  );
  assert.ok(
    materialsPayload.items.every((item) => typeof item.curation_reviewed_at === "string" && item.curation_reviewed_at.length > 0),
    "expected curator review date for curated library items"
  );
  const structuredOutputsItem = materialsPayload.items.find((item) => item.title === "Structured Outputs In Office Work");
  assert.ok(structuredOutputsItem, "expected structured outputs material");
  assert.equal(structuredOutputsItem.material_status, "final");
  assert.equal(structuredOutputsItem.theme, "Структурированные ответы");

  const workflowIntegrationItem = materialsPayload.items.find((item) => item.title === "Office Workflow Integration");
  assert.ok(workflowIntegrationItem, "expected workflow integration material");
  assert.equal(workflowIntegrationItem.material_status, "final");
  assert.equal(workflowIntegrationItem.theme, "Встраивание в workflow");

  const researchDirectionsItem = materialsPayload.items.find((item) => item.title === "LLM Office Work Research Directions");
  assert.ok(researchDirectionsItem, "expected research directions material");
  assert.equal(researchDirectionsItem.material_status, "draft");
  assert.equal(researchDirectionsItem.theme, "Следующие исследования");

  const markdownItem = materialsPayload.items.find((item) => item.reading_mode === "in_app" && item.read_url);
  assert.ok(markdownItem, "expected at least one markdown material readable in cabinet");
  assert.equal(typeof markdownItem.theme, "string");

  const detailResponse = await fetch(`${server.baseUrl}/api/cabinet/materials/${markdownItem.slug}`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  assert.equal(detailResponse.status, 200);
  const detailPayload = await detailResponse.json();
  assert.equal(detailPayload.item.slug, markdownItem.slug);
  assert.equal(detailPayload.item.read_url, `/cabinet/materials/${markdownItem.slug}`);
  assert.equal(detailPayload.item.reading_mode, "in_app");
  assert.equal(detailPayload.item.material_status, markdownItem.material_status);
  assert.equal(detailPayload.item.theme, markdownItem.theme);
  assert.equal(detailPayload.item.curation_reviewed_at, markdownItem.curation_reviewed_at);
  assert.equal(detailPayload.item.content.format, "markdown");
  assert.ok(detailPayload.item.content.markdown.length > 0, "expected markdown content");

  const firstNonEmptyLine = detailPayload.item.content.markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  assert.ok(firstNonEmptyLine?.startsWith("#"), "expected frontmatter-free markdown body to start with a heading");
});

function startCabinetServer(t, envOverrides = {}) {
  return new Promise(async (resolve, reject) => {
    const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-reading-"));
    const staticDir = path.join(fixtureDir, "static");
    const databasePath = path.join(fixtureDir, "cabinet.sqlite");
    const port = 19500 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://127.0.0.1:${port}`;

    await mkdir(staticDir, { recursive: true });
    await writeFile(path.join(staticDir, "index.html"), "<!doctype html><html><body>cabinet reading test</body></html>", {
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

    const exitPromise = new Promise((exitResolve) => {
      child.once("exit", exitResolve);
    });

    t.after(async () => {
      if (child.exitCode === null) {
        child.kill();
      }
      await exitPromise;
    });

    try {
      await waitForServerStarted(child);
      const normalizedStderr = stderr
        .replace(/\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/, "")
        .replace(/\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/, "")
        .trim();
      assert.equal(normalizedStderr, "");

      resolve({
        baseUrl,
        databasePath
      });
    } catch (error) {
      reject(error);
    }
  });
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
