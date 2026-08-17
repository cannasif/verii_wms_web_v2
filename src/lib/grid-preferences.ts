export type GridSortDirection = 'asc' | 'desc';

export interface GridPreferenceColumn {
  key: string;
  sortable?: boolean;
  hideable?: boolean;
  searchable?: boolean;
  defaultSearch?: boolean;
}

export interface GridPreferences {
  version: 2;
  visible: string[];
  order: string[];
  widths: Record<string, number>;
  searchFields: string[];
  sortBy: string | null;
  sortDirection: GridSortDirection;
  pageSize: number;
}

const GRID_PREFERENCE_VERSION = 2;
export const MAX_GRID_SEARCH_FIELDS = 12;
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 800;

/**
 * Resolves the server-side search scope independently from column visibility.
 * Hiding a column is a presentation preference and must not silently remove a
 * field that the user explicitly selected for searching.
 */
export function resolveGridSearchFields(
  selectedFields: readonly string[],
  searchableFields: readonly string[],
): string[] {
  const allowed = new Set(searchableFields);
  const selected = selectedFields
    .filter((field, index) => allowed.has(field) && selectedFields.indexOf(field) === index)
    .slice(0, MAX_GRID_SEARCH_FIELDS);

  return selected.length > 0
    ? selected
    : searchableFields.slice(0, 1);
}

export function getGridPreferenceKey(pageKey: string, userId?: number): string {
  return `wms-grid:v${GRID_PREFERENCE_VERSION}:${userId ?? 'anonymous'}:${pageKey}`;
}

function createDefaults(columns: GridPreferenceColumn[]): GridPreferences {
  const keys = columns.map((column) => column.key);
  const searchableFields = columns.filter((column) => column.searchable === true);
  const defaultSearchFields = searchableFields
    .filter((column) => column.searchable === true && column.defaultSearch !== false)
    .slice(0, MAX_GRID_SEARCH_FIELDS)
    .map((column) => column.key);
  const searchFields = defaultSearchFields.length > 0
    ? defaultSearchFields
    : searchableFields.slice(0, 1).map((column) => column.key);
  return {
    version: GRID_PREFERENCE_VERSION,
    visible: keys,
    order: keys,
    widths: {},
    searchFields,
    sortBy: null,
    sortDirection: 'asc',
    pageSize: 20,
  };
}

function uniqueValidKeys(value: unknown, validKeys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (key, index): key is string =>
      typeof key === 'string' && validKeys.includes(key) && value.indexOf(key) === index,
  );
}

function mergeColumnOrder(storedOrder: string[], canonicalOrder: string[]): string[] {
  const merged = [...storedOrder];
  canonicalOrder.forEach((key, canonicalIndex) => {
    if (merged.includes(key)) return;

    const nextExisting = canonicalOrder
      .slice(canonicalIndex + 1)
      .find((candidate) => merged.includes(candidate));
    if (nextExisting) {
      merged.splice(merged.indexOf(nextExisting), 0, key);
      return;
    }

    const previousExisting = canonicalOrder
      .slice(0, canonicalIndex)
      .reverse()
      .find((candidate) => merged.includes(candidate));
    if (previousExisting) {
      merged.splice(merged.indexOf(previousExisting) + 1, 0, key);
      return;
    }

    merged.push(key);
  });
  return merged;
}

function normalizePreferences(value: unknown, columns: GridPreferenceColumn[]): GridPreferences {
  const defaults = createDefaults(columns);
  if (!value || typeof value !== 'object') return defaults;

  const parsed = value as Partial<GridPreferences>;
  const keys = defaults.order;
  const storedOrder = uniqueValidKeys(parsed.order, keys);
  const newKeys = keys.filter((key) => !storedOrder.includes(key));
  const order = mergeColumnOrder(storedOrder, keys);
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
  const searchableKeys = columns.filter((column) => column.searchable === true).map((column) => column.key);
  const storedSearchFields = uniqueValidKeys(parsed.searchFields, searchableKeys);
  const mergedSearchFields = parsed.version === GRID_PREFERENCE_VERSION && storedSearchFields.length > 0
    ? uniqueValidKeys(
      [...storedSearchFields, ...defaults.searchFields.filter((key) => !storedSearchFields.includes(key))],
      searchableKeys,
    ).slice(0, MAX_GRID_SEARCH_FIELDS)
    : defaults.searchFields;
  const searchFields = mergedSearchFields.length > 0 ? mergedSearchFields : defaults.searchFields;
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

  return { version: GRID_PREFERENCE_VERSION, visible, order, widths, searchFields, sortBy, sortDirection, pageSize };
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
    if (raw) return normalizePreferences(JSON.parse(raw), columns);

    const versionOneKey = `wms-grid:v1:${userId ?? 'anonymous'}:${pageKey}`;
    const versionOne = localStorage.getItem(versionOneKey);
    return versionOne
      ? normalizePreferences(JSON.parse(versionOne), columns)
      : loadLegacyPreferences(pageKey, columns);
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
