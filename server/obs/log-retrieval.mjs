import { spawn } from "node:child_process";
import process from "node:process";
import readline from "node:readline";
import { Readable } from "node:stream";

const LEVELS = ["debug", "info", "warn", "error"];
const LEVEL_SET = new Set(LEVELS);
const SOURCES = ["journald", "docker"];
const SOURCE_SET = new Set(SOURCES);
const OBS_LOG_HARD_CAP_LINES_DEFAULT = 2000;
const OBS_LOG_HARD_CAP_BYTES_DEFAULT = 1024 * 1024;

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPositiveInteger(value, fallbackValue) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  const normalized = readString(value);
  if (!normalized) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
}

function parseEventLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseObsLevel(value, { required = false } = {}) {
  const normalized = readString(value);
  if (!normalized) {
    return required ? null : undefined;
  }
  if (!LEVEL_SET.has(normalized)) {
    return null;
  }
  return normalized;
}

export function parseObsLimit(value, { defaultValue, maxValue }) {
  const normalized = readString(value);
  if (!normalized) {
    return defaultValue;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

export function parseObsSource(value, { required = false } = {}) {
  const normalized = readString(value);
  if (!normalized) {
    return required ? null : undefined;
  }
  if (!SOURCE_SET.has(normalized)) {
    return null;
  }
  return normalized;
}

export function parseObsHardCapLines(value) {
  return readPositiveInteger(value, OBS_LOG_HARD_CAP_LINES_DEFAULT);
}

export function parseObsHardCapBytes(value) {
  return readPositiveInteger(value, OBS_LOG_HARD_CAP_BYTES_DEFAULT);
}

export function buildJournalctlArgs({ service, since, until }) {
  const args = ["-u", service, "--output", "cat", "--no-pager", "--since", since];
  if (until) {
    args.push("--until", until);
  }
  return args;
}

export function buildDockerLogsArgs({ container, since, until, tail }) {
  const args = ["logs", "--timestamps", "--since", since, "--tail", String(tail)];
  if (until) {
    args.push("--until", until);
  }
  args.push(container);
  return args;
}

export class ObsLogRetrievalError extends Error {
  constructor(message, { code = "obs_log_retrieval_failed", status = 500, details = null } = {}) {
    super(message);
    this.name = "ObsLogRetrievalError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function toObsLogRetrievalError(error, fallbackCode, fallbackMessage) {
  if (error instanceof ObsLogRetrievalError) {
    return error;
  }
  return new ObsLogRetrievalError(fallbackMessage, {
    code: fallbackCode,
    status: 500,
    details: { cause: error instanceof Error ? error.message : String(error) }
  });
}

function createBudgetExceededError(reason, details) {
  return new ObsLogRetrievalError("obs log retrieval exceeded budget", {
    code: "obs_budget_exceeded",
    status: 413,
    details: {
      reason,
      ...details
    }
  });
}

async function streamCommandEvents({
  source,
  binary,
  args,
  level,
  requestId,
  limit,
  signal,
  onEvent,
  onRawLine,
  spawnFn,
  useShellOnWindows,
  hardCapLines,
  hardCapBytes
}) {
  const spawnedProcess = (spawnFn ?? spawn)(binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: useShellOnWindows && process.platform === "win32"
  });

  const effectiveOnEvent = typeof onEvent === "function" ? onEvent : () => {};
  const effectiveOnRawLine = typeof onRawLine === "function" ? onRawLine : () => {};
  const effectiveLimit = Number.isInteger(limit) && limit > 0 ? limit : 200;
  const effectiveHardCapLines = Number.isInteger(hardCapLines) && hardCapLines > 0 ? hardCapLines : OBS_LOG_HARD_CAP_LINES_DEFAULT;
  const effectiveHardCapBytes = Number.isInteger(hardCapBytes) && hardCapBytes > 0 ? hardCapBytes : OBS_LOG_HARD_CAP_BYTES_DEFAULT;

  let emittedCount = 0;
  let scannedCount = 0;
  let emittedBytes = 0;
  let stoppedByLimit = false;
  let stoppedByBudget = false;
  let budgetReason = null;
  let aborted = false;
  const stderrChunks = [];

  if (spawnedProcess.stderr) {
    spawnedProcess.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  const closePromise = new Promise((resolve) => {
    spawnedProcess.once("close", (code, processSignal) => {
      resolve({ code, processSignal, error: null });
    });
  });
  const spawnErrorPromise = new Promise((resolve) => {
    spawnedProcess.once("error", (error) => {
      resolve({ code: null, processSignal: null, error });
    });
  });

  const lineReader = readline.createInterface({
    input: spawnedProcess.stdout ?? Readable.from([]),
    crlfDelay: Infinity
  });

  try {
    for await (const line of lineReader) {
      if (signal?.aborted) {
        aborted = true;
        break;
      }

      if (emittedCount >= effectiveLimit) {
        stoppedByLimit = true;
        break;
      }

      if (emittedCount >= effectiveHardCapLines) {
        stoppedByBudget = true;
        budgetReason = "hard_cap_lines";
        break;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      scannedCount += 1;
      const parsed = parseEventLine(trimmed);
      if (!parsed) {
        continue;
      }
      effectiveOnRawLine(parsed);

      if (level && parsed.level !== level) {
        continue;
      }
      if (requestId && parsed.request_id !== requestId) {
        continue;
      }

      const lineBytes = Buffer.byteLength(`${trimmed}\n`, "utf8");
      if (emittedBytes + lineBytes > effectiveHardCapBytes) {
        stoppedByBudget = true;
        budgetReason = "hard_cap_bytes";
        break;
      }

      effectiveOnEvent(parsed);
      emittedCount += 1;
      emittedBytes += lineBytes;

      if (emittedCount >= effectiveLimit) {
        stoppedByLimit = true;
        break;
      }
    }
  } finally {
    lineReader.close();
    if (!spawnedProcess.killed && spawnedProcess.pid) {
      spawnedProcess.kill("SIGTERM");
    }
  }

  const exit = await Promise.race([closePromise, spawnErrorPromise]);
  if (exit.error) {
    throw new ObsLogRetrievalError(`${source} retrieval failed: ${exit.error.message}`, {
      code: "obs_source_unavailable",
      status: 500,
      details: { source }
    });
  }

  const code = typeof exit.code === "number" ? exit.code : 1;
  if (!stoppedByLimit && !stoppedByBudget && !aborted && code !== 0) {
    const stderr = stderrChunks.join("").trim();
    throw new ObsLogRetrievalError(stderr ? `${source} retrieval failed: ${stderr}` : `${source} retrieval failed`, {
      code: "obs_source_unavailable",
      status: 500,
      details: { source }
    });
  }

  if (stoppedByBudget) {
    throw createBudgetExceededError(budgetReason, {
      source,
      hard_cap_lines: effectiveHardCapLines,
      hard_cap_bytes: effectiveHardCapBytes,
      emitted_count: emittedCount,
      emitted_bytes: emittedBytes
    });
  }

  return {
    source,
    emitted_count: emittedCount,
    scanned_count: scannedCount,
    emitted_bytes: emittedBytes,
    stopped_by_limit: stoppedByLimit,
    hard_cap_lines: effectiveHardCapLines,
    hard_cap_bytes: effectiveHardCapBytes
  };
}

export async function streamJournaldEvents(options) {
  const since = readString(options?.since);
  if (!since) {
    throw new ObsLogRetrievalError("since is required", {
      code: "obs_invalid_input",
      status: 400
    });
  }

  const service = readString(options?.service) ?? process.env.OBS_JOURNALD_SERVICE ?? "seminar";
  const level = options?.level;
  const requestId = readString(options?.requestId);
  const limit = Number.isInteger(options?.limit) && options.limit > 0 ? options.limit : 200;
  const until = readString(options?.until);
  const binary = readString(options?.journalctlBin) ?? process.env.OBS_JOURNALCTL_BIN ?? "journalctl";

  try {
    return await streamCommandEvents({
      source: "journald",
      binary,
      args: buildJournalctlArgs({ service, since, until }),
      level,
      requestId,
      limit,
      signal: options?.signal,
      onEvent: options?.onEvent,
      onRawLine: options?.onRawLine,
      spawnFn: options?.spawnFn,
      useShellOnWindows: true,
      hardCapLines: parseObsHardCapLines(options?.hardCapLines ?? process.env.OBS_LOG_HARD_CAP_LINES),
      hardCapBytes: parseObsHardCapBytes(options?.hardCapBytes ?? process.env.OBS_LOG_HARD_CAP_BYTES)
    });
  } catch (error) {
    throw toObsLogRetrievalError(error, "obs_journald_failed", "journald retrieval failed");
  }
}

export async function streamDockerEvents(options) {
  const since = readString(options?.since);
  if (!since) {
    throw new ObsLogRetrievalError("since is required", {
      code: "obs_invalid_input",
      status: 400
    });
  }

  const container = readString(options?.container) ?? readString(process.env.OBS_DOCKER_CONTAINER) ?? "seminar-app";
  const binary = readString(options?.dockerBin) ?? readString(process.env.OBS_DOCKER_BIN) ?? "docker";
  const level = options?.level;
  const requestId = readString(options?.requestId);
  const limit = Number.isInteger(options?.limit) && options.limit > 0 ? options.limit : 200;
  const until = readString(options?.until);

  try {
    return await streamCommandEvents({
      source: "docker",
      binary,
      args: buildDockerLogsArgs({ container, since, until, tail: limit }),
      level,
      requestId,
      limit,
      signal: options?.signal,
      onEvent: options?.onEvent,
      onRawLine: options?.onRawLine,
      spawnFn: options?.spawnFn,
      useShellOnWindows: false,
      hardCapLines: parseObsHardCapLines(options?.hardCapLines ?? process.env.OBS_LOG_HARD_CAP_LINES),
      hardCapBytes: parseObsHardCapBytes(options?.hardCapBytes ?? process.env.OBS_LOG_HARD_CAP_BYTES)
    });
  } catch (error) {
    throw toObsLogRetrievalError(error, "obs_docker_failed", "docker retrieval failed");
  }
}

export async function streamObsEvents(options) {
  const source = parseObsSource(options?.source ?? process.env.OBS_LOG_SOURCE, { required: true });
  if (!source) {
    throw new ObsLogRetrievalError("OBS_LOG_SOURCE must be explicitly set to journald or docker", {
      code: "obs_source_invalid",
      status: 500
    });
  }

  if (source === "journald") {
    return streamJournaldEvents(options);
  }
  if (source === "docker") {
    return streamDockerEvents(options);
  }

  throw new ObsLogRetrievalError("Unsupported log source", {
    code: "obs_source_invalid",
    status: 500
  });
}

export function isValidObsLevel(value) {
  return LEVEL_SET.has(value);
}

export function isValidObsSource(value) {
  return SOURCE_SET.has(value);
}
