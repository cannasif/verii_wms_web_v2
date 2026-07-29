import { toast } from 'sonner';

const HIGHLIGHT_MS = 2600;
const FLASH_CLASS = 'wms-error-focus-flash';

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
    .replace(/[:·•|/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreKeyMatch(message: string, keys: string[]): number {
  const msg = normalize(message);
  let score = 0;
  for (const key of keys) {
    const normalizedKey = normalize(key);
    if (normalizedKey && msg.includes(normalizedKey)) {
      score = Math.max(score, normalizedKey.length + 30);
    }
  }
  return score;
}

function getErrorKeys(el: HTMLElement): string[] {
  return (
    el.getAttribute('data-wms-error-keys') ??
    el.getAttribute('data-wms-error-target') ??
    ''
  )
    .split('|')
    .map((key) => key.trim())
    .filter(Boolean);
}

function isContainerScope(el: HTMLElement): boolean {
  return el.getAttribute('data-wms-error-scope') === 'container';
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

  if (words.length >= 2 && hits.length === 1) {
    const onlyHit = hits[0];
    if (onlyHit === 'irsaliye' && (msg.includes('numara') || msg.includes('numarasi'))) {
      return 0;
    }
    if (onlyHit === 'miktar' && msg.includes('seri')) {
      return 0;
    }
    return hits.join('').length + hits.length * 2;
  }

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

function findBestExplicitTarget(
  message: string,
  root: ParentNode = document,
  options?: { containersOnly?: boolean; excludeContainers?: boolean },
): HTMLElement | null {
  const msg = normalize(message);
  const nodes = root.querySelectorAll<HTMLElement>('[data-wms-error-target]');
  let best: { el: HTMLElement; score: number } | null = null;

  for (const el of nodes) {
    if (!isVisible(el)) continue;
    const container = isContainerScope(el);
    if (options?.excludeContainers && container) continue;
    if (options?.containersOnly && !container) continue;

    const score = scoreKeyMatch(msg, getErrorKeys(el));
    if (score > 0 && (!best || score > best.score)) {
      best = { el, score };
    }
  }

  return best?.el ?? null;
}

function findByExplicitTarget(message: string): HTMLElement | null {
  const fieldTarget = findBestExplicitTarget(message, document, {
    excludeContainers: true,
  });
  if (fieldTarget) return fieldTarget;

  const containerTarget = findBestExplicitTarget(message, document, {
    containersOnly: true,
  });
  if (!containerTarget) return null;

  const innerTarget = findBestExplicitTarget(message, containerTarget, {
    excludeContainers: true,
  });
  return innerTarget ?? containerTarget;
}

function findByInvalidState(root: ParentNode = document): HTMLElement | null {
  const selectors = [
    '[aria-invalid="true"]',
    '[data-invalid="true"]',
    '.wms-ops-field-shell--error',
    '.auth-field-invalid',
    '.wms-ops-field-shell[aria-invalid="true"]',
  ];

  for (const selector of selectors) {
    const nodes = root.querySelectorAll<HTMLElement>(selector);
    for (const el of nodes) {
      if (isVisible(el)) return el;
    }
  }
  return null;
}

function parseLineErrorPrefix(message: string): string | null {
  const match = message.match(/^([^:\n]{3,120}):\s*/);
  return match ? match[1].trim() : null;
}

function getSelectedLinesScope(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '#goods-receipt-selected-lines, .wms-ops-receipt-selected-lines',
  );
}

function findReceiptEntryRow(message: string): HTMLElement | null {
  const prefix = parseLineErrorPrefix(message);
  if (!prefix) return null;

  const scope = getSelectedLinesScope();
  if (!scope) return null;

  const normalizedPrefix = normalize(prefix);

  for (const row of scope.querySelectorAll<HTMLElement>('[data-wms-error-line-ref]')) {
    if (!isVisible(row)) continue;
    const ref = row.getAttribute('data-wms-error-line-ref') ?? '';
    if (normalize(ref) === normalizedPrefix) return row;
  }

  const parts = prefix.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  for (const row of scope.querySelectorAll<HTMLElement>('.wms-ops-receipt-entry-row')) {
    if (!isVisible(row)) continue;
    const text = row.textContent ?? '';
    if (parts.every((part) => text.includes(part))) return row;
  }

  return null;
}

function findLineRow(message: string): HTMLElement | null {
  return findReceiptEntryRow(message);
}

function resolveFieldInRowByMessage(
  message: string,
  row: HTMLElement,
): HTMLElement | null {
  const fieldTarget = findBestExplicitTarget(message, row, {
    excludeContainers: true,
  });
  if (fieldTarget) return fieldTarget;

  const msg = normalize(message);
  const serialKeywords = [
    'lot/seri plani',
    'lot/seri toplami',
    'seri satiri',
    'benzersiz seri',
    'ayni seri',
    'miktar kadar benzersiz seri',
    'takipsiz kalemde lot',
    'lot zorunludur',
    'uretim tarihi',
    'son kullanma',
    'seri numarasi',
    'lot/serial plan',
    'serial row',
    'duplicate serial',
  ];
  const quantityKeywords = [
    'miktar kullanilabilir',
    'miktar araliginda',
    'quantity range',
    'available quantity',
  ];
  const locationKeywords = ['hedef depo', 'kabul rafi', 'target warehouse', 'receiving shelf'];

  const pickLabel = (labelText: string): HTMLElement | null => {
    const label = [...row.querySelectorAll<HTMLElement>('.wms-ops-entry-label, label > span.font-semibold, label span')]
      .find((node) => normalize(node.textContent ?? '') === normalize(labelText));
    if (!label || !isVisible(label)) return null;
    const shell =
      label
        .closest<HTMLElement>('.space-y-1, .space-y-1\\.5, .space-y-2, label')
        ?.querySelector<HTMLElement>(
          'input, textarea, select, button.wms-ops-lookup-trigger, [role="combobox"], .wms-ops-field-shell, .app-input-shell',
        ) ?? null;
    return shell && isVisible(shell) ? shell : null;
  };

  if (serialKeywords.some((key) => msg.includes(key))) {
    return (
      row.querySelector<HTMLElement>('[data-wms-error-target="serial"]') ??
      pickLabel('Seri No')
    );
  }
  if (quantityKeywords.some((key) => msg.includes(key))) {
    return (
      row.querySelector<HTMLElement>('[data-wms-error-target="quantity"]') ??
      pickLabel('Miktar')
    );
  }
  if (locationKeywords.some((key) => msg.includes(key))) {
    return (
      row.querySelector<HTMLElement>('[data-wms-error-target="location"]') ??
      pickLabel('Raf Kodu')
    );
  }

  return null;
}

function findByLinePrefix(message: string): HTMLElement | null {
  const row = findLineRow(message);
  if (!row) return null;

  const field = resolveFieldInRowByMessage(message, row);
  if (field) return field;

  const invalid = findByInvalidState(row);
  if (invalid) return invalid;

  return row;
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
  const lineResult = findByLinePrefix(message);
  if (lineResult) return lineResult;

  const linePrefix = parseLineErrorPrefix(message);
  if (linePrefix) {
    const scope = getSelectedLinesScope();
    if (scope) {
      const scopedField = findBestExplicitTarget(message, scope, {
        excludeContainers: true,
      });
      if (scopedField) return scopedField;
    }
  }

  return (
    findByExplicitTarget(message) ??
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
    .querySelectorAll(`.${FLASH_CLASS}`)
    .forEach((node) => node.classList.remove(FLASH_CLASS));

  const shell = resolveControlSurface(target);
  shell.classList.add(FLASH_CLASS);
  shell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

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
