export const QUICK_SEARCH_SCOPES = [
  'stock',
  'warehouse',
  'location',
  'serial',
  'lot',
  'document',
  'shipment',
] as const;

export type QuickSearchScope = (typeof QUICK_SEARCH_SCOPES)[number];

export const DEFAULT_QUICK_SEARCH_SCOPES: readonly QuickSearchScope[] = QUICK_SEARCH_SCOPES;

const SCOPE_SET = new Set<string>(QUICK_SEARCH_SCOPES);
const STORAGE_KEY = 'wms.ops-search.scopes';

export const QUICK_SEARCH_SCOPE_CHIPS: ReadonlyArray<{
  id: QuickSearchScope;
  labelKey: string;
  hintKey: string;
}> = [
  { id: 'stock', labelKey: 'navbar.search_kinds.stock', hintKey: 'navbar.search_scope_hints.stock' },
  { id: 'warehouse', labelKey: 'navbar.search_kinds.warehouse', hintKey: 'navbar.search_scope_hints.warehouse' },
  { id: 'location', labelKey: 'navbar.search_kinds.location', hintKey: 'navbar.search_scope_hints.location' },
  { id: 'serial', labelKey: 'navbar.search_kinds.serial', hintKey: 'navbar.search_scope_hints.serial' },
  { id: 'lot', labelKey: 'navbar.search_kinds.lot', hintKey: 'navbar.search_scope_hints.lot' },
  { id: 'document', labelKey: 'navbar.search_chip_document', hintKey: 'navbar.search_scope_hints.document' },
  { id: 'shipment', labelKey: 'navbar.search_chip_ops', hintKey: 'navbar.search_scope_hints.shipment' },
];

export function isQuickSearchScope(value: unknown): value is QuickSearchScope {
  return typeof value === 'string' && SCOPE_SET.has(value);
}

export function readQuickSearchScopes(): QuickSearchScope[] {
  if (typeof window === 'undefined') return [...DEFAULT_QUICK_SEARCH_SCOPES];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_QUICK_SEARCH_SCOPES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_QUICK_SEARCH_SCOPES];
    const scopes = parsed.filter(isQuickSearchScope);
    return scopes.length > 0 ? [...new Set(scopes)] : [...DEFAULT_QUICK_SEARCH_SCOPES];
  } catch {
    return [...DEFAULT_QUICK_SEARCH_SCOPES];
  }
}

export function writeQuickSearchScopes(scopes: readonly QuickSearchScope[]): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scopes));
}

export function toggleQuickSearchScope(
  scopes: readonly QuickSearchScope[],
  target: QuickSearchScope,
): QuickSearchScope[] {
  const next = scopes.includes(target)
    ? scopes.filter((scope) => scope !== target)
    : [...scopes, target];
  return next.length > 0 ? next : [...scopes];
}

export function quickSearchMinLength(scopes: readonly QuickSearchScope[]): number {
  return scopes.includes('warehouse') ? 1 : 2;
}

export function serializeQuickSearchScopes(scopes: readonly QuickSearchScope[]): string | undefined {
  if (scopes.length === 0 || scopes.length === QUICK_SEARCH_SCOPES.length) return undefined;
  return scopes.join(',');
}
