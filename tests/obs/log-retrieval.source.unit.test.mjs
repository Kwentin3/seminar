import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  ObsLogRetrievalError,
  buildDockerLogsArgs,
  buildJournalctlArgs,
  parseObsSource,
  streamObsEvents
} from "../../server/obs/log-retrieval.mjs";

function createJsonEvent({ level = "info", event = "http_request_started", requestId = "req_unit_1" } = {}) {
  return JSON.stringify({
    ts: "2026-03-01T00:00:00.000Z",
    level,
    event,
    domain: "runtime",
    module: "runtime/http-middleware",
    request_id: requestId,
    payload: {},
    error: null,
    meta: { schema: "obs.event.v0.4" }
  });
}

function createMockSpawn({ stdoutLines, stderrText = "", exitCode = 0, capture }) {
  return (binary, args, options) => {
    capture.push({ binary, args, options });
    const child = new EventEmitter();
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    child.stdout = stdout;
    child.stderr = stderr;
    child.killed = false;
    child.kill = () => {
      child.killed = true;
    };

    process.nextTick(() => {
      for (const line of stdoutLines) {
        stdout.write(`${line}\n`);
      }
      stdout.end();
      if (stderrText) {
        stderr.write(stderrText);
      }
      stderr.end();
      child.emit("close", exitCode, null);
    });

    return child;
  };
}

test("parseObsSource requires explicit valid source when required", () => {
  assert.equal(parseObsSource(undefined, { required: true }), null);
  assert.equal(parseObsSource("journald", { required: true }), "journald");
  assert.equal(parseObsSource("docker", { required: true }), "docker");
  assert.equal(parseObsSource("invalid", { required: true }), null);
});

test("buildDockerLogsArgs and buildJournalctlArgs are deterministic", () => {
  assert.deepEqual(buildDockerLogsArgs({ container: "seminar-app", since: "2026-03-01T00:00:00Z", until: "2026-03-01T01:00:00Z", tail: 150 }), [
    "logs",
    "--timestamps",
    "--since",
    "2026-03-01T00:00:00Z",
    "--tail",
    "150",
    "--until",
    "2026-03-01T01:00:00Z",
    "seminar-app"
  ]);

  assert.deepEqual(buildJournalctlArgs({ service: "seminar", since: "2026-03-01T00:00:00Z", until: "2026-03-01T01:00:00Z" }), [
    "-u",
    "seminar",
    "--output",
    "cat",
    "--no-pager",
    "--since",
    "2026-03-01T00:00:00Z",
    "--until",
    "2026-03-01T01:00:00Z"
  ]);
});

test("streamObsEvents uses docker source with args-array and no shell fallback", async () => {
  const capture = [];
  const events = [];
  const spawnFn = createMockSpawn({
    capture,
    stdoutLines: [
      createJsonEvent({ level: "info", event: "http_request_started", requestId: "req_docker_1" }),
      createJsonEvent({ level: "info", event: "lead_submit_completed", requestId: "req_docker_1" }),
      createJsonEvent({ level: "warn", event: "landing_render_degraded", requestId: "req_docker_2" })
    ]
  });

  const result = await streamObsEvents({
    source: "docker",
    dockerBin: "docker",
    container: "seminar-app",
    since: "2026-03-01T00:00:00Z",
    until: "2026-03-01T01:00:00Z",
    level: "info",
    requestId: "req_docker_1",
    limit: 10,
    spawnFn,
    onEvent: (event) => events.push(event)
  });

  assert.equal(capture.length, 1);
  assert.equal(capture[0].binary, "docker");
  assert.deepEqual(capture[0].args, [
    "logs",
    "--timestamps",
    "--since",
    "2026-03-01T00:00:00Z",
    "--tail",
    "10",
    "--until",
    "2026-03-01T01:00:00Z",
    "seminar-app"
  ]);
  assert.equal(capture[0].options.shell, false);

  assert.equal(result.source, "docker");
  assert.equal(result.emitted_count, 2);
  assert.equal(events.length, 2);
  assert.equal(events[0].request_id, "req_docker_1");
});

test("streamObsEvents returns explicit budget error on hard cap overflow", async () => {
  const capture = [];
  const largeEvent = JSON.stringify({
    ts: "2026-03-01T00:00:00.000Z",
    level: "info",
    event: "http_request_started",
    domain: "runtime",
    module: "runtime/http-middleware",
    request_id: "req_overflow",
    payload: { value: "x".repeat(5000) },
    error: null,
    meta: { schema: "obs.event.v0.4" }
  });

  const spawnFn = createMockSpawn({
    capture,
    stdoutLines: [largeEvent]
  });

  await assert.rejects(
    () =>
      streamObsEvents({
        source: "docker",
        dockerBin: "docker",
        container: "seminar-app",
        since: "2026-03-01T00:00:00Z",
        limit: 10,
        hardCapBytes: 128,
        spawnFn
      }),
    (error) => {
      assert.ok(error instanceof ObsLogRetrievalError);
      assert.equal(error.code, "obs_budget_exceeded");
      assert.equal(error.status, 413);
      return true;
    }
  );
});

test("streamObsEvents keeps journald source path available", async () => {
  const capture = [];
  const events = [];
  const spawnFn = createMockSpawn({
    capture,
    stdoutLines: [createJsonEvent({ level: "error", event: "http_request_failed", requestId: "req_journal_1" })]
  });

  const result = await streamObsEvents({
    source: "journald",
    journalctlBin: "journalctl",
    service: "seminar",
    since: "2026-03-01T00:00:00Z",
    level: "error",
    requestId: "req_journal_1",
    limit: 5,
    spawnFn,
    onEvent: (event) => events.push(event)
  });

  assert.equal(capture.length, 1);
  assert.equal(capture[0].binary, "journalctl");
  assert.deepEqual(capture[0].args.slice(0, 4), ["-u", "seminar", "--output", "cat"]);
  assert.equal(result.source, "journald");
  assert.equal(result.emitted_count, 1);
  assert.equal(events.length, 1);
});
