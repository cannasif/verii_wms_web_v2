export const NAVBAR_CENTER_MODES = ['search', 'kpi'] as const;
export type NavbarCenterMode = (typeof NAVBAR_CENTER_MODES)[number];

export const NAVBAR_KPI_KEYS = [
  'myTasks',
  'qualityQueue',
  'pendingApproval',
  'erpIssues',
  'openOperations',
  'goodsReceiptToday',
  'shipmentToday',
  'transferToday',
] as const;
export type NavbarKpiKey = (typeof NAVBAR_KPI_KEYS)[number];

export const DEFAULT_NAVBAR_CENTER_MODE: NavbarCenterMode = 'search';
export const DEFAULT_NAVBAR_KPI_KEYS: readonly NavbarKpiKey[] = [
  'myTasks',
  'qualityQueue',
  'pendingApproval',
  'erpIssues',
];
export const MAX_NAVBAR_KPI_COUNT = 4;

const kpiKeySet = new Set<string>(NAVBAR_KPI_KEYS);

export function isNavbarCenterMode(value: unknown): value is NavbarCenterMode {
  return value === 'search' || value === 'kpi';
}

export function isNavbarKpiKey(value: unknown): value is NavbarKpiKey {
  return typeof value === 'string' && kpiKeySet.has(value);
}

export function coerceNavbarCenterMode(value: unknown): NavbarCenterMode {
  return isNavbarCenterMode(value) ? value : DEFAULT_NAVBAR_CENTER_MODE;
}

export function coerceNavbarKpiKeys(value: unknown): NavbarKpiKey[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_NAVBAR_KPI_KEYS];
  }

  const keys: NavbarKpiKey[] = [];
  for (const item of value) {
    if (!isNavbarKpiKey(item) || keys.includes(item)) continue;
    keys.push(item);
    if (keys.length === MAX_NAVBAR_KPI_COUNT) break;
  }

  return keys.length > 0 ? keys : [...DEFAULT_NAVBAR_KPI_KEYS];
}
