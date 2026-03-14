import process from "node:process";

const BASE_URL = process.env.LEADS_BASE_URL ?? "http://127.0.0.1:8787";
const CABINET_LOGIN = process.env.CABINET_BOOTSTRAP_USERNAME ?? "local-admin";
const CABINET_PASSWORD = process.env.CABINET_BOOTSTRAP_PASSWORD ?? "local-admin-pass";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "dummy-admin-secret";

async function run() {
  await assertEndpoint("/api/healthz", 200);

  const sessionUnauthorized = await fetch(`${BASE_URL}/api/cabinet/session`);
  if (sessionUnauthorized.status !== 401) {
    throw new Error(`Expected 401 for unauthorized cabinet session, got ${sessionUnauthorized.status}`);
  }

  const loginResponse = await fetch(`${BASE_URL}/api/cabinet/login`, {
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

  const cookie = toCookieHeader(loginResponse.headers.get("set-cookie"));
  if (!cookie) {
    throw new Error("Cabinet login did not return a session cookie.");
  }

  const sessionResponse = await fetch(`${BASE_URL}/api/cabinet/session`, {
    headers: {
      Cookie: cookie
    }
  });
  if (sessionResponse.status !== 200) {
    throw new Error(`Expected 200 for cabinet session, got ${sessionResponse.status}`);
  }

  const materialsResponse = await fetch(`${BASE_URL}/api/cabinet/materials`, {
    headers: {
      Cookie: cookie
    }
  });
  if (materialsResponse.status !== 200) {
    throw new Error(`Expected 200 for cabinet materials, got ${materialsResponse.status}`);
  }
  const materialsPayload = await materialsResponse.json();
  if (!Array.isArray(materialsPayload.items) || materialsPayload.items.length === 0) {
    throw new Error("Cabinet materials response is empty.");
  }

  const firstMaterial = materialsPayload.items[0];
  const openResponse = await fetch(`${BASE_URL}${firstMaterial.open_url}`, {
    headers: {
      Cookie: cookie
    }
  });
  if (openResponse.status !== 200) {
    throw new Error(`Expected 200 for material open route, got ${openResponse.status}`);
  }

  const markdownItem = materialsPayload.items.find((item) => item.reading_mode === "in_app");
  if (markdownItem) {
    const simplifyStateResponse = await fetch(`${BASE_URL}/api/cabinet/materials/${markdownItem.slug}/simplify`, {
      headers: {
        Cookie: cookie
      }
    });
    if (simplifyStateResponse.status !== 200) {
      throw new Error(`Expected 200 for simplify state route, got ${simplifyStateResponse.status}`);
    }
  }

  const logoutResponse = await fetch(`${BASE_URL}/api/cabinet/logout`, {
    method: "POST",
    headers: {
      Cookie: cookie
    }
  });
  if (logoutResponse.status !== 200) {
    throw new Error(`Expected 200 for logout, got ${logoutResponse.status}`);
  }

  const materialsAfterLogout = await fetch(`${BASE_URL}/api/cabinet/materials`, {
    headers: {
      Cookie: cookie
    }
  });
  if (materialsAfterLogout.status !== 401) {
    throw new Error(`Expected 401 after logout, got ${materialsAfterLogout.status}`);
  }

  const adminWrong = await fetch(`${BASE_URL}/api/admin/leads?limit=1`, {
    headers: {
      "X-Admin-Secret": "wrong-secret"
    }
  });
  if (adminWrong.status !== 401) {
    throw new Error(`Expected 401 for legacy admin wrong secret, got ${adminWrong.status}`);
  }

  const adminOk = await fetch(`${BASE_URL}/api/admin/leads?limit=1`, {
    headers: {
      "X-Admin-Secret": ADMIN_SECRET
    }
  });
  if (adminOk.status !== 200) {
    throw new Error(`Expected 200 for legacy admin valid secret, got ${adminOk.status}`);
  }

  console.log(`Cabinet smoke passed. materials=${materialsPayload.items.length}`);
}

async function assertEndpoint(path, expectedStatus) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} for ${path}, got ${response.status}`);
  }
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
  return rawHeader ? rawHeader.split(";")[0] : null;
}
