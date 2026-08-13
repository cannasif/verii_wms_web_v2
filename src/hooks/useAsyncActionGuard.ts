import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ACTION_BUSY_MS,
  isPromiseLike,
  remainingActionBusyTime,
} from '@/lib/async-action-guard';

export type AsyncActionHandler<Event> = (
  event: Event,
) => unknown | PromiseLike<unknown>;

export function useAsyncActionGuard<Event>(
  onAction: AsyncActionHandler<Event> | undefined,
  enabled = true,
  minimumBusyMs = DEFAULT_ACTION_BUSY_MS,
): { busy: boolean; run: (event: Event) => void } {
  const lockRef = useRef(false);
  const mountedRef = useRef(true);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  const run = useCallback((event: Event) => {
    if (!enabled) {
      onAction?.(event);
      return;
    }

    if (lockRef.current) return;

    lockRef.current = true;
    setBusy(true);
    const startedAt = Date.now();

    const release = () => {
      const remaining = remainingActionBusyTime(startedAt, minimumBusyMs);
      releaseTimerRef.current = setTimeout(() => {
        lockRef.current = false;
        if (mountedRef.current) setBusy(false);
        releaseTimerRef.current = null;
      }, remaining);
    };

    let result: unknown;
    try {
      result = onAction?.(event);
    } catch (error) {
      release();
      throw error;
    }

    if (isPromiseLike(result)) {
      void Promise.resolve(result).then(release, release);
      return;
    }

    release();
  }, [enabled, minimumBusyMs, onAction]);

  return { busy, run };
}
