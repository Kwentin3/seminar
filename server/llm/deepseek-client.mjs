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
        stream: false
      };

      const startedAt = Date.now();

      if (typeof temperature === "number" && Number.isFinite(temperature)) {
        body.temperature = temperature;
      }

      if (typeof maxOutputTokens === "number" && Number.isInteger(maxOutputTokens) && maxOutputTokens > 0) {
        body.max_tokens = maxOutputTokens;
      }

      let response;
      try {
        response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal
        });
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

      const responseText = await response.text();
      const durationMs = Date.now() - startedAt;
      let payload = null;
      try {
        payload = JSON.parse(responseText);
      } catch {
        if (response.ok) {
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

      return {
        content,
        diagnostics: {
          stage: "completed",
          duration_ms: durationMs,
          abort_fired: signal?.aborted === true,
          provider_http_status: response.status
        }
      };
    }
  };
}
