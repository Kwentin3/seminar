export class DeepSeekClientError extends Error {
  constructor(message, { code, status = 500, retryable = false, diagnostics = null } = {}) {
    super(message);
    this.name = "DeepSeekClientError";
    this.code = code ?? "provider_error";
    this.status = status;
    this.retryable = retryable;
    this.diagnostics = diagnostics && typeof diagnostics === "object" ? diagnostics : null;
  }
}

function readString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateMessage(value, maxLength = 160) {
  const normalized = readString(value)?.replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function normalizeErrorPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = payload.error;
  if (!error || typeof error !== "object") {
    return null;
  }

  const message = typeof error.message === "string" ? error.message.trim() : null;
  const code = typeof error.code === "string" ? error.code.trim() : null;
  return {
    message,
    code
  };
}

function readResponseText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim().length > 0 ? content.trim() : null;
}

function readStreamDeltaText(payload) {
  const content = payload?.choices?.[0]?.delta?.content;
  return typeof content === "string" && content.length > 0 ? content : null;
}

function readFinishReason(payload) {
  const finishReason = payload?.choices?.[0]?.finish_reason;
  return typeof finishReason === "string" && finishReason.trim().length > 0 ? finishReason.trim() : null;
}

function buildChatCompletionBody({
  model,
  systemPrompt,
  userPrompt,
  temperature,
  maxOutputTokens,
  stream = false
}) {
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    stream
  };

  if (typeof temperature === "number" && Number.isFinite(temperature)) {
    body.temperature = temperature;
  }

  if (typeof maxOutputTokens === "number" && Number.isInteger(maxOutputTokens) && maxOutputTokens > 0) {
    body.max_tokens = maxOutputTokens;
  }

  if (stream) {
    body.stream_options = {
      include_usage: true
    };
  }

  return body;
}

function buildRequestInit(config, body, signal) {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal
  };
}

async function readResponsePayload(response) {
  const responseText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }

  return {
    responseText,
    payload
  };
}

function readAbortDiagnostics(signal, durationMs, stage, responseStatus = null) {
  return {
    stage,
    duration_ms: durationMs,
    abort_fired: signal?.aborted === true,
    provider_http_status: responseStatus,
    provider_message: null
  };
}

function takeNextSseFrame(buffer) {
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  const lfIndex = buffer.indexOf("\n\n");
  if (crlfIndex === -1 && lfIndex === -1) {
    return null;
  }

  const useCrlf = crlfIndex !== -1 && (lfIndex === -1 || crlfIndex < lfIndex);
  const boundaryIndex = useCrlf ? crlfIndex : lfIndex;
  const boundaryLength = useCrlf ? 4 : 2;
  return {
    frame: buffer.slice(0, boundaryIndex),
    rest: buffer.slice(boundaryIndex + boundaryLength)
  };
}

function extractSseData(frame) {
  if (typeof frame !== "string" || frame.trim().length === 0) {
    return null;
  }

  const dataLines = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line.startsWith("data:")) {
      continue;
    }

    dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join("\n");
}

function toProviderError(responseStatus, payload, diagnostics = null) {
  const normalized = normalizeErrorPayload(payload);
  if (responseStatus === 401 || responseStatus === 403) {
    return new DeepSeekClientError(normalized?.message ?? "DeepSeek API key is invalid.", {
      code: "invalid_key",
      status: responseStatus,
      retryable: false,
      diagnostics: {
        ...diagnostics,
        provider_http_status: responseStatus,
        provider_message: truncateMessage(normalized?.message)
      }
    });
  }

  if (responseStatus === 429) {
    return new DeepSeekClientError(normalized?.message ?? "DeepSeek rate limit exceeded.", {
      code: "rate_limit",
      status: responseStatus,
      retryable: true,
      diagnostics: {
        ...diagnostics,
        provider_http_status: responseStatus,
        provider_message: truncateMessage(normalized?.message)
      }
    });
  }

  if (responseStatus >= 500) {
    return new DeepSeekClientError(normalized?.message ?? "DeepSeek upstream returned an HTTP error.", {
      code: "upstream_http_error",
      status: responseStatus,
      retryable: true,
      diagnostics: {
        ...diagnostics,
        provider_http_status: responseStatus,
        provider_message: truncateMessage(normalized?.message)
      }
    });
  }

  return new DeepSeekClientError(normalized?.message ?? "DeepSeek request failed.", {
    code: "provider_error",
    status: responseStatus,
    retryable: false,
    diagnostics: {
      ...diagnostics,
      provider_http_status: responseStatus,
      provider_message: truncateMessage(normalized?.message)
    }
  });
}

