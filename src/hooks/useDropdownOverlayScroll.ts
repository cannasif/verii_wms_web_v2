import { useEffect, type RefObject } from 'react';

/**
 * Dialog scroll-lock (RemoveScroll) body'de wheel/touch'ı yutunca,
 * body'ye portallanmış dropdown listesinin kaymasını ve sonsuz yüklemeyi korur.
 */
export function useDropdownOverlayScroll(
  listRef: RefObject<HTMLDivElement | null>,
  open: boolean,
): void {
  useEffect(() => {
    if (!open) return;

    let lastTouchY = 0;

    const isInList = (target: EventTarget | null): boolean => {
      const list = listRef.current;
      return Boolean(list && target instanceof Node && list.contains(target));
    };

    const applyDelta = (delta: number): boolean => {
      const list = listRef.current;
      if (!list) return false;
      const maxScroll = list.scrollHeight - list.clientHeight;
      if (maxScroll <= 0) return false;
      list.scrollTop = Math.min(maxScroll, Math.max(0, list.scrollTop + delta));
      return true;
    };

    const onWheel = (event: WheelEvent): void => {
      if (!isInList(event.target)) return;
      if (!applyDelta(event.deltaY)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onTouchStart = (event: TouchEvent): void => {
      if (!isInList(event.target)) return;
      lastTouchY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent): void => {
      if (!isInList(event.target)) return;
      const y = event.touches[0]?.clientY ?? lastTouchY;
      const delta = lastTouchY - y;
      lastTouchY = y;
      if (!applyDelta(delta)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('touchmove', onTouchMove, { capture: true });
    };
  }, [listRef, open]);
}
