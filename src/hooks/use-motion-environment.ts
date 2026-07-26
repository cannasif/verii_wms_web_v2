import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function subscribePageVisibility(onStoreChange: () => void): () => void {
  document.addEventListener('visibilitychange', onStoreChange);
  return () => document.removeEventListener('visibilitychange', onStoreChange);
}

function getPageVisibilitySnapshot(): boolean {
  return document.visibilityState === 'visible';
}

export function useMotionEnvironment(): {
  prefersReducedMotion: boolean;
  isPageVisible: boolean;
} {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );
  const isPageVisible = useSyncExternalStore(
    subscribePageVisibility,
    getPageVisibilitySnapshot,
    () => false,
  );

  return { prefersReducedMotion, isPageVisible };
}
