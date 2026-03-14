import process from "node:process";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const BASE_URL = process.env.LEADS_BASE_URL ?? "http://127.0.0.1:8787";
const CABINET_LOGIN = process.env.CABINET_BOOTSTRAP_USERNAME ?? "local-admin";
const CABINET_PASSWORD = process.env.CABINET_BOOTSTRAP_PASSWORD ?? "local-admin-pass";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "dummy-admin-secret";
const SMOKE_HOST_HEADER = process.env.SMOKE_HOST_HEADER?.trim() || null;
const SKIP_LEGACY_ADMIN_CHECK = process.env.CABINET_SMOKE_SKIP_LEGACY_ADMIN === "1";

function withHeaders(headers = {}) {
  return SMOKE_HOST_HEADER ? { ...headers, Host: SMOKE_HOST_HEADER } : headers;
}

async function run() {
  await assertEndpoint("/api/healthz", 200);

  const sessionUnauthorized = await request("/api/cabinet/session");
  if (sessionUnauthorized.status !== 401) {
    throw new Error(`Expected 401 for unauthorized cabinet session, got ${sessionUnauthorized.status}`);
  }

  const loginResponse = await request("/api/cabinet/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      login: CABINET_LOGIN,
      password: CABINET_PASSWORD
    })
  });

  if (loginResponse.status !== 200) {
    throw new Error(`Expected 200 for cabinet login, got ${loginResponse.status}`);
  }

  const cookie = toCookieHeader(loginResponse.headers["set-cookie"]);
  if (!cookie) {
    throw new Error("Cabinet login did not return a session cookie.");
  }

  const sessionResponse = await request("/api/cabinet/session", {
    headers: {
      Cookie: cookie
    }
  });
  if (sessionResponse.status !== 200) {
    throw new Error(`Expected 200 for cabinet session, got ${sessionResponse.status}`);
  }
  const sessionPayload = parseJson(sessionResponse.body);

  const materialsResponse = await request("/api/cabinet/materials", {
    headers: {
      Cookie: cookie
    }
  });
  if (materialsResponse.status !== 200) {
    throw new Error(`Expected 200 for cabinet materials, got ${materialsResponse.status}`);
  }
  const materialsPayload = parseJson(materialsResponse.body);
  if (!Array.isArray(materialsPayload.items) || materialsPayload.items.length === 0) {
    throw new Error("Cabinet materials response is empty.");
  }

  if (sessionPayload.user?.role === "admin") {
    const adminUsersResponse = await request("/api/cabinet/admin/users", {
      headers: {
        Cookie: cookie
      }
    });
    if (adminUsersResponse.status !== 200) {
      throw new Error(`Expected 200 for cabinet admin users route, got ${adminUsersResponse.status}`);
    }
  }

  const firstMaterial = materialsPayload.items[0];
  const openResponse = await request(firstMaterial.open_url, {
    headers: {
      Cookie: cookie
    }
  });
  if (openResponse.status !== 200) {
    throw new Error(`Expected 200 for material open route, got ${openResponse.status}`);
  }

  const markdownItem = materialsPayload.items.find((item) => item.reading_mode === "in_app");
  if (markdownItem) {
    const simplifyStateResponse = await request(`/api/cabinet/materials/${markdownItem.slug}/simplify`, {
      headers: {
        Cookie: cookie
      }
    });
    if (simplifyStateResponse.status !== 200) {
      throw new Error(`Expected 200 for simplify state route, got ${simplifyStateResponse.status}`);
    }
  }

  const logoutResponse = await request("/api/cabinet/logout", {
    method: "POST",
    headers: {
      Cookie: cookie
    }
  });
  if (logoutResponse.status !== 200) {
    throw new Error(`Expected 200 for logout, got ${logoutResponse.status}`);
  }

  const materialsAfterLogout = await request("/api/cabinet/materials", {
    headers: {
      Cookie: cookie
    }
  });
  if (materialsAfterLogout.status !== 401) {
    throw new Error(`Expected 401 after logout, got ${materialsAfterLogout.status}`);
  }

  if (!SKIP_LEGACY_ADMIN_CHECK) {
    const adminWrong = await request("/api/admin/leads?limit=1", {
      headers: {
        "X-Admin-Secret": "wrong-secret"
      }
    });
    if (adminWrong.status !== 401) {
      throw new Error(`Expected 401 for legacy admin wrong secret, got ${adminWrong.status}`);
    }

    const adminOk = await request("/api/admin/leads?limit=1", {
      headers: {
        "X-Admin-Secret": ADMIN_SECRET
      }
    });
    if (adminOk.status !== 200) {
      throw new Error(`Expected 200 for legacy admin valid secret, got ${adminOk.status}`);
    }
  }

  console.log(
    `Cabinet smoke passed. materials=${materialsPayload.items.length} host=${SMOKE_HOST_HEADER ?? "default"} legacy_admin_check=${SKIP_LEGACY_ADMIN_CHECK ? "skip" : "full"}`
  );
}

async function assertEndpoint(path, expectedStatus) {
  const response = await request(path);
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} for ${path}, got ${response.status}`);
  }
}

function parseJson(value) {
  return JSON.parse(value);
}

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const transport = url.protocol === "https:" ? https : http;
  const headers = withHeaders(options.headers ?? {});

  return await new Promise((resolve, reject) => {
    const requestHandle = transport.request(
      url,
      {
        method: options.method ?? "GET",
        headers
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body
          });
        });
      }
    );

    requestHandle.on("error", reject);

    if (typeof options.body === "string" && options.body.length > 0) {
      requestHandle.write(options.body);
    }

    requestHandle.end();
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

function toCookieHeader(rawHeader) {
  if (Array.isArray(rawHeader)) {
    return rawHeader[0] ? rawHeader[0].split(";")[0] : null;
  }

  return typeof rawHeader === "string" ? rawHeader.split(";")[0] : null;
}
