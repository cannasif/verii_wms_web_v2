import { toast } from 'sonner';

const HIGHLIGHT_MS = 2200;
const FLASH_CLASS = 'wms-error-focus-flash';
const FLASH_FIELD_CLASS = 'wms-error-focus-flash-field';

let installed = false;
let clearTimer: number | undefined;

function messageToText(message: unknown): string {
  if (typeof message === 'string') return message;
  if (typeof message === 'number' || typeof message === 'boolean') {
    return String(message);
  }
  return '';
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/\*/g, ' ')
    .replace(/[:·•|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreLabelMatch(message: string, label: string): number {
  const msg = normalize(message);
  const lab = normalize(label);
  if (lab.length < 3) return 0;
  if (msg.includes(lab)) return lab.length + 20;
  const words = lab.split(' ').filter((word) => word.length >= 4);
  if (words.length === 0) return 0;
  const hits = words.filter((word) => msg.includes(word));
  if (hits.length === 0) return 0;
  return hits.join('').length + hits.length * 4;
}

function resolveControlSurface(el: HTMLElement): HTMLElement {
  const nestedShell = el.querySelector<HTMLElement>(
    '.wms-ops-field-shell, .app-input-shell',
  );
  if (nestedShell && isVisible(nestedShell)) return nestedShell;

  const nestedControl = el.querySelector<HTMLElement>(
    'input:not([type="hidden"]), textarea, select, button.wms-ops-lookup-trigger, [role="combobox"]',
  );
  if (nestedControl && isVisible(nestedControl)) {
    const parentShell = nestedControl.closest<HTMLElement>(
      '.wms-ops-field-shell, .app-input-shell',
    );
    if (parentShell && isVisible(parentShell)) return parentShell;
    return nestedControl;
  }

  const ownShell = el.closest<HTMLElement>('.wms-ops-field-shell, .app-input-shell');
  if (ownShell && isVisible(ownShell)) return ownShell;

  if (
    el.matches(
      'input, textarea, select, .wms-ops-field-shell, .app-input-shell, button.wms-ops-lookup-trigger',
    )
  ) {
    return el;
  }

  if (
    el.matches(
      '.wms-ops-receipt-entry-row, section, [role="alert"], tr, .wms-ops-order-lookup',
    )
  ) {
    return el;
  }

  return el;
}

function findByExplicitTarget(message: string): HTMLElement | null {
  const msg = normalize(message);
  const nodes = document.querySelectorAll<HTMLElement>('[data-wms-error-target]');
  let best: { el: HTMLElement; score: number } | null = null;

  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const keys = (
      el.getAttribute('data-wms-error-keys') ??
      el.getAttribute('data-wms-error-target') ??
      ''
    )
      .split('|')
      .map((key) => normalize(key))
      .filter(Boolean);

    let score = 0;
    for (const key of keys) {
      if (msg.includes(key)) {
        score = Math.max(score, key.length + 30);
        continue;
      }
      const words = key.split(/\s+/).filter((word) => word.length >= 3);
      if (words.length > 0 && words.every((word) => msg.includes(word))) {
        score = Math.max(score, words.join('').length + words.length * 6);
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { el, score };
    }
  }

  return best?.el ?? null;
}

function findByInvalidState(): HTMLElement | null {
  const selectors = [
    '[aria-invalid="true"]',
    '[data-invalid="true"]',
    '.wms-ops-field-shell--error',
    '.auth-field-invalid',
    '.wms-ops-field-shell[aria-invalid="true"]',
  ];

  for (const selector of selectors) {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    for (const el of nodes) {
      if (isVisible(el)) return el;
    }
  }
  return null;
}

function findByLinePrefix(message: string): HTMLElement | null {
  const match = message.match(/^([^:\n]{3,80}):\s*/);
  if (!match) return null;
  const prefix = match[1].trim();
  const parts = prefix.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const rows = document.querySelectorAll<HTMLElement>(
    '.wms-ops-receipt-entry-row, .wms-ops-selected-order-items [class*="row"], tr',
  );

  for (const row of rows) {
    if (!isVisible(row)) continue;
    const text = row.textContent ?? '';
    if (parts.every((part) => text.includes(part))) return row;
  }
  return null;
}

function findByLabelText(message: string): HTMLElement | null {
  const labels = document.querySelectorAll<HTMLElement>(
    [
      '.wms-ops-entry-label',
      'label > span.font-semibold',
      'label span',
      'label',
      '[data-slot="form-label"]',
      'th',
    ].join(', '),
  );

  let best: { el: HTMLElement; score: number } | null = null;

  for (const label of labels) {
    if (!isVisible(label)) continue;
    const text = (label.textContent ?? '').trim();
    if (text.length < 3 || text.length > 80) continue;
    const score = scoreLabelMatch(message, text);
    if (score < 8) continue;

    const shell =
      label
        .closest<HTMLElement>(
          'label, .space-y-1, .space-y-1\\.5, .space-y-2, [class*="space-y"], .wms-ops-order-lookup__field, td, th',
        )
        ?.querySelector<HTMLElement>(
          'input, textarea, select, button, [role="combobox"], .wms-ops-field-shell, .app-input-shell, [data-wms-error-target]',
        ) ??
      label.closest<HTMLElement>(
        '.wms-ops-field-shell, .app-input-shell, [data-wms-error-target], label',
      ) ??
      label;

    if (!best || score > best.score) {
      best = { el: shell, score };
    }
  }

  return best?.el ?? null;
}

function findByAlertBanner(message: string): HTMLElement | null {
  const alerts = document.querySelectorAll<HTMLElement>('[role="alert"]');
  const msg = normalize(message);
  for (const alert of alerts) {
    if (!isVisible(alert)) continue;
    const text = normalize(alert.textContent ?? '');
    if (text && (text.includes(msg.slice(0, 40)) || msg.includes(text.slice(0, 40)))) {
      return alert;
    }
  }
  return null;
}

export function findErrorNavigationTarget(message: string): HTMLElement | null {
  return (
    findByExplicitTarget(message) ??
    findByLinePrefix(message) ??
    findByInvalidState() ??
    findByLabelText(message) ??
    findByAlertBanner(message)
  );
}

export function navigateToErrorTarget(message: string): boolean {
  const target = findErrorNavigationTarget(message);
  if (!target) return false;

  if (clearTimer != null) {
    window.clearTimeout(clearTimer);
    clearTimer = undefined;
  }

  document
    .querySelectorAll(`.${FLASH_CLASS}, .${FLASH_FIELD_CLASS}`)
    .forEach((node) => node.classList.remove(FLASH_CLASS, FLASH_FIELD_CLASS));

  const shell = resolveControlSurface(target);
  const fieldWrapper =
    target.matches('[data-wms-error-target]')
      ? target
      : target.closest<HTMLElement>('[data-wms-error-target]');

  shell.classList.add(FLASH_CLASS);
  fieldWrapper?.classList.add(FLASH_FIELD_CLASS);

  const scrollTarget = fieldWrapper ?? shell;
  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  const focusable =
    shell.matches('input, textarea, select, button, [tabindex]')
      ? shell
      : shell.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );

  window.setTimeout(() => {
    focusable?.focus({ preventScroll: true });
  }, 180);

  clearTimer = window.setTimeout(() => {
    shell.classList.remove(FLASH_CLASS);
    fieldWrapper?.classList.remove(FLASH_FIELD_CLASS);
    clearTimer = undefined;
  }, HIGHLIGHT_MS);

  return true;
}

export function installGlobalToastErrorNavigation(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalError = toast.error.bind(toast);

  toast.error = ((message: Parameters<typeof toast.error>[0], data?: Parameters<typeof toast.error>[1]) => {
    const id = originalError(message, data);
    const text = messageToText(message);

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        navigateToErrorTarget(text);
      }, 40);
    });

    return id;
  }) as typeof toast.error;
}
