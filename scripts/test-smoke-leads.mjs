import process from "node:process";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const BASE_URL = process.env.LEADS_BASE_URL ?? "http://127.0.0.1:8787";
const DATABASE_PATH = process.env.DATABASE_PATH ?? resolve(process.cwd(), "data", "seminar.sqlite");
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
    "X-Forwarded-For": happyIp,
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

  assertLeadExistsInLocalSqlite(happyBody.lead_id);

  const duplicatePayload = {
    ...happyPayload,
    source: `${source}-duplicate`
  };
  const duplicateResult = await postLead(duplicatePayload, {
    "X-Forwarded-For": happyIp,
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
  const failIp = randomTestIp();
  const failResult = await postLead(failPayload, {
    "X-Forwarded-For": failIp,
    "CF-Connecting-IP": failIp
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
      "X-Forwarded-For": rateIp,
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
    "X-Forwarded-For": rateIp,
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

  throw new Error(`Server is not reachable at ${BASE_URL} within ${SERVER_READY_TIMEOUT_MS}ms (${lastError}).`);
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

function assertLeadExistsInLocalSqlite(leadId) {
  const database = new DatabaseSync(DATABASE_PATH);
  let count = null;
  try {
    const row = database.prepare("SELECT COUNT(*) AS c FROM leads WHERE id = ?").get(leadId);
    if (typeof row?.c === "number") {
      count = row.c;
    } else if (typeof row?.c === "bigint") {
      count = Number(row.c);
    } else if (typeof row?.c === "string") {
      const parsed = Number(row.c);
      count = Number.isFinite(parsed) ? parsed : null;
    }
  } finally {
    database.close();
  }

  if (count !== 1) {
    throw new Error(`Lead id ${leadId} was not found in local SQLite (${DATABASE_PATH}) (count=${count}).`);
  }
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
