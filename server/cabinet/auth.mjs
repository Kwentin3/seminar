import { createHash, randomBytes, randomUUID } from "node:crypto";

function readCookieValue(cookieHeader, name) {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const entry of cookies) {
    const [rawName, ...rawValue] = entry.split("=");
    if (rawName?.trim() !== name) {
      continue;
    }

    const joined = rawValue.join("=").trim();
    if (!joined) {
      return null;
    }

    try {
      return decodeURIComponent(joined);
    } catch {
      return joined;
    }
  }

  return null;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toIso(date) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

export function createCabinetAuthState() {
  return {
    failedAttempts: new Map()
  };
}

export function createLoginAttemptKey(login, ipAddress) {
  return `${(login ?? "").toLowerCase()}::${ipAddress ?? "unknown"}`;
}

export function registerFailedLoginAttempt(state, key, now, config) {
  pruneExpiredAttempts(state, now, config);
  const existing = state.failedAttempts.get(key) ?? [];
  existing.push(now);
  state.failedAttempts.set(key, existing);
}

export function clearFailedLoginAttempts(state, key) {
  state.failedAttempts.delete(key);
}

export function isLoginRateLimited(state, key, now, config) {
  pruneExpiredAttempts(state, now, config);
  const timestamps = state.failedAttempts.get(key) ?? [];
  return timestamps.length >= config.loginMaxAttempts;
}

function pruneExpiredAttempts(state, now, config) {
  for (const [key, timestamps] of state.failedAttempts.entries()) {
    const filtered = timestamps.filter((timestamp) => now - timestamp < config.loginWindowMs);
    if (filtered.length === 0) {
      state.failedAttempts.delete(key);
      continue;
    }

    state.failedAttempts.set(key, filtered);
  }
}

export function clearExpiredSessions(database, now = new Date()) {
  database.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime(?)").run(toIso(now));
}

export function createSession(database, userId, config, now = new Date()) {
  const sessionId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const createdAt = toIso(now);
  const expiresAt = toIso(new Date(now.getTime() + config.sessionTtlMs));

  database
    .prepare(
      `INSERT INTO sessions (
        id,
        session_token_hash,
        user_id,
        created_at,
        expires_at,
        last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(sessionId, tokenHash, userId, createdAt, expiresAt, createdAt);

  return {
    id: sessionId,
    token,
    expiresAt
  };
}

export function deleteSession(database, sessionToken) {
  if (!sessionToken) {
    return;
  }

  database.prepare("DELETE FROM sessions WHERE session_token_hash = ?").run(sha256Hex(sessionToken));
}

export function touchSession(database, sessionId, now = new Date()) {
  database
    .prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?")
    .run(toIso(now), sessionId);
}

export function readSessionToken(request, config) {
  return readCookieValue(request.get("cookie"), config.sessionCookieName);
}

export function serializeSessionCookie(token, config, expiresAt) {
  const attributes = [
    `${config.sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`
  ];

  if (config.sessionCookieSecure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function serializeClearedSessionCookie(config) {
  const attributes = [
    `${config.sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0"
  ];

  if (config.sessionCookieSecure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function authenticateCabinetRequest(database, request, config, now = new Date()) {
  clearExpiredSessions(database, now);

  const token = readSessionToken(request, config);
  if (!token) {
    return null;
  }

  const session = database
    .prepare(
      `SELECT
        sessions.id,
        sessions.user_id,
        sessions.expires_at,
        users.username,
        users.email,
        users.role,
        users.is_active
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.session_token_hash = ?
      LIMIT 1`
    )
    .get(sha256Hex(token));

  if (!session || session.is_active !== 1) {
    deleteSession(database, token);
    return null;
  }

  if (Date.parse(session.expires_at) <= now.getTime()) {
    deleteSession(database, token);
    return null;
  }

  touchSession(database, session.id, now);

  return {
    sessionId: session.id,
    userId: session.user_id,
    username: session.username,
    email: session.email,
    role: session.role,
    sessionToken: token
  };
}
