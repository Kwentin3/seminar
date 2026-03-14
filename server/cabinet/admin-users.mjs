import { randomUUID } from "node:crypto";
import { hashPassword } from "./passwords.mjs";

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUsername(value) {
  const normalized = readString(value)?.toLowerCase();
  return normalized ?? null;
}

function normalizeEmail(value) {
  const normalized = readString(value)?.toLowerCase();
  return normalized ?? null;
}

function normalizePassword(value) {
  const password = readString(value);
  if (!password) {
    return null;
  }

  return password.length >= 8 ? password : null;
}

function toAdminUserPayload(row) {
  return {
    id: row.id,
    username: row.username,
    email: typeof row.email === "string" ? row.email : null,
    role: row.role === "admin" ? "admin" : "viewer",
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: typeof row.last_login_at === "string" ? row.last_login_at : null
  };
}

function readAdminUserRow(database, userId) {
  return database
    .prepare(
      `SELECT
        id,
        username,
        email,
        role,
        is_active,
        created_at,
        updated_at,
        last_login_at
       FROM users
       WHERE id = ?
       LIMIT 1`
    )
    .get(userId);
}

function readUserByIdentity(database, username, email) {
  return database
    .prepare(
      `SELECT
        id,
        username,
        email,
        role,
        is_active,
        created_at,
        updated_at,
        last_login_at
       FROM users
       WHERE lower(username) = ?
          OR (? IS NOT NULL AND lower(email) = ?)
       LIMIT 1`
    )
    .get(username, email, email);
}

export function createCabinetAdminUsersService({ database }) {
  function listUsers() {
    const rows = database
      .prepare(
        `SELECT
          id,
          username,
          email,
          role,
          is_active,
          created_at,
          updated_at,
          last_login_at
         FROM users
         ORDER BY
           CASE role
             WHEN 'admin' THEN 0
             ELSE 1
           END ASC,
           lower(username) ASC`
      )
      .all();

    return {
      ok: true,
      items: rows.map((row) => toAdminUserPayload(row))
    };
  }

  function createViewer(input) {
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);
    const password = normalizePassword(input.password);
    if (!username || !email || !password) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "username, email, and password (min 8 chars) are required."
          }
        }
      };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "email must be a valid email address."
          }
        }
      };
    }

    const existing = readUserByIdentity(database, username, email);
    if (existing) {
      return {
        ok: false,
        error: {
          status: 409,
          body: {
            code: "invalid_input",
            message: "A cabinet user with the same username or email already exists."
          }
        }
      };
    }

    const now = new Date().toISOString();
    const userId = randomUUID();

    // Sticky note: viewer-first creation keeps this admin tool low-risk until
    // a broader role/permission model exists inside cabinet.
    database
      .prepare(
        `INSERT INTO users (
          id,
          username,
          email,
          password_hash,
          role,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'viewer', 1, ?, ?)`
      )
      .run(userId, username, email, hashPassword(password), now, now);

    return {
      ok: true,
      item: toAdminUserPayload(readAdminUserRow(database, userId))
    };
  }

  function resetPassword(targetUserId, input) {
    const password = normalizePassword(input.password);
    if (!password) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "password must be at least 8 characters long."
          }
        }
      };
    }

    const target = readAdminUserRow(database, targetUserId);
    if (!target) {
      return {
        ok: false,
        error: {
          status: 404,
          body: {
            code: "invalid_input",
            message: "Cabinet user not found."
          }
        }
      };
    }

    const now = new Date().toISOString();
    database
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .run(hashPassword(password), now, targetUserId);

    // Sticky note: password reset must drop existing sessions immediately,
    // otherwise a reset would not have a trustworthy terminal effect.
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetUserId);

    return {
      ok: true,
      item: toAdminUserPayload(readAdminUserRow(database, targetUserId))
    };
  }

  function setActive(targetUserId, input, actorUserId) {
    const isActive = typeof input.is_active === "boolean" ? input.is_active : null;
    if (isActive === null) {
      return {
        ok: false,
        error: {
          status: 400,
          body: {
            code: "invalid_input",
            message: "is_active must be a boolean."
          }
        }
      };
    }

    const target = readAdminUserRow(database, targetUserId);
    if (!target) {
      return {
        ok: false,
        error: {
          status: 404,
          body: {
            code: "invalid_input",
            message: "Cabinet user not found."
          }
        }
      };
    }

    if (!isActive && target.id === actorUserId) {
      // Sticky note: never allow an admin page to deactivate the current
      // session owner; recovering from accidental self-lockout is ops-only.
      return {
        ok: false,
        error: {
          status: 403,
          body: {
            code: "cabinet_forbidden",
            message: "You cannot deactivate your own account."
          }
        }
      };
    }

    const now = new Date().toISOString();
    database
      .prepare(
        `UPDATE users
         SET is_active = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .run(isActive ? 1 : 0, now, targetUserId);

    if (!isActive) {
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetUserId);
    }

    return {
      ok: true,
      item: toAdminUserPayload(readAdminUserRow(database, targetUserId))
    };
  }

  return {
    listUsers,
    createViewer,
    resetPassword,
    setActive
  };
}
