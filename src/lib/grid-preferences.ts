export type GridSortDirection = 'asc' | 'desc';

export interface GridPreferenceColumn {
  key: string;
  sortable?: boolean;
  hideable?: boolean;
}

export interface GridPreferences {
  version: 1;
  visible: string[];
  order: string[];
  widths: Record<string, number>;
  sortBy: string | null;
  sortDirection: GridSortDirection;
  pageSize: number;
}

const GRID_PREFERENCE_VERSION = 1;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 800;

export function getGridPreferenceKey(pageKey: string, userId?: number): string {
  return `wms-grid:v${GRID_PREFERENCE_VERSION}:${userId ?? 'anonymous'}:${pageKey}`;
}

function createDefaults(columns: GridPreferenceColumn[]): GridPreferences {
  const keys = columns.map((column) => column.key);
  return {
    version: GRID_PREFERENCE_VERSION,
    visible: keys,
    order: keys,
    widths: {},
    sortBy: null,
    sortDirection: 'asc',
    pageSize: 25,
  };
}

function uniqueValidKeys(value: unknown, validKeys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (key, index): key is string =>
      typeof key === 'string' && validKeys.includes(key) && value.indexOf(key) === index,
  );
}

function normalizePreferences(value: unknown, columns: GridPreferenceColumn[]): GridPreferences {
  const defaults = createDefaults(columns);
  if (!value || typeof value !== 'object') return defaults;

  const parsed = value as Partial<GridPreferences>;
  const keys = defaults.order;
  const storedOrder = uniqueValidKeys(parsed.order, keys);
  const newKeys = keys.filter((key) => !storedOrder.includes(key));
  const order = [...storedOrder, ...newKeys];
  const storedVisible = uniqueValidKeys(parsed.visible, keys);
  // A user's explicit hidden-column choices are preserved, while columns added by
  // a later application version become visible instead of silently disappearing.
  const visible = storedVisible.length > 0
    ? order.filter((key) => storedVisible.includes(key) || newKeys.includes(key))
    : [...order];
  for (const key of columns.filter((column) => column.hideable === false).map((column) => column.key)) {
    if (!visible.includes(key)) visible.push(key);
  }
  const sortableKeys = columns.filter((column) => column.sortable !== false).map((column) => column.key);
  const sortBy = typeof parsed.sortBy === 'string' && sortableKeys.includes(parsed.sortBy) ? parsed.sortBy : null;
  const sortDirection = parsed.sortDirection === 'desc' ? 'desc' : 'asc';
  const pageSize = PAGE_SIZE_OPTIONS.includes(parsed.pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed.pageSize!
    : defaults.pageSize;
  const widths = Object.fromEntries(
    Object.entries(parsed.widths ?? {}).filter(
      ([key, width]) => keys.includes(key) && typeof width === 'number' && Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH,
    ),
  );

  return { version: GRID_PREFERENCE_VERSION, visible, order, widths, sortBy, sortDirection, pageSize };
}

function loadLegacyPreferences(pageKey: string, columns: GridPreferenceColumn[]): GridPreferences {
  const defaults = createDefaults(columns);
  try {
    const visible = JSON.parse(localStorage.getItem(`wms-grid:${pageKey}:visible`) || 'null');
    const sort = JSON.parse(localStorage.getItem(`wms-grid:${pageKey}:sort`) || 'null');
    return normalizePreferences(
      {
        ...defaults,
        visible: Array.isArray(visible) ? visible : defaults.visible,
        sortBy: typeof sort?.sortBy === 'string' ? sort.sortBy : null,
        sortDirection: sort?.sortDirection,
      },
      columns,
    );
  } catch {
    return defaults;
  }
}

export function loadGridPreferences(pageKey: string, userId: number | undefined, columns: GridPreferenceColumn[]): GridPreferences {
  try {
    const raw = localStorage.getItem(getGridPreferenceKey(pageKey, userId));
    return raw ? normalizePreferences(JSON.parse(raw), columns) : loadLegacyPreferences(pageKey, columns);
  } catch {
    return createDefaults(columns);
  }
}

export function saveGridPreferences(pageKey: string, userId: number | undefined, preferences: GridPreferences): void {
  try {
    localStorage.setItem(getGridPreferenceKey(pageKey, userId), JSON.stringify(preferences));
  } catch {
    // Private mode/quota failures must not break the grid.
  }
}

export function getDefaultGridPreferences(columns: GridPreferenceColumn[]): GridPreferences {
  return createDefaults(columns);
}
