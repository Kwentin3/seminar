function readString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPositiveInt(value, fallback) {
  const raw = readString(value);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBooleanFlag(value, fallback = false) {
  const raw = readString(value);
  if (!raw) {
    return fallback;
  }

  if (raw === "1" || raw.toLowerCase() === "true") {
    return true;
  }

  if (raw === "0" || raw.toLowerCase() === "false") {
    return false;
  }

  return fallback;
}

export function readCabinetConfig(env) {
  const bootstrapEnabled = readBooleanFlag(env.CABINET_BOOTSTRAP_ADMIN, false);
  // Reset is intentionally separate from create-first bootstrap so production can
  // seed the first admin without silently reasserting credentials on every restart.
  const bootstrapAllowReset = readBooleanFlag(env.CABINET_BOOTSTRAP_ALLOW_RESET, false);
  const bootstrapUsername = readString(env.CABINET_BOOTSTRAP_USERNAME);
  const bootstrapEmail = readString(env.CABINET_BOOTSTRAP_EMAIL)?.toLowerCase() ?? null;
  const bootstrapPassword = readString(env.CABINET_BOOTSTRAP_PASSWORD);

  if (bootstrapEnabled && (!bootstrapUsername || !bootstrapPassword)) {
    throw new Error(
      "CABINET_BOOTSTRAP_ADMIN requires CABINET_BOOTSTRAP_USERNAME and CABINET_BOOTSTRAP_PASSWORD."
    );
  }

  if (bootstrapPassword && bootstrapPassword.length < 8) {
    throw new Error("CABINET_BOOTSTRAP_PASSWORD must be at least 8 characters long.");
  }

  const sessionTtlHours = readPositiveInt(env.CABINET_SESSION_TTL_HOURS, 168);
  const loginWindowMinutes = readPositiveInt(env.CABINET_LOGIN_WINDOW_MINUTES, 10);
  const loginMaxAttempts = readPositiveInt(env.CABINET_LOGIN_MAX_ATTEMPTS, 10);

  return {
    sessionCookieName: readString(env.CABINET_SESSION_COOKIE_NAME) ?? "seminar_cabinet_session",
    // This keeps local HTTP workable while still producing Secure cookies in production
    // regardless of the reverse proxy implementation in front of the app.
    sessionCookieSecure: env.NODE_ENV === "production",
    sessionTtlMs: sessionTtlHours * 60 * 60 * 1000,
    loginWindowMs: loginWindowMinutes * 60 * 1000,
    loginMaxAttempts,
    bootstrapAdmin: {
      enabled: bootstrapEnabled,
      allowReset: bootstrapAllowReset,
      username: bootstrapUsername,
      email: bootstrapEmail,
      password: bootstrapPassword
    }
  };
}
