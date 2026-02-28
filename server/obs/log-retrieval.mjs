import { spawn } from "node:child_process";
import process from "node:process";
import readline from "node:readline";

const LEVELS = ["debug", "info", "warn", "error"];
const LEVEL_SET = new Set(LEVELS);

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function buildJournalctlArgs({ service, since, until }) {
  const args = ["-u", service, "--output", "cat", "--no-pager", "--since", since];
  if (until) {
    args.push("--until", until);
  }
  return args;
}

export async function streamJournaldEvents(options) {
  const since = readString(options?.since);
  if (!since) {
    throw new Error("since is required");
  }

  const service = readString(options?.service) ?? process.env.OBS_JOURNALD_SERVICE ?? "seminar";
  const level = options?.level;
  const requestId = readString(options?.requestId);
  const limit = Number.isInteger(options?.limit) && options.limit > 0 ? options.limit : 200;
  const until = readString(options?.until);
  const onEvent = typeof options?.onEvent === "function" ? options.onEvent : () => {};
  const onRawLine = typeof options?.onRawLine === "function" ? options.onRawLine : () => {};
  const binary = readString(options?.journalctlBin) ?? process.env.OBS_JOURNALCTL_BIN ?? "journalctl";

  const child = spawn(binary, buildJournalctlArgs({ service, since, until }), {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  });

  let emittedCount = 0;
  let scannedCount = 0;
  let stoppedByLimit = false;
  const stderrChunks = [];

  child.stderr.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  const closePromise = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });

  const lineReader = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity
  });

  try {
    for await (const line of lineReader) {
      if (options?.signal?.aborted) {
        break;
      }
      if (emittedCount >= limit) {
        stoppedByLimit = true;
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
      onRawLine(parsed);

      if (level && parsed.level !== level) {
        continue;
      }
      if (requestId && parsed.request_id !== requestId) {
        continue;
      }

      onEvent(parsed);
      emittedCount += 1;
      if (emittedCount >= limit) {
        stoppedByLimit = true;
        break;
      }
    }
  } finally {
    lineReader.close();
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  const exit = await closePromise;
  const code = typeof exit.code === "number" ? exit.code : 1;
  if (!stoppedByLimit && code !== 0) {
    const stderr = stderrChunks.join("").trim();
    throw new Error(stderr ? `journalctl failed: ${stderr}` : "journalctl failed");
  }

  return {
    emitted_count: emittedCount,
    scanned_count: scannedCount
  };
}

export function isValidObsLevel(value) {
  return LEVEL_SET.has(value);
}
