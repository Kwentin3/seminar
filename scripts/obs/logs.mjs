#!/usr/bin/env node
import process from "node:process";
import { parseObsLevel, streamJournaldEvents } from "../../server/obs/log-retrieval.mjs";

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--")) {
      continue;
    }

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }

    if (
      key === "--since" ||
      key === "--until" ||
      key === "--level" ||
      key === "--request-id" ||
      key === "--limit" ||
      key === "--service"
    ) {
      parsed[key.slice(2)] = value;
      index += 1;
    }
  }
  return parsed;
}

function printUsage() {
  process.stderr.write(
    "Usage: node scripts/obs/logs.mjs --since <iso> --level <debug|info|warn|error> --limit <n> [--until <iso>] [--request-id <id>] [--service <name>]\n"
  );
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    printUsage();
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const since = readString(args.since);
  const limitRaw = readString(args.limit);
  const level = parseObsLevel(args.level, { required: true });

  if (!since || !limitRaw || !level) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const limitParsed = Number.parseInt(limitRaw, 10);
  if (!Number.isInteger(limitParsed) || limitParsed < 1) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  const limit = Math.min(limitParsed, 2000);

  try {
    await streamJournaldEvents({
      service: args.service,
      since,
      until: args.until,
      level,
      requestId: args["request-id"],
      limit,
      onEvent: (event) => {
        process.stdout.write(`${JSON.stringify(event)}\n`);
      }
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

await main();
