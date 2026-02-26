import { spawnSync } from "node:child_process";
import process from "node:process";

const BASE_URL = process.env.LEADS_BASE_URL ?? "http://127.0.0.1:8788";
const D1_DATABASE = process.env.D1_DATABASE_NAME ?? "seminar-leads";
const SERVER_READY_TIMEOUT_MS = 10_000;
const SERVER_READY_INTERVAL_MS = 500;

async function run() {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const phoneFactory = createPhoneFactory();
  const source = `landing-smoke-${suffix}`;

  await assertDevServerIsReachable();

  const happyIp = randomTestIp();
  const happyPhone = phoneFactory();
  const happyPayload = {
    name: "Smoke Lead",
    phone: happyPhone,
    locale: "ru",
    source: `${source}-happy`,
    turnstile_token: "dev-ok"
  };

  const happyResult = await postLead(happyPayload, {
    "CF-Connecting-IP": happyIp
  });
  assertNoServerError(happyResult, "happy-path");
  if (happyResult.status !== 200) {
    throw new Error(`Expected 200 for happy-path, got ${happyResult.status}: ${happyResult.rawBody}`);
  }

  const happyBody = safeJsonParse(happyResult.rawBody);
  if (!isSuccessLeadResponse(happyBody)) {
    throw new Error(`Unexpected happy-path response body: ${happyResult.rawBody}`);
  }

  assertLeadExistsInLocalD1(happyBody.lead_id);

  const duplicatePayload = {
    ...happyPayload,
    source: `${source}-duplicate`
  };
  const duplicateResult = await postLead(duplicatePayload, {
    "CF-Connecting-IP": happyIp
  });
  assertNoServerError(duplicateResult, "duplicate-path");
  assertApiError(duplicateResult, 409, "duplicate_lead");

  const failPayload = {
    ...happyPayload,
    source: `${source}-fail`,
    phone: phoneFactory(),
    turnstile_token: "dev-fail"
  };
  const failResult = await postLead(failPayload, {
    "CF-Connecting-IP": randomTestIp()
  });
  assertNoServerError(failResult, "turnstile-fail-path");
  if (failResult.status < 400 || failResult.status >= 500) {
    throw new Error(`Expected 4xx for fail-path, got ${failResult.status}: ${failResult.rawBody}`);
  }
  const failBody = safeJsonParse(failResult.rawBody);
  if (!isApiErrorWithCode(failBody, "turnstile_failed")) {
    throw new Error(`Expected turnstile_failed error, got: ${failResult.rawBody}`);
  }

  const rateIp = randomTestIp();
  for (let i = 0; i < 5; i += 1) {
    const ratePayload = {
      name: `Rate Lead ${i + 1}`,
      phone: phoneFactory(),
      locale: "ru",
      source: `${source}-rate-${i + 1}`,
      turnstile_token: "dev-ok"
    };
    const rateResult = await postLead(ratePayload, {
      "CF-Connecting-IP": rateIp
    });
    assertNoServerError(rateResult, `rate-path-${i + 1}`);
    if (rateResult.status !== 200) {
      throw new Error(
        `Expected 200 for rate-path call ${i + 1}, got ${rateResult.status}: ${rateResult.rawBody}`
      );
    }
  }

  const rateLimitedPayload = {
    name: "Rate Lead 6",
    phone: phoneFactory(),
    locale: "ru",
    source: `${source}-rate-6`,
    turnstile_token: "dev-ok"
  };
  const rateLimitedResult = await postLead(rateLimitedPayload, {
    "CF-Connecting-IP": rateIp
  });
  assertNoServerError(rateLimitedResult, "rate-limited-path");
  assertApiError(rateLimitedResult, 429, "rate_limited");

  console.log(
    `Smoke leads passed. lead_id=${happyBody.lead_id} duplicate=409 rate_limited=429`
  );
}

