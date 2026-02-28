import { createHash } from "node:crypto";

function normalizeForCanonical(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForCanonical(entry));
  }

  if (value && typeof value === "object") {
    const normalized = {};
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    for (const key of keys) {
      normalized[key] = normalizeForCanonical(value[key]);
    }
    return normalized;
  }

  return value;
}

export function canonicalJsonStringify(value) {
  return JSON.stringify(normalizeForCanonical(value));
}

export function hashCanonicalJson(value) {
  return createHash("sha256").update(canonicalJsonStringify(value), "utf8").digest("base64url");
}
