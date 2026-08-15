import axios from 'axios';

export type ApiRequestOptions = {
  signal?: AbortSignal;
};

/**
 * Carries React Query's abort signal through existing paged API wrappers.
 * Symbols survive object spread but are ignored by JSON serialization, so the
 * transport concern never becomes part of the API request contract.
 */
export const REQUEST_ABORT_SIGNAL = Symbol('wms-request-abort-signal');

export type RequestAbortSignalCarrier = {
  [REQUEST_ABORT_SIGNAL]?: AbortSignal;
};

export function withRequestAbortSignal<TRequest extends object>(
  request: TRequest,
  signal?: AbortSignal,
): TRequest & RequestAbortSignalCarrier {
  if (!signal) return request;
  return Object.assign({}, request, { [REQUEST_ABORT_SIGNAL]: signal });
}

export function getRequestAbortSignal(value: unknown): AbortSignal | undefined {
  if (value == null || typeof value !== 'object') return undefined;
  return (value as RequestAbortSignalCarrier)[REQUEST_ABORT_SIGNAL];
}

export function isRequestCanceled(error: unknown): boolean {
  if (axios.isCancel(error)) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error) {
    return (
      error.name === 'CanceledError'
      || error.name === 'AbortError'
      || error.message === 'canceled'
      || error.message === 'duplicate-request'
    );
  }

  return false;
}

export function invokeWithSignal<TResult>(
  fn: (...args: unknown[]) => Promise<TResult>,
  args: unknown[],
  signal?: AbortSignal,
): Promise<TResult> {
  return fn(...args, { signal });
}
