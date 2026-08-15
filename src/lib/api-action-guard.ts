const ACTION_SELECTOR = 'button, input[type="button"], input[type="submit"], [role="button"]';
const PENDING_ATTRIBUTE = 'data-wms-api-pending';
const ASSOCIATION_WINDOW_MS = 150;
const MINIMUM_PENDING_MS = 350;

type ActionElement = HTMLElement;

export type ApiActionRequestToken = {
  element: ActionElement;
  startedAt: number;
  released: boolean;
};

type PendingState = {
  count: number;
  previousAriaBusy: string | null;
};

type RecentAction = {
  element: ActionElement;
  capturedAt: number;
};

const pendingStates = new WeakMap<ActionElement, PendingState>();
let recentAction: RecentAction | null = null;
let installed = false;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function resolveActionElement(target: EventTarget | null): ActionElement | null {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return null;
  const element = target.closest<ActionElement>(ACTION_SELECTOR);
  if (!element || element.matches(':disabled')) return null;
  if (element.dataset.wmsApiLoading === 'off') return null;
  return element;
}

function isPending(element: ActionElement): boolean {
  return element.getAttribute(PENDING_ATTRIBUTE) === 'true';
}

function captureAction(element: ActionElement): void {
  recentAction = { element, capturedAt: now() };
  window.setTimeout(() => {
    if (recentAction?.element === element && now() - recentAction.capturedAt >= ASSOCIATION_WINDOW_MS) {
      recentAction = null;
    }
  }, ASSOCIATION_WINDOW_MS);
}

function blockEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function installGlobalApiActionGuard(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('click', (event) => {
    const element = resolveActionElement(event.target);
    if (!element) return;
    if (isPending(element)) {
      blockEvent(event);
      return;
    }
    if (element.getAttribute('aria-disabled') === 'true') return;
    captureAction(element);
  }, true);

  document.addEventListener('submit', (event) => {
    const submitEvent = event as SubmitEvent;
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const submitter = resolveActionElement(submitEvent.submitter)
      ?? form?.querySelector<ActionElement>('button[type="submit"], input[type="submit"]')
      ?? null;
    if (!submitter) return;
    if (isPending(submitter)) {
      blockEvent(event);
      return;
    }
    if (submitter.getAttribute('aria-disabled') === 'true') return;
    captureAction(submitter);
  }, true);
}

export function bindApiRequestToRecentAction(): ApiActionRequestToken | undefined {
  if (!recentAction || now() - recentAction.capturedAt > ASSOCIATION_WINDOW_MS) return undefined;

  const element = recentAction.element;
  const state = pendingStates.get(element) ?? {
    count: 0,
    previousAriaBusy: element.getAttribute('aria-busy'),
  };
  state.count += 1;
  pendingStates.set(element, state);
  element.setAttribute(PENDING_ATTRIBUTE, 'true');
  element.setAttribute('aria-busy', 'true');

  return { element, startedAt: now(), released: false };
}

export function releaseApiActionRequest(token: ApiActionRequestToken | undefined): void {
  if (!token || token.released) return;
  token.released = true;
  const remaining = Math.max(0, MINIMUM_PENDING_MS - (now() - token.startedAt));

  window.setTimeout(() => {
    const state = pendingStates.get(token.element);
    if (!state) return;
    state.count = Math.max(0, state.count - 1);
    if (state.count > 0) return;

    pendingStates.delete(token.element);
    token.element.removeAttribute(PENDING_ATTRIBUTE);
    if (state.previousAriaBusy == null) token.element.removeAttribute('aria-busy');
    else token.element.setAttribute('aria-busy', state.previousAriaBusy);
  }, remaining);
}
