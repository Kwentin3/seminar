export class DeepSeekClientError extends Error {
  constructor(message, { code, status = 500, retryable = false } = {}) {
    super(message);
    this.name = "DeepSeekClientError";
    this.code = code ?? "provider_error";
    this.status = status;
    this.retryable = retryable;
  }
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

function toProviderError(responseStatus, payload) {
  const normalized = normalizeErrorPayload(payload);
  if (responseStatus === 401 || responseStatus === 403) {
    return new DeepSeekClientError(normalized?.message ?? "DeepSeek API key is invalid.", {
      code: "invalid_key",
      status: responseStatus,
      retryable: false
    });
  }

  if (responseStatus === 429) {
    return new DeepSeekClientError(normalized?.message ?? "DeepSeek rate limit exceeded.", {
      code: "rate_limit",
      status: responseStatus,
      retryable: true
    });
  }

  return new DeepSeekClientError(normalized?.message ?? "DeepSeek request failed.", {
    code: "provider_error",
    status: responseStatus,
    retryable: responseStatus >= 500
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
        if (signal?.aborted) {
          throw new DeepSeekClientError("DeepSeek request timed out.", {
            code: "timeout",
            status: 504,
            retryable: true
          });
        }

        throw new DeepSeekClientError("DeepSeek request failed before completion.", {
          code: "provider_error",
          status: 502,
          retryable: true
        });
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw toProviderError(response.status, payload);
      }

      const content = readResponseText(payload);
      if (!content) {
        throw new DeepSeekClientError("DeepSeek returned an empty completion.", {
          code: "provider_error",
          status: 502,
          retryable: true
        });
      }

      return {
        content
      };
    }
  };
}
