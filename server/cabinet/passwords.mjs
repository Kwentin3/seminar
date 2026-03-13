import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const DUMMY_PASSWORD = "cabinet-auth-dummy-password";
const DUMMY_SALT = Buffer.from("cabinet-auth-dummy-salt-20260313", "utf8");

function formatHash(salt, derived) {
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64"),
    derived.toString("base64")
  ].join("$");
}

const DUMMY_PASSWORD_HASH = formatHash(
  DUMMY_SALT,
  scryptSync(DUMMY_PASSWORD, DUMMY_SALT, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  })
);

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });

  return formatHash(salt, derived);
}

export function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") {
    return false;
  }

  const [algorithm, nRaw, rRaw, pRaw, saltRaw, derivedRaw] = storedHash.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !derivedRaw) {
    return false;
  }

  const salt = Buffer.from(saltRaw, "base64");
  const expected = Buffer.from(derivedRaw, "base64");
  const derived = scryptSync(password, salt, expected.length, {
    N: Number.parseInt(nRaw, 10),
    r: Number.parseInt(rRaw, 10),
    p: Number.parseInt(pRaw, 10)
  });

  return timingSafeEqual(derived, expected);
}

export function verifyPasswordWithFallback(password, storedHash) {
  return verifyPassword(password, storedHash ?? DUMMY_PASSWORD_HASH);
}
