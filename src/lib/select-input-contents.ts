import type { FocusEvent, PointerEvent } from 'react';

const NON_SELECTABLE_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'radio',
  'reset',
  'submit',
]);

const skipSelectOnFocus = new WeakSet<EventTarget>();

function shouldAutoSelect(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (target.disabled || target.readOnly) {
    return false;
  }
  if (target instanceof HTMLInputElement && NON_SELECTABLE_INPUT_TYPES.has(target.type.toLowerCase())) {
    return false;
  }
  return true;
}

export function markEditableInputPointerDown(
  event: PointerEvent<HTMLElement>,
): void {
  const target = event.target;
  if (!shouldAutoSelect(target)) return;
  if (document.activeElement === target) {
    skipSelectOnFocus.add(target);
  }
}

export function selectInputContentsOnFocus(event: FocusEvent<HTMLElement>): void {
  const target = event.target;
  if (!shouldAutoSelect(target)) return;
  if (skipSelectOnFocus.has(target)) {
    skipSelectOnFocus.delete(target);
    return;
  }
  requestAnimationFrame(() => target.select());
}

export const autoSelectInputCaptureHandlers = {
  onPointerDownCapture: markEditableInputPointerDown,
  onFocusCapture: selectInputContentsOnFocus,
} as const;
