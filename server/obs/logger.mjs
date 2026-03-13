/**
 * OBS BASELINE (CONTRACT-OBS-001 v0.4)
 *
 * Invariants:
 * - logger MUST NEVER throw
 * - redaction-by-default
 * - strict 4KB cap (full event)
 * - namespaced error.code
 * - no implicit fallback
 *
 * All new features MUST use this logger.
 */
import process from "node:process";
import { getRequestContext } from "./request-context.mjs";

const LEVELS = new Set(["debug", "info", "warn", "error"]);
const DOMAINS = new Set(["runtime", "content", "landing", "leads", "admin", "cabinet", "obs"]);
const EVENT_REGEX = /^[a-z0-9]+(_[a-z0-9]+)*$/;
const EVENT_TENSE_REGEX =
  /(_started|_completed|_failed|_selected|_limited|_detected|_loaded|_succeeded|_denied|_degraded)$/;
const MODULE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;
const MAX_EVENT_BYTES = 4 * 1024;
const REDACTED_VALUE = "***redacted***";
const ERROR_CODE_NAMESPACE_PREFIXES = ["content.", "landing.", "leads.", "admin.", "cabinet.", "runtime.", "obs."];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/g;
const TOKEN_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|token|password|api[_-]?key|secret|connection|string|phone|email|process\.?env|^env$)/i;

function readPositiveInt(rawValue, fallbackValue) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function safeJsonStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, entry) => {
    if (typeof entry === "bigint") {
      return entry.toString();
    }
    if (typeof entry === "object" && entry !== null) {
      if (seen.has(entry)) {
        return "[circular]";
      }
      seen.add(entry);
    }
    return entry;
  });
}

function stringByteSize(value) {
  return Buffer.byteLength(value, "utf8");
}

function redactString(value) {
  return value
    .replace(EMAIL_PATTERN, "***redacted_email***")
    .replace(PHONE_PATTERN, "***redacted_phone***")
    .replace(TOKEN_PATTERN, "***redacted_token***");
}

function normalizeMessage(value) {
  if (typeof value !== "string") {
    return "unknown error";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? redactString(trimmed) : "unknown error";
}

function hasValidErrorCodeNamespace(code) {
  return typeof code === "string" && ERROR_CODE_NAMESPACE_PREFIXES.some((prefix) => code.startsWith(prefix));
}

function normalizeRequestIdForEmergency(value) {
  if (typeof value !== "string") {
    return "unknown";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.slice(0, 128);
}

function redactValue(value, keyHint = "", depth = 0, seen = new WeakSet()) {
  if (depth > 8) {
    return "[max_depth]";
  }

  if (SENSITIVE_KEY_PATTERN.test(keyHint)) {
    return REDACTED_VALUE;
  }

  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: normalizeMessage(value.message)
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry, index) => redactValue(entry, `${keyHint}[${index}]`, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    const output = {};
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    for (const key of keys) {
      output[key] = redactValue(value[key], key, depth + 1, seen);
    }
    return output;
  }

  return "[unsupported]";
}

function truncateDeterministic(value, depth = 0) {
  if (depth > 5) {
    return "[truncated]";
  }

  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((entry) => truncateDeterministic(entry, depth + 1));
  }

  if (typeof value === "object" && value) {
    const result = {};
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right)).slice(0, 16);
    for (const key of keys) {
      result[key] = truncateDeterministic(value[key], depth + 1);
    }
    return result;
  }

  return "[truncated]";
}

function normalizeErrorContract(level, inputError) {
  if (!inputError && level !== "error") {
    return null;
  }

  if (!inputError && level === "error") {
    return {
      code: "obs.unknown_error",
      category: "internal",
      retryable: false,
      origin: "obs",
      message: "unknown error"
    };
  }

  if (inputError instanceof Error) {
    return {
      code: "runtime.unhandled_error",
      category: "internal",
      retryable: false,
      origin: "infra",
      message: normalizeMessage(inputError.message)
    };
  }

  if (typeof inputError === "object" && inputError !== null) {
    const code = typeof inputError.code === "string" ? inputError.code : "obs.unknown_error";
    const category = typeof inputError.category === "string" ? inputError.category : "internal";
    const origin =
      inputError.origin === "domain" ||
      inputError.origin === "infra" ||
      inputError.origin === "external" ||
      inputError.origin === "obs"
        ? inputError.origin
        : "obs";

    return {
      code,
      category,
      retryable: inputError.retryable === true,
      origin,
      message: normalizeMessage(inputError.message)
    };
  }

  return {
    code: "obs.unknown_error",
    category: "internal",
    retryable: false,
    origin: "obs",
    message: normalizeMessage(String(inputError))
  };
}

