import assert from "node:assert/strict";
import test from "node:test";
import { createLogger } from "../../server/obs/logger.mjs";
import { createRequestContext, runWithRequestContext } from "../../server/obs/request-context.mjs";

function createCaptureLogger(options = {}) {
  const lines = [];
  const instance = createLogger({
    writer: (line) => {
      lines.push(line);
    },
    ...options
  });

  return {
    logger: instance,
    lines,
    records: () => lines.map((line) => JSON.parse(line))
  };
}

test("redaction masks phone, email and token values", () => {
  const { logger, lines, records } = createCaptureLogger();
  const context = createRequestContext("req_redaction_test");

  runWithRequestContext(context, () => {
    logger.info({
      event: "lead_submit_started",
      domain: "leads",
      module: "leads/submit-handler",
      payload: {
        phone: "+1 (415) 555-0100",
        email: "owner@example.com",
        token: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
        note: "contact owner@example.com at +1 415 555 0100"
      }
    });
  });

  const [record] = records();
  assert.equal(record.payload.phone, "***redacted***");
  assert.equal(record.payload.email, "***redacted***");
  assert.equal(record.payload.token, "***redacted***");
  assert.equal(record.payload.note.includes("***redacted_email***"), true);
  assert.equal(record.payload.note.includes("***redacted_phone***"), true);
  assert.equal(lines[0].includes("owner@example.com"), false);
  assert.equal(lines[0].includes("+1 (415) 555-0100"), false);
  assert.equal(lines[0].includes("eyJhbGciOiJIUzI1NiJ9.payload.signature"), false);
});

test("naming enforcement normalizes invalid event and module", () => {
  const { logger, records } = createCaptureLogger();
  const context = createRequestContext("req_naming_test");

  runWithRequestContext(context, () => {
    logger.info({
      event: "lead_submit",
      domain: "leads",
      module: "bad module",
      payload: { step: "submit" }
    });
  });

  const parsed = records();
  const mainRecord = parsed.find((record) => record.domain === "leads");
  assert.ok(mainRecord, "expected main domain record");
  assert.equal(mainRecord.event, "unknown");
  assert.equal(mainRecord.module, "unknown");
  assert.equal(mainRecord.meta.schema_violation, true);

  const schemaViolations = parsed.filter((record) => record.event === "obs.schema_violation_detected");
  assert.equal(schemaViolations.length >= 1, true);
});

test("payload budget truncates records above 4KB", () => {
  const { logger, lines, records } = createCaptureLogger();
  const context = createRequestContext("req_payload_budget");
  const largeBlob = "x".repeat(9_000);

  runWithRequestContext(context, () => {
    logger.info({
      event: "lead_submit_started",
      domain: "leads",
      module: "leads/submit-handler",
      payload: {
        large_blob: largeBlob
      }
    });
  });

  const parsed = records();
  const mainRecord = parsed.find((record) => record.domain === "leads");
  assert.ok(mainRecord, "expected main domain record");
  assert.equal(mainRecord.meta.payload_truncated, true);
  const mainLine = lines[parsed.indexOf(mainRecord)];
  assert.equal(Buffer.byteLength(mainLine, "utf8") <= 4 * 1024, true);
  assert.equal(parsed.some((record) => record.event === "obs.payload_truncated"), true);
});

test("info rate limiting suppresses overflow and emits obs.info_rate_limited once with suppressed count", () => {
  const { logger, records } = createCaptureLogger({
    infoEventsPerRequestMax: 30
  });
  const context = createRequestContext("req_info_limit");

  runWithRequestContext(context, () => {
    for (let index = 0; index < 50; index += 1) {
      logger.info({
        event: "lead_submit_started",
        domain: "leads",
        module: "leads/submit-handler",
        payload: { index }
      });
    }
    logger.flushRequestDiagnostics();
  });

  const parsed = records();
  const leadInfo = parsed.filter(
    (record) => record.domain === "leads" && record.level === "info" && record.event === "lead_submit_started"
  );
  assert.equal(leadInfo.length, 30);

  const rateEvents = parsed.filter((record) => record.event === "obs.info_rate_limited");
  assert.equal(rateEvents.length, 1);
  assert.equal(rateEvents[0].meta.suppressed_info_count, 20);
});

test("async correlation keeps request_id across await, timer and microtask", async () => {
  const { logger, records } = createCaptureLogger();
  const context = createRequestContext("req_async_correlation");

  await runWithRequestContext(context, async () => {
    logger.info({
      event: "http_request_started",
      domain: "runtime",
      module: "runtime/http-middleware",
      payload: { stage: "sync" }
    });

    await Promise.resolve();
    logger.info({
      event: "lead_submit_started",
      domain: "leads",
      module: "leads/submit-handler",
      payload: { stage: "await" }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    logger.info({
      event: "admin_auth_succeeded",
      domain: "admin",
      module: "admin/auth-handler",
      duration_ms: 1,
      payload: { stage: "timer" }
    });

    await new Promise((resolve) =>
      queueMicrotask(() => {
        logger.info({
          event: "http_request_completed",
          domain: "runtime",
          module: "runtime/http-middleware",
          duration_ms: 2,
          payload: { stage: "microtask" }
        });
        resolve();
      })
    );
  });

  const parsed = records().filter((record) => record.domain !== "obs");
  assert.equal(parsed.length, 4);
  for (const record of parsed) {
    assert.equal(record.request_id, "req_async_correlation");
  }
});
