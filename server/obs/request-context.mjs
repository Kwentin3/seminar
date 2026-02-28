import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const requestContextStorage = new AsyncLocalStorage();

export function createRequestContext(requestId) {
  return {
    request_id: requestId,
    info_emitted_count: 0,
    suppressed_info_count: 0,
    info_rate_limited_emitted: false
  };
}

export function getRequestContext() {
  return requestContextStorage.getStore() ?? null;
}

export function getRequestId() {
  return getRequestContext()?.request_id ?? null;
}

export function runWithRequestContext(context, callback) {
  return requestContextStorage.run(context, callback);
}

export function generateRequestId() {
  return `req_${randomUUID()}`;
}

export function createRequestContextMiddleware() {
  return (request, response, next) => {
    const requestId = generateRequestId();
    const context = createRequestContext(requestId);

    response.setHeader("x-request-id", requestId);

    runWithRequestContext(context, () => {
      next();
    });
  };
}
