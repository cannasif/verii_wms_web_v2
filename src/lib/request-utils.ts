import axios from 'axios';

export type ApiRequestOptions = {
  signal?: AbortSignal;
};

export function isRequestCanceled(error: unknown): boolean {
  if (axios.isCancel(error)) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error) {
    return error.name === 'CanceledError' || error.name === 'AbortError' || error.message === 'canceled';
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
