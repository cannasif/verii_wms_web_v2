import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

export type PopoverVerticalSide = 'top' | 'bottom';

export interface VerticalSpaceSnapshot {
  spaceTop: number;
  spaceBottom: number;
  required: number;
}

export function measureVerticalSpace(
  triggerRect: DOMRect,
  collisionPadding: number,
): Pick<VerticalSpaceSnapshot, 'spaceTop' | 'spaceBottom'> {
  return {
    spaceTop: triggerRect.top - collisionPadding,
    spaceBottom: window.innerHeight - triggerRect.bottom - collisionPadding,
  };
}

export function pickInitialPopoverSide(
  snapshot: VerticalSpaceSnapshot,
  preferredSide: PopoverVerticalSide,
): PopoverVerticalSide {
  const { spaceTop, spaceBottom, required } = snapshot;
  const fitsTop = spaceTop >= required;
  const fitsBottom = spaceBottom >= required;

  if (preferredSide === 'top') {
    if (fitsTop) return 'top';
    if (fitsBottom) return 'bottom';
    return spaceTop >= spaceBottom ? 'top' : 'bottom';
  }

  if (fitsBottom) return 'bottom';
  if (fitsTop) return 'top';
  return spaceBottom >= spaceTop ? 'bottom' : 'top';
}

export function resolveStickyPopoverSideOnMove(
  currentSide: PopoverVerticalSide,
  snapshot: VerticalSpaceSnapshot,
): PopoverVerticalSide {
  const { spaceTop, spaceBottom, required } = snapshot;
  const space = currentSide === 'top' ? spaceTop : spaceBottom;
  const opposite: PopoverVerticalSide = currentSide === 'top' ? 'bottom' : 'top';
  const oppositeSpace = currentSide === 'top' ? spaceBottom : spaceTop;

  if (space >= required) return currentSide;
  if (oppositeSpace >= required) return opposite;
  return oppositeSpace > space ? opposite : currentSide;
}

export interface UseStickyPopoverSideOptions {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  preferredSide?: PopoverVerticalSide;
  collisionPadding?: number;
  sideOffset?: number;
  estimatedHeight?: number;
}

const DEFAULT_ESTIMATED_HEIGHT = 280;

export function useStickyPopoverSide({
  open,
  triggerRef,
  contentRef: _contentRef,
  preferredSide = 'bottom',
  collisionPadding = 12,
  sideOffset = 6,
  estimatedHeight = DEFAULT_ESTIMATED_HEIGHT,
}: UseStickyPopoverSideOptions): PopoverVerticalSide {
  const [side, setSide] = useState<PopoverVerticalSide>(preferredSide);
  const lockedSideRef = useRef<PopoverVerticalSide>(preferredSide);

  const buildSnapshot = useCallback((required: number): VerticalSpaceSnapshot | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const { spaceTop, spaceBottom } = measureVerticalSpace(
      trigger.getBoundingClientRect(),
      collisionPadding,
    );

    return { spaceTop, spaceBottom, required };
  }, [collisionPadding, triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;

    const required = estimatedHeight + sideOffset + collisionPadding;

    const chooseInitialSide = (): void => {
      const snapshot = buildSnapshot(required);
      if (!snapshot) return;
      const initial = pickInitialPopoverSide(snapshot, preferredSide);
      lockedSideRef.current = initial;
      setSide(initial);
    };

    chooseInitialSide();
    const frame = window.requestAnimationFrame(chooseInitialSide);
    return () => window.cancelAnimationFrame(frame);
  }, [buildSnapshot, collisionPadding, estimatedHeight, open, preferredSide, sideOffset]);

  return side;
}
