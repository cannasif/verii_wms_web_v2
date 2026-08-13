export const DEFAULT_ACTION_BUSY_MS = 350;

export function remainingActionBusyTime(
  startedAt: number,
  minimumBusyMs = DEFAULT_ACTION_BUSY_MS,
  now = Date.now(),
): number {
  if (!Number.isFinite(minimumBusyMs) || minimumBusyMs <= 0) return 0;
  return Math.max(0, minimumBusyMs - Math.max(0, now - startedAt));
}

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value
      && (typeof value === 'object' || typeof value === 'function')
      && typeof (value as PromiseLike<unknown>).then === 'function',
  );
}
