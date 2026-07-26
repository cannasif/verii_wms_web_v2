const sessionRefreshLockName = 'wms-auth-session-refresh';

export async function withSessionRefreshLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return operation();
  }

  return navigator.locks.request(
    sessionRefreshLockName,
    { mode: 'exclusive' },
    operation,
  );
}
