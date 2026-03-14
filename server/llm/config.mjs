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

function normalizeBaseUrl(value) {
  const normalized = readString(value) ?? "https://api.deepseek.com";
  return normalized.replace(/\/+$/, "");
}

export function readLlmSimplifyConfig(env) {
  return {
    provider: "deepseek",
    apiKey: readString(env.DEEPSEEK_API_KEY),
    baseUrl: normalizeBaseUrl(env.DEEPSEEK_BASE_URL),
    requestTimeoutMs: readPositiveInt(env.LLM_SIMPLIFY_TIMEOUT_MS, 75_000),
    maxSourceChars: readPositiveInt(env.LLM_SIMPLIFY_MAX_SOURCE_CHARS, 20_000),
    defaultMaxOutputTokens: readPositiveInt(env.LLM_SIMPLIFY_DEFAULT_MAX_OUTPUT_TOKENS, 900)
  };
}
