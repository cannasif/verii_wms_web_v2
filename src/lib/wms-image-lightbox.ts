export const WMS_IMAGE_LIGHTBOX_SELECTOR = '[data-wms-image-lightbox]' as const;

type RadixOutsideEvent = {
  preventDefault: () => void;
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
};

export function isWithinWmsImageLightbox(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(WMS_IMAGE_LIGHTBOX_SELECTOR));
}

export function isWmsImageLightboxOpen(): boolean {
  return typeof document !== 'undefined' && Boolean(document.querySelector(WMS_IMAGE_LIGHTBOX_SELECTOR));
}

function getOutsideInteractionTarget(event: RadixOutsideEvent): EventTarget | null {
  const originalTarget = event.detail?.originalEvent?.target;
  if (originalTarget instanceof Element) return originalTarget;
  return event.target;
}

export function preventDialogDismissIfImageLightbox(event: RadixOutsideEvent): void {
  if (isWithinWmsImageLightbox(getOutsideInteractionTarget(event))) {
    event.preventDefault();
  }
}

export function preventDialogEscapeIfImageLightbox(event: { preventDefault: () => void }): void {
  if (isWmsImageLightboxOpen()) {
    event.preventDefault();
  }
}

export function shouldIgnoreDialogClose(): boolean {
  return isWmsImageLightboxOpen();
}

export function getNextLightboxFocusIndex(
  currentIndex: number,
  focusableCount: number,
  shiftKey: boolean,
): number {
  if (focusableCount <= 1) return 0;
  if (shiftKey) return currentIndex <= 0 ? focusableCount - 1 : currentIndex - 1;
  return currentIndex < 0 || currentIndex >= focusableCount - 1 ? 0 : currentIndex + 1;
}
