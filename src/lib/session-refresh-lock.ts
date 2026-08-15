const sessionRefreshLockName = 'wms-auth-session-refresh';
const SESSION_LOCK_TIMEOUT_MS = 8_000;

function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function withSessionRefreshLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return operation();
  }

  try {
    return await navigator.locks.request(
      sessionRefreshLockName,
      { mode: 'exclusive', signal: abortAfter(SESSION_LOCK_TIMEOUT_MS) },
      operation,
    );
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    if (!aborted) throw error;
    // Another tab can hold this lock while a hung refresh never finishes.
    // Continue without the lock so this tab can still paint and recover.
    return operation();
  }
}
