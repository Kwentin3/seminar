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

function readNullablePositiveInt(value) {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const HARD_MAX_REQUEST_TIMEOUT_MS = 120_000;
const HARD_MAX_SOURCE_CHARS = 25_000;

function normalizeBaseUrl(value) {
  const normalized = readString(value) ?? "https://api.deepseek.com";
  return normalized.replace(/\/+$/, "");
}

export function readLlmSimplifyConfig(env) {
  return {
    provider: "deepseek",
    apiKey: readString(env.DEEPSEEK_API_KEY),
    baseUrl: normalizeBaseUrl(env.DEEPSEEK_BASE_URL),
    defaultRequestTimeoutMs: readPositiveInt(env.LLM_SIMPLIFY_TIMEOUT_MS, 75_000),
    defaultMaxSourceChars: readPositiveInt(env.LLM_SIMPLIFY_MAX_SOURCE_CHARS, 20_000),
    defaultMaxOutputTokens: readNullablePositiveInt(env.LLM_SIMPLIFY_DEFAULT_MAX_OUTPUT_TOKENS),
    hardMaxRequestTimeoutMs: HARD_MAX_REQUEST_TIMEOUT_MS,
    hardMaxSourceChars: HARD_MAX_SOURCE_CHARS
  };
}