async function assertDevServerIsReachable() {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`, { method: "GET" });
      if (response.ok) {
        return;
      }

      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(SERVER_READY_INTERVAL_MS);
  }

  throw new Error(`Pages dev is not reachable at ${BASE_URL} within ${SERVER_READY_TIMEOUT_MS}ms (${lastError}).`);
}

async function postLead(payload, headers = {}) {
  try {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(payload)
    });

    const rawBody = await response.text();
    return {
      status: response.status,
      rawBody
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`POST /api/leads failed: ${message}`);
  }
}

function assertApiError(result, expectedStatus, expectedCode) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus} with code ${expectedCode}, got ${result.status}: ${result.rawBody}`
    );
  }

  const payload = safeJsonParse(result.rawBody);
  if (!isApiErrorWithCode(payload, expectedCode)) {
    throw new Error(`Expected ${expectedCode} error, got: ${result.rawBody}`);
  }
}

function isApiErrorWithCode(payload, expectedCode) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      payload.code === expectedCode &&
      typeof payload.message === "string"
  );
}

function assertLeadExistsInLocalD1(leadId) {
  const safeLeadId = escapeSqlLiteral(leadId);
  const count = queryCount(`SELECT COUNT(*) AS c FROM leads WHERE id='${safeLeadId}'`);
  if (count !== 1) {
    throw new Error(`Lead id ${leadId} was not found in local D1 (count=${count}).`);
  }
}

function queryCount(query) {
  const result = runWranglerD1Query(query);
  const count = extractCountFromD1Result(result.json);
  if (count === null) {
    throw new Error(`Unexpected D1 query output: ${result.raw}`);
  }

  return count;
}

function runWranglerD1Query(query) {
  const pnpmExecPath = process.env.npm_execpath;
  if (!pnpmExecPath) {
    throw new Error("npm_execpath is not set; cannot run wrangler through pnpm.");
  }

  const result = spawnSync(
    process.execPath,
    [pnpmExecPath, "exec", "wrangler", "d1", "execute", D1_DATABASE, "--local", "--command", query, "--json"],
    {
      encoding: "utf8",
      env: process.env
    }
  );

  if (result.error) {
    throw new Error(`Failed to start wrangler process: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Failed to query local D1.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  const parsed = parseWranglerJsonOutput(result.stdout);
  return {
    json: parsed,
    raw: result.stdout
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseWranglerJsonOutput(raw) {
  const direct = safeJsonParse(raw.trim());
  if (direct !== null) {
    return direct;
  }

  const match = raw.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/);
  if (!match) {
    return null;
  }

  return safeJsonParse(match[1]);
}

function extractCountFromD1Result(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const first = payload[0];
  if (!first || !Array.isArray(first.results) || first.results.length === 0) {
    return null;
  }

  const rawCount = first.results[0]?.c;
  if (typeof rawCount === "number") {
    return rawCount;
  }

  if (typeof rawCount === "string") {
    const parsed = Number(rawCount);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isSuccessLeadResponse(payload) {
  return Boolean(
    payload &&
      payload.ok === true &&
      typeof payload.lead_id === "string" &&
      payload.lead_id.length > 0
  );
}

function assertNoServerError(result, stage) {
  if (result.status >= 500) {
    throw new Error(`[${stage}] Received ${result.status} from /api/leads. Body: ${result.rawBody}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function escapeSqlLiteral(value) {
  return value.replaceAll("'", "''");
}

let ipCursor = Number(Date.now() % 200);

function randomTestIp() {
  ipCursor = (ipCursor + 37) % 200;
  return `203.0.113.${ipCursor + 20}`;
}

function createPhoneFactory() {
  let counter = 0;
  const seed = Date.now() % 10_000_000;

  return () => {
    counter += 1;
    const value = seed + counter;
    const nxx = 600 + Math.floor((value / 10_000) % 400);
    const line = String(value % 10_000).padStart(4, "0");
    return `+1415${nxx}${line}`;
  };
}

run().catch((error) => {
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    if (error.cause) {
      console.error("cause:", error.cause);
    }
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