function requiresRequestId(event, domain) {
  return (
    domain === "runtime" ||
    domain === "leads" ||
    domain === "admin" ||
    domain === "cabinet" ||
    domain === "content" ||
    domain === "landing" ||
    event.startsWith("http_")
  );
}

function toSerializableRecord(record) {
  return {
    ts: record.ts,
    level: record.level,
    event: record.event,
    domain: record.domain,
    module: record.module,
    request_id: record.request_id,
    payload: record.payload,
    error: record.error,
    ...(record.duration_ms !== undefined ? { duration_ms: record.duration_ms } : {}),
    meta: record.meta
  };
}

export function createLogger(options = {}) {
  const infoLimit = readPositiveInt(
    options.infoEventsPerRequestMax ?? process.env.OBS_INFO_EVENTS_PER_REQUEST_MAX,
    30
  );
  const obsRateWindowMs = readPositiveInt(options.obsRateWindowMs, 5_000);
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const writer =
    options.writer ??
    ((line) => {
      process.stdout.write(`${line}\n`);
    });
  const host = options.host ?? process.env.HOSTNAME ?? undefined;
  const build = options.build ?? process.env.BUILD_ID ?? undefined;
  const obsRateState = new Map();

  function createMeta(extra = {}) {
    return {
      schema: "obs.event.v0.4",
      process_id: process.pid,
      ...(host ? { host } : {}),
      ...(build ? { build } : {}),
      ...extra
    };
  }

  function writeLineSafe(line) {
    try {
      writer(line);
    } catch {
      // MUST NEVER throw to caller
    }
  }

  function shouldEmitObsRateLimited(eventName, keySuffix = "") {
    const key = `${eventName}:${keySuffix}`;
    const current = now();
    const previous = obsRateState.get(key);
    if (typeof previous === "number" && current - previous < obsRateWindowMs) {
      return false;
    }
    obsRateState.set(key, current);
    return true;
  }

  function serializeWithBudget(record) {
    let serialized = safeJsonStringify(toSerializableRecord(record));
    if (stringByteSize(serialized) <= MAX_EVENT_BYTES) {
      return { serialized, truncated: false };
    }

    record.meta.payload_truncated = true;
    record.payload = truncateDeterministic(record.payload);
    serialized = safeJsonStringify(toSerializableRecord(record));
    if (stringByteSize(serialized) <= MAX_EVENT_BYTES) {
      return { serialized, truncated: true };
    }

    record.payload = { _truncated: true };
    record.error = truncateDeterministic(record.error);
    serialized = safeJsonStringify(toSerializableRecord(record));
    if (stringByteSize(serialized) <= MAX_EVENT_BYTES) {
      return { serialized, truncated: true };
    }

    record.error = null;
    serialized = safeJsonStringify(toSerializableRecord(record));
    if (stringByteSize(serialized) <= MAX_EVENT_BYTES) {
      return { serialized, truncated: true };
    }

    record.payload = {};
    record.meta.logger_error = true;
    serialized = safeJsonStringify(toSerializableRecord(record));
    if (stringByteSize(serialized) <= MAX_EVENT_BYTES) {
      return { serialized, truncated: true };
    }

    // Contract hard bound: if the full event is still oversized, replace it deterministically
    // with a minimal obs event to guarantee serialized size <= 4KB.
    record.level = "error";
    record.event = "obs.event_size_exceeded";
    record.domain = "obs";
    record.module = "obs/logger";
    record.request_id = normalizeRequestIdForEmergency(record.request_id);
    record.payload = {};
    record.error = {
      code: "obs.event_size_exceeded",
      category: "internal",
      retryable: false,
      origin: "obs",
      message: "event size exceeded"
    };
    record.meta = {
      schema: "obs.event.v0.4",
      payload_truncated: true,
      logger_error: true
    };
    serialized = safeJsonStringify(toSerializableRecord(record));
    if (stringByteSize(serialized) <= MAX_EVENT_BYTES) {
      return { serialized, truncated: true };
    }

    const minimal = safeJsonStringify({
      ts: record.ts,
      level: "error",
      event: "obs.event_size_exceeded",
      domain: "obs",
      module: "obs/logger",
      request_id: "unknown",
      payload: {},
      error: {
        code: "obs.event_size_exceeded",
        category: "internal",
        retryable: false,
        origin: "obs",
        message: "event size exceeded"
      },
      meta: {
        schema: "obs.event.v0.4",
        payload_truncated: true,
        logger_error: true
      }
    });
    return { serialized: minimal, truncated: true };
  }

  function writeRecord(record) {
    const { serialized } = serializeWithBudget(record);
    writeLineSafe(serialized);
  }

  function emitObsEvent({
    event,
    payload = {},
    requestId = "unknown",
    keySuffix = "",
    level = "warn",
    meta: extraMeta = {},
    error = null
  }) {
    if (!shouldEmitObsRateLimited(event, keySuffix)) {
      return;
    }

    let redactedPayload = {};
    let redactionFailed = false;
    try {
      redactedPayload = redactValue(payload);
    } catch {
      redactionFailed = true;
    }

    const record = {
      ts: new Date(now()).toISOString(),
      level,
      event,
      domain: "obs",
      module: "obs/logger",
      request_id: requestId || "unknown",
      payload: redactionFailed ? {} : redactedPayload,
      error: redactionFailed
        ? {
            code: "obs.redaction_failed",
            category: "internal",
            retryable: true,
            origin: "obs",
            message: "logger redaction failed"
          }
        : error,
      meta: createMeta(redactionFailed ? { redaction_failed: true, ...extraMeta } : extraMeta)
    };

    writeRecord(record);
  }

  function flushRequestDiagnostics(contextOverride = null) {
    const context = contextOverride ?? getRequestContext();
    if (!context || context.info_rate_limited_emitted || context.suppressed_info_count < 1) {
      return;
    }

    context.info_rate_limited_emitted = true;
    emitObsEvent({
      event: "obs.info_rate_limited",
      requestId: context.request_id ?? "unknown",
      keySuffix: context.request_id ?? "unknown",
      meta: { suppressed_info_count: context.suppressed_info_count },
      payload: { suppressed_info_count: context.suppressed_info_count }
    });
  }

  function normalizeEntry(rawEntry) {
    const context = getRequestContext();
    // No implicit semantic fallback: invalid/missing level is a schema violation.
    let level = rawEntry?.level;
    const meta = createMeta();
    if (!LEVELS.has(level)) {
      level = "error";
      meta.schema_violation = true;
      emitObsEvent({
        event: "obs.schema_violation_detected",
        requestId: context?.request_id ?? "unknown",
        keySuffix: "level",
        payload: { field: "level" }
      });
    }

    let event = typeof rawEntry?.event === "string" ? rawEntry.event : "";
    if (!EVENT_REGEX.test(event) || !EVENT_TENSE_REGEX.test(event)) {
      event = "unknown";
      meta.schema_violation = true;
      emitObsEvent({
        event: "obs.schema_violation_detected",
        requestId: context?.request_id ?? "unknown",
        keySuffix: "event",
        payload: { field: "event" }
      });
    }

    let moduleName = typeof rawEntry?.module === "string" ? rawEntry.module : "";
    if (!MODULE_REGEX.test(moduleName)) {
      moduleName = "unknown";
      meta.schema_violation = true;
      emitObsEvent({
        event: "obs.schema_violation_detected",
        requestId: context?.request_id ?? "unknown",
        keySuffix: "module",
        payload: { field: "module" }
      });
    }

    // No implicit semantic fallback: invalid/missing domain is a schema violation.
    const rawDomain = typeof rawEntry?.domain === "string" && rawEntry.domain.trim() ? rawEntry.domain.trim() : null;
    const domain = rawDomain && DOMAINS.has(rawDomain) ? rawDomain : "obs";
    if (!rawDomain || !DOMAINS.has(rawDomain)) {
      meta.schema_violation = true;
      emitObsEvent({
        event: "obs.schema_violation_detected",
        requestId: context?.request_id ?? "unknown",
        keySuffix: "domain",
        payload: { field: "domain" }
      });
    }

    let requestId = context?.request_id ?? null;
    if (!requestId) {
      requestId = "unknown";
      if (requiresRequestId(event, domain)) {
        meta.missing_request_id = true;
        emitObsEvent({
          event: "obs.missing_request_id_detected",
          requestId,
          keySuffix: `${event}:${domain}`,
          payload: { event, domain }
        });
      }
    }

    let payload = {};
    try {
      payload = redactValue(rawEntry?.payload ?? {});
    } catch {
      payload = {};
      meta.redaction_failed = true;
      emitObsEvent({
        event: "obs.redaction_failed",
        requestId,
        keySuffix: `${event}:payload`,
        payload: { event, module: moduleName }
      });
    }

    let error = null;
    try {
      const normalizedError = normalizeErrorContract(level, rawEntry?.error);
      if (normalizedError && !hasValidErrorCodeNamespace(normalizedError.code)) {
        meta.schema_violation = true;
        emitObsEvent({
          event: "obs.schema_violation_detected",
          requestId: requestId ?? context?.request_id ?? "unknown",
          keySuffix: "error.code",
          payload: { field: "error.code" }
        });
        error = redactValue({
          code: "obs.invalid_error_code_namespace",
          category: "internal",
          retryable: false,
          origin: "obs",
          message: "invalid error code namespace"
        });
      } else {
        error = redactValue(normalizedError);
      }
    } catch {
      error = null;
      meta.redaction_failed = true;
      emitObsEvent({
        event: "obs.redaction_failed",
        requestId,
        keySuffix: `${event}:error`,
        payload: { event, module: moduleName }
      });
    }

    const durationMs =
      typeof rawEntry?.duration_ms === "number" && Number.isFinite(rawEntry.duration_ms)
        ? Math.max(0, Math.round(rawEntry.duration_ms))
        : undefined;

    return {
      ts: new Date(now()).toISOString(),
      level,
      event,
      domain,
      module: moduleName,
      request_id: requestId,
      payload,
      error,
      ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
      meta,
      _context: context
    };
  }

  function shouldSuppressInfo(record) {
    if (record.level !== "info" || record.domain === "obs" || !record._context) {
      return false;
    }

    if (record._context.info_emitted_count < infoLimit) {
      record._context.info_emitted_count += 1;
      return false;
    }

    record._context.suppressed_info_count += 1;
    return true;
  }

  function log(rawEntry) {
    try {
      const record = normalizeEntry(rawEntry ?? {});
      if (shouldSuppressInfo(record)) {
        return;
      }

      let serialized;
      let truncated = false;
      try {
        const result = serializeWithBudget(record);
        serialized = result.serialized;
        truncated = result.truncated;
      } catch {
        record.payload = {};
        record.meta.logger_error = true;
        const fallback = serializeWithBudget(record);
        serialized = fallback.serialized;
        emitObsEvent({
          event: "obs.logger_internal_error",
          requestId: record.request_id,
          keySuffix: "serialize",
          payload: { stage: "serialize_with_budget", event: record.event }
        });
      }

      writeLineSafe(serialized);
      if (truncated && record.event !== "obs.payload_truncated") {
        emitObsEvent({
          event: "obs.payload_truncated",
          requestId: record.request_id,
          keySuffix: `${record.event}:${record.module}`,
          payload: { event: record.event, module: record.module }
        });
      }
    } catch {
      emitObsEvent({
        event: "obs.logger_internal_error",
        requestId: "unknown",
        keySuffix: "log",
        payload: { stage: "log" }
      });
    }
  }

  return {
    log,
    debug: (entry) => log({ ...(entry ?? {}), level: "debug" }),
    info: (entry) => log({ ...(entry ?? {}), level: "info" }),
    warn: (entry) => log({ ...(entry ?? {}), level: "warn" }),
    error: (entry) => log({ ...(entry ?? {}), level: "error" }),
    flushRequestDiagnostics
  };
}

export const logger = createLogger();
