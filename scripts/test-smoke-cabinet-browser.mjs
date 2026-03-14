import process from "node:process";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { chromium } from "playwright";

const EXTERNAL_SERVER = process.env.CABINET_BROWSER_SMOKE_USE_EXISTING_SERVER === "1";
const BASE_URL = process.env.LEADS_BASE_URL ?? "http://127.0.0.1:8787";
const CABINET_LOGIN = process.env.CABINET_BOOTSTRAP_USERNAME ?? "local-admin";
const CABINET_PASSWORD = process.env.CABINET_BOOTSTRAP_PASSWORD ?? "local-admin-pass";

async function run() {
  const managedProvider = EXTERNAL_SERVER ? null : await startStubDeepSeek();
  const managedServer = EXTERNAL_SERVER ? null : await startManagedServer(managedProvider);
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "0"
  });

  try {
    const baseUrl = managedServer?.baseUrl ?? BASE_URL;
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseUrl}/cabinet`, {
      waitUntil: "networkidle"
    });
    await page.waitForURL(/\/cabinet\/login(?:\?|$)/);

    await page.getByLabel(/Логин или email|Username or email/).fill(CABINET_LOGIN);
    await page.getByLabel(/Пароль|Password/).fill(CABINET_PASSWORD);

    await Promise.all([
      page.waitForURL(/\/cabinet(?:\?|$)/),
      page.getByRole("button", { name: /Войти|Sign in/ }).click()
    ]);

    await page.getByRole("heading", { name: /Библиотека материалов|Materials library/ }).waitFor();
    await page.getByText(/С чего начать|Start here/).waitFor();
    await page.getByLabel(/Статус|Status/).selectOption("final");
    await page.locator("article").first().getByText(/Опорный|Anchor/).first().waitFor();
    await page.locator("article").first().getByText(/Проверено куратором|Curator reviewed/).waitFor();
    await page.getByRole("link", { name: /Читать в кабинете|Read in cabinet/ }).first().waitFor();
    await page.getByRole("link", { name: /Пользователи|Users/ }).click();
    await page.waitForURL(/\/cabinet\/admin\/users$/);
    await page.getByRole("heading", { name: /Пользователи кабинета|Cabinet users/ }).waitFor();
    await page.getByRole("button", { name: /Создать lecturer|Create lecturer/ }).waitFor();

    await Promise.all([
      page.waitForURL(/\/cabinet(?:\?|$)/),
      page.getByRole("link", { name: /Назад к библиотеке|Back to library/ }).click()
    ]);

    await page.getByRole("heading", { name: /Библиотека материалов|Materials library/ }).waitFor();

    await Promise.all([
      page.waitForURL(/\/cabinet\/materials\/[^/]+$/),
      page.getByRole("link", { name: /Читать в кабинете|Read in cabinet/ }).first().click()
    ]);

    await page.getByRole("link", { name: /Назад к библиотеке|Back to library/ }).waitFor();
      await page.getByText(/Коротко о материале|Quick facts/).waitFor();
      await page.getByText(/Контекст материала|Material context/).waitFor();
      await page.getByText(/Проверено куратором|Curator reviewed/).first().waitFor();
      await page.locator("article").first().waitFor();

      await page.getByRole("button", { name: /Пересказать простым языком|Explain simply/ }).click();
      await page.getByRole("tab", { name: /Простым языком|Simplified/ }).waitFor();
      await page.getByText(/Упрощённый пересказ #1/).waitFor();
      await page.getByText(/Это упрощённый LLM-пересказ|This is an LLM-generated simplification/).waitFor();
      await page.getByRole("button", { name: /Перегенерировать|Regenerate/ }).click();
      await page.getByText(/Упрощённый пересказ #2/).waitFor();
      await page.getByRole("tab", { name: /Оригинал|Original/ }).click();

      await Promise.all([
        page.waitForURL(/\/cabinet(?:\?|$)/),
        page.getByRole("link", { name: /Назад к библиотеке|Back to library/ }).click()
    ]);

    await Promise.all([
      page.waitForURL(/\/cabinet\/login(?:\?|$)/),
      page.getByRole("button", { name: /Выйти|Logout/ }).click()
    ]);

    await page.goto(`${baseUrl}/cabinet`, {
      waitUntil: "networkidle"
    });
    await page.waitForURL(/\/cabinet\/login(?:\?|$)/);

    console.log(`Cabinet browser smoke passed. baseUrl=${baseUrl}`);
  } finally {
    await browser.close();
    if (managedServer) {
      await managedServer.stop();
    }
    if (managedProvider) {
      await managedProvider.stop();
    }
  }
}

async function startManagedServer(provider) {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), "seminar-cabinet-browser-smoke-"));
  const databasePath = path.join(fixtureDir, "cabinet-browser.sqlite");
  const port = 19400 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: databasePath,
      ADMIN_SECRET: process.env.ADMIN_SECRET ?? "browser-smoke-admin-secret",
      CABINET_BOOTSTRAP_ADMIN: "1",
      CABINET_BOOTSTRAP_USERNAME: CABINET_LOGIN,
      CABINET_BOOTSTRAP_EMAIL: process.env.CABINET_BOOTSTRAP_EMAIL ?? "browser-smoke-admin@example.com",
      CABINET_BOOTSTRAP_PASSWORD: CABINET_PASSWORD,
      TURNSTILE_MODE: "mock",
      ALLOW_TURNSTILE_MOCK: "1",
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "dummy",
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? "browser-smoke-deepseek-key",
      DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL ?? provider?.baseUrl
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  await waitForServerStarted(child);

  const normalizedStderr = stderr
    .replace(/\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/, "")
    .replace(/\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/, "")
    .trim();
  if (normalizedStderr.length > 0) {
    throw new Error(`Managed browser-smoke server wrote to stderr:\n${normalizedStderr}`);
  }

  return {
    baseUrl,
    async stop() {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => {
          child.once("exit", resolve);
        });
      }
      await rm(fixtureDir, { recursive: true, force: true });
    }
  };
}

async function startStubDeepSeek() {
  let requestCount = 0;
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    requestCount += 1;
    for await (const _chunk of request) {
      // consume body
    }

    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: `# Упрощённый пересказ #${requestCount}\n\nКороткая версия материала для smoke.`
            }
          }
        ]
      })
    );
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async stop() {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
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

run().catch((error) => {
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