export function createDeepSeekClient(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("DeepSeek client requires fetch.");
  }

  return {
    async streamChatCompletion({
      model,
      systemPrompt,
      userPrompt,
      temperature = null,
      maxOutputTokens = null,
      signal,
      onDelta
    }) {
      if (!config.apiKey) {
        throw new DeepSeekClientError("DeepSeek API key is not configured.", {
          code: "config_missing",
          status: 503,
          retryable: false
        });
      }

      const startedAt = Date.now();
      const body = buildChatCompletionBody({
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxOutputTokens,
        stream: true
      });

      let response;
      try {
        response = await fetchImpl(
          `${config.baseUrl}/chat/completions`,
          buildRequestInit(config, body, signal)
        );
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        if (signal?.aborted === true || error?.name === "AbortError") {
          throw new DeepSeekClientError("DeepSeek request timed out before the first chunk.", {
            code: "timeout_before_first_chunk",
            status: 504,
            retryable: true,
            diagnostics: readAbortDiagnostics(signal, durationMs, "stream_transport")
          });
        }

        throw new DeepSeekClientError("DeepSeek stream failed before opening.", {
          code: "stream_open_failed",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "stream_transport",
            duration_ms: durationMs,
            abort_fired: false,
            provider_http_status: null,
            provider_message: truncateMessage(error?.message)
          }
        });
      }

      if (!response.ok) {
        const { payload } = await readResponsePayload(response);
        throw toProviderError(response.status, payload, {
          stage: "upstream_http",
          duration_ms: Date.now() - startedAt,
          abort_fired: signal?.aborted === true
        });
      }

      if (!response.body) {
        throw new DeepSeekClientError("DeepSeek stream body is unavailable.", {
          code: "stream_open_failed",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "stream_open",
            duration_ms: Date.now() - startedAt,
            abort_fired: signal?.aborted === true,
            provider_http_status: response.status,
            provider_message: null
          }
        });
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";
      let content = "";
      let finishReason = null;
      let firstChunkAt = null;
      let lastChunkAt = null;
      let streamedChars = 0;
      let receivedDone = false;

      const processFrame = async (frame) => {
        const data = extractSseData(frame);
        if (!data) {
          return;
        }

        if (data === "[DONE]") {
          receivedDone = true;
          if (lastChunkAt === null && firstChunkAt !== null) {
            lastChunkAt = Date.now();
          }
          return;
        }

        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          throw new DeepSeekClientError("DeepSeek returned malformed SSE JSON.", {
            code: "response_parse_error",
            status: 502,
            retryable: true,
            diagnostics: {
              stage: "stream_event_json",
              duration_ms: Date.now() - startedAt,
              abort_fired: signal?.aborted === true,
              provider_http_status: response.status,
              provider_message: null,
              response_body_length: data.length,
              response_content_type: response.headers.get("content-type")
            }
          });
        }

        const nextFinishReason = readFinishReason(payload);
        if (nextFinishReason) {
          finishReason = nextFinishReason;
        }

        const deltaText = readStreamDeltaText(payload);
        if (!deltaText) {
          return;
        }

        const now = Date.now();
        if (firstChunkAt === null) {
          firstChunkAt = now;
        }
        lastChunkAt = now;
        streamedChars += deltaText.length;
        content += deltaText;

        if (typeof onDelta === "function") {
          await onDelta(deltaText);
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          while (true) {
            const nextFrame = takeNextSseFrame(buffer);
            if (!nextFrame) {
              break;
            }

            buffer = nextFrame.rest;
            await processFrame(nextFrame.frame);
          }
        }
      } catch (error) {
        if (error instanceof DeepSeekClientError) {
          throw error;
        }

        const durationMs = Date.now() - startedAt;
        if (signal?.aborted === true || error?.name === "AbortError") {
          throw new DeepSeekClientError(
            firstChunkAt === null ? "DeepSeek stream timed out before first chunk." : "DeepSeek stream timed out mid-stream.",
            {
              code: firstChunkAt === null ? "timeout_before_first_chunk" : "timeout_mid_stream",
              status: 504,
              retryable: true,
              diagnostics: {
                stage: "stream_read",
                duration_ms: durationMs,
                abort_fired: true,
                provider_http_status: response.status,
                provider_message: null,
                time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
                stream_duration_ms:
                  firstChunkAt === null || lastChunkAt === null ? null : lastChunkAt - firstChunkAt,
                first_chunk_at_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
                last_chunk_at_ms: lastChunkAt === null ? null : lastChunkAt - startedAt,
                streamed_chars: streamedChars,
                finish_reason: finishReason,
                received_done: receivedDone
              }
            }
          );
        }

        throw new DeepSeekClientError(
          firstChunkAt === null ? "DeepSeek stream failed before first chunk." : "DeepSeek stream was interrupted.",
          {
            code: firstChunkAt === null ? "stream_open_failed" : "stream_interrupted",
            status: 502,
            retryable: true,
            diagnostics: {
              stage: "stream_read",
              duration_ms: durationMs,
              abort_fired: false,
              provider_http_status: response.status,
              provider_message: truncateMessage(error?.message),
              time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
              stream_duration_ms:
                firstChunkAt === null || lastChunkAt === null ? null : lastChunkAt - firstChunkAt,
              first_chunk_at_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
              last_chunk_at_ms: lastChunkAt === null ? null : lastChunkAt - startedAt,
              streamed_chars: streamedChars,
              finish_reason: finishReason,
              received_done: receivedDone
            }
          }
        );
      }

      buffer += decoder.decode();
      if (buffer.trim().length > 0) {
        await processFrame(buffer);
      }

      const normalizedContent = content.trim();
      if (normalizedContent.length === 0) {
        throw new DeepSeekClientError("DeepSeek stream returned an empty completion.", {
          code: "empty_response",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "extract_stream_content",
            duration_ms: Date.now() - startedAt,
            abort_fired: signal?.aborted === true,
            provider_http_status: response.status,
            provider_message: null,
            time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
            stream_duration_ms:
              firstChunkAt === null || lastChunkAt === null ? null : lastChunkAt - firstChunkAt,
            first_chunk_at_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
            last_chunk_at_ms: lastChunkAt === null ? null : lastChunkAt - startedAt,
            streamed_chars: streamedChars,
            finish_reason: finishReason,
            received_done: receivedDone
          }
        });
      }

      if (!receivedDone) {
        throw new DeepSeekClientError("DeepSeek stream ended without a final DONE marker.", {
          code: "stream_interrupted",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "stream_done",
            duration_ms: Date.now() - startedAt,
            abort_fired: signal?.aborted === true,
            provider_http_status: response.status,
            provider_message: null,
            time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
            stream_duration_ms:
              firstChunkAt === null || lastChunkAt === null ? null : lastChunkAt - firstChunkAt,
            first_chunk_at_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
            last_chunk_at_ms: lastChunkAt === null ? null : lastChunkAt - startedAt,
            streamed_chars: streamedChars,
            finish_reason: finishReason,
            received_done: receivedDone
          }
        });
      }

      return {
        content: normalizedContent,
        diagnostics: {
          stage: "stream_completed",
          duration_ms: Date.now() - startedAt,
          abort_fired: signal?.aborted === true,
          provider_http_status: response.status,
          time_to_first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
          stream_duration_ms:
            firstChunkAt === null || lastChunkAt === null ? null : lastChunkAt - firstChunkAt,
          first_chunk_at_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
          last_chunk_at_ms: lastChunkAt === null ? null : lastChunkAt - startedAt,
          streamed_chars: streamedChars,
          finish_reason: finishReason,
          received_done: receivedDone,
          output_truncated: finishReason === "length"
        }
      };
    },
    async createChatCompletion({
      model,
      systemPrompt,
      userPrompt,
      temperature = null,
      maxOutputTokens = null,
      signal
    }) {
      if (!config.apiKey) {
        throw new DeepSeekClientError("DeepSeek API key is not configured.", {
          code: "config_missing",
          status: 503,
          retryable: false
        });
      }

      const body = buildChatCompletionBody({
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxOutputTokens,
        stream: false
      });

      const startedAt = Date.now();

      let response;
      try {
        response = await fetchImpl(`${config.baseUrl}/chat/completions`, buildRequestInit(config, body, signal));
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const abortFired = signal?.aborted === true || error?.name === "AbortError";
        if (abortFired) {
          throw new DeepSeekClientError("DeepSeek request timed out.", {
            code: "timeout",
            status: 504,
            retryable: true,
            diagnostics: {
              stage: "transport",
              duration_ms: durationMs,
              abort_fired: true,
              provider_http_status: null,
              provider_message: null
            }
          });
        }

        throw new DeepSeekClientError("DeepSeek request failed before completion.", {
          code: "provider_error",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "transport",
            duration_ms: durationMs,
            abort_fired: false,
            provider_http_status: null,
            provider_message: truncateMessage(error?.message)
          }
        });
      }

      const { responseText, payload } = await readResponsePayload(response);
      const durationMs = Date.now() - startedAt;
      if (!payload && response.ok) {
        throw new DeepSeekClientError("DeepSeek returned malformed JSON.", {
          code: "response_parse_error",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "response_json",
            duration_ms: durationMs,
            abort_fired: signal?.aborted === true,
            provider_http_status: response.status,
            provider_message: null,
            response_content_type: response.headers.get("content-type"),
            response_body_length: responseText.length
          }
        });
      }

      if (!response.ok) {
        throw toProviderError(response.status, payload, {
          stage: "upstream_http",
          duration_ms: durationMs,
          abort_fired: signal?.aborted === true
        });
      }

      const content = readResponseText(payload);
      if (!content) {
        throw new DeepSeekClientError("DeepSeek returned an empty completion.", {
          code: "empty_response",
          status: 502,
          retryable: true,
          diagnostics: {
            stage: "extract_content",
            duration_ms: durationMs,
            abort_fired: signal?.aborted === true,
            provider_http_status: response.status,
            provider_message: null
          }
        });
      }

      const finishReason = readFinishReason(payload);
      const outputTruncated = finishReason === "length";

      return {
        content,
        diagnostics: {
          stage: "completed",
          duration_ms: durationMs,
          abort_fired: signal?.aborted === true,
          provider_http_status: response.status,
          finish_reason: finishReason,
          output_truncated: outputTruncated
        }
      };
    }
  };
}
