import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createDeepSeekClient, DeepSeekClientError } from "../../server/llm/deepseek-client.mjs";

test("deepseek client classifies timeout, upstream http, parse, and empty response failures", async (t) => {
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    const mode = request.headers["x-test-mode"];
    if (mode === "stream-success") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"content":"# Поток "}}]}\n\n');
      await new Promise((resolve) => setTimeout(resolve, 20));
      response.write('data: {"choices":[{"delta":{"content":"готов"}}]}\n\n');
      await new Promise((resolve) => setTimeout(resolve, 20));
      response.write('data: {"choices":[{"finish_reason":"stop"}]}\n\n');
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (mode === "stream-timeout-before") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      await new Promise((resolve) => setTimeout(resolve, 120));
      response.write('data: {"choices":[{"delta":{"content":"late"}}]}\n\n');
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (mode === "stream-timeout-mid") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
      await new Promise((resolve) => setTimeout(resolve, 120));
      response.write('data: {"choices":[{"delta":{"content":" tail"}}]}\n\n');
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (mode === "stream-interrupted") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"content":"unfinished"}}]}\n\n');
      response.end();
      return;
    }

    if (mode === "stream-parse") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write("data: {invalid\n\n");
      response.end();
      return;
    }

    if (mode === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 120));
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ choices: [{ message: { content: "too late" } }] }));
      return;
    }

    if (mode === "rate-limit") {
      response.statusCode = 429;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "slow down" } }));
      return;
    }

    if (mode === "upstream-http") {
      response.statusCode = 502;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: { code: "bad_gateway", message: "temporary upstream issue" } }));
      return;
    }

    if (mode === "parse") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end("{invalid");
      return;
    }

    if (mode === "empty") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ choices: [{ message: { content: "   " } }] }));
      return;
    }

    if (mode === "truncated") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "partial answer" } }] }));
      return;
    }

    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const client = createDeepSeekClient(
    {
      apiKey: "test-key",
      baseUrl: `http://127.0.0.1:${port}`
    },
    {
      fetchImpl: (input, init = {}) =>
        fetch(input, {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            "x-test-mode": globalThis.__deepseek_test_mode ?? "success"
          }
        })
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_test_mode = "timeout";
      await client.createChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user",
        signal: AbortSignal.timeout(30)
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "timeout");
      assert.equal(error.diagnostics.abort_fired, true);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_test_mode = "rate-limit";
      await client.createChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user"
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "rate_limit");
      assert.equal(error.diagnostics.provider_http_status, 429);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_test_mode = "upstream-http";
      await client.createChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user"
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "upstream_http_error");
      assert.equal(error.diagnostics.provider_http_status, 502);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_test_mode = "parse";
      await client.createChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user"
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "response_parse_error");
      assert.equal(error.diagnostics.stage, "response_json");
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_test_mode = "empty";
      await client.createChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user"
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "empty_response");
      assert.equal(error.diagnostics.stage, "extract_content");
      return true;
    }
  );

  globalThis.__deepseek_test_mode = "success";
  const completion = await client.createChatCompletion({
    model: "deepseek-chat",
    systemPrompt: "system",
    userPrompt: "user"
  });
  assert.equal(completion.content, "ok");
  assert.equal(completion.diagnostics.provider_http_status, 200);
  assert.equal(completion.diagnostics.finish_reason, "stop");
  assert.equal(completion.diagnostics.output_truncated, false);

  globalThis.__deepseek_test_mode = "truncated";
  const truncatedCompletion = await client.createChatCompletion({
    model: "deepseek-chat",
    systemPrompt: "system",
    userPrompt: "user"
  });
  assert.equal(truncatedCompletion.content, "partial answer");
  assert.equal(truncatedCompletion.diagnostics.finish_reason, "length");
  assert.equal(truncatedCompletion.diagnostics.output_truncated, true);
});

test("deepseek client streaming adapter handles success, interruptions, parse failures, and timeouts", async (t) => {
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    const mode = request.headers["x-test-mode"];
    if (mode === "stream-success") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"content":"Первая "}}]}\n\n');
      await new Promise((resolve) => setTimeout(resolve, 20));
      response.write('data: {"choices":[{"delta":{"content":"часть"}}]}\n\n');
      await new Promise((resolve) => setTimeout(resolve, 20));
      response.write('data: {"choices":[{"finish_reason":"stop"}]}\n\n');
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (mode === "stream-timeout-before") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      await new Promise((resolve) => setTimeout(resolve, 120));
      response.write('data: {"choices":[{"delta":{"content":"late start"}}]}\n\n');
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (mode === "stream-timeout-mid") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
      await new Promise((resolve) => setTimeout(resolve, 120));
      response.write('data: {"choices":[{"delta":{"content":" finish"}}]}\n\n');
      response.write("data: [DONE]\n\n");
      response.end();
      return;
    }

    if (mode === "stream-interrupted") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write('data: {"choices":[{"delta":{"content":"unfinished"}}]}\n\n');
      response.end();
      return;
    }

    if (mode === "stream-parse") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      response.write("data: {invalid\n\n");
      response.end();
      return;
    }

    response.statusCode = 500;
    response.end("unexpected mode");
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const client = createDeepSeekClient(
    {
      apiKey: "test-key",
      baseUrl: `http://127.0.0.1:${port}`
    },
    {
      fetchImpl: (input, init = {}) =>
        fetch(input, {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            "x-test-mode": globalThis.__deepseek_stream_test_mode ?? "stream-success"
          }
        })
    }
  );

  const deltas = [];
  globalThis.__deepseek_stream_test_mode = "stream-success";
  const success = await client.streamChatCompletion({
    model: "deepseek-chat",
    systemPrompt: "system",
    userPrompt: "user",
    onDelta(delta) {
      deltas.push(delta);
    }
  });
  assert.deepEqual(deltas, ["Первая ", "часть"]);
  assert.equal(success.content, "Первая часть");
  assert.equal(success.diagnostics.finish_reason, "stop");
  assert.equal(success.diagnostics.received_done, true);
  assert.equal(typeof success.diagnostics.time_to_first_chunk_ms, "number");
  assert.equal(success.diagnostics.output_truncated, false);

  await assert.rejects(
    async () => {
      globalThis.__deepseek_stream_test_mode = "stream-timeout-before";
      await client.streamChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user",
        signal: AbortSignal.timeout(30)
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "timeout_before_first_chunk");
      assert.equal(error.diagnostics.first_chunk_at_ms ?? null, null);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_stream_test_mode = "stream-timeout-mid";
      await client.streamChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user",
        signal: AbortSignal.timeout(40)
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "timeout_mid_stream");
      assert.equal(error.diagnostics.streamed_chars, "partial".length);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_stream_test_mode = "stream-interrupted";
      await client.streamChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user"
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "stream_interrupted");
      assert.equal(error.diagnostics.received_done, false);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      globalThis.__deepseek_stream_test_mode = "stream-parse";
      await client.streamChatCompletion({
        model: "deepseek-chat",
        systemPrompt: "system",
        userPrompt: "user"
      });
    },
    (error) => {
      assert.ok(error instanceof DeepSeekClientError);
      assert.equal(error.code, "response_parse_error");
      assert.equal(error.diagnostics.stage, "stream_event_json");
      return true;
    }
  );
});
