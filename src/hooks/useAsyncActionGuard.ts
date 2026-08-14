import { useCallback, useEffect, useRef, useState } from 'react';
import { isPromiseLike } from '@/lib/async-action-guard';

export type AsyncActionHandler<Event> = (
  event: Event,
) => unknown | PromiseLike<unknown>;

export function useAsyncActionGuard<Event>(
  onAction: AsyncActionHandler<Event> | undefined,
  enabled = true,
): { busy: boolean; run: (event: Event) => void } {
  const lockRef = useRef(false);
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback((event: Event) => {
    if (!enabled || !onAction) {
      onAction?.(event);
      return;
    }

    if (lockRef.current) return;

    lockRef.current = true;
    setBusy(true);

    const release = () => {
      lockRef.current = false;
      if (mountedRef.current) setBusy(false);
    };

    let result: unknown;
    try {
      result = onAction(event);
    } catch (error) {
      release();
      throw error;
    }

    if (isPromiseLike(result)) {
      void Promise.resolve(result).then(release, release);
      return;
    }

    release();
  }, [enabled, onAction]);

  return { busy, run };
}
