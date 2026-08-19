import type { GridFilter, GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';
import i18n from '@/lib/i18n';
import { foldTurkishSearch } from '@/lib/turkish-search';
import { getUserDisplayName } from '@/lib/user-display-names';

const ACTOR_SEARCH_KEYS = new Set(['createdBy', 'updatedBy']);

export const gridText = (value: unknown): string =>
  value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value);

export type GridSearchActorOptions = {
  actorUserIds?: number[];
  actorIncludeSystem?: boolean;
};

export function splitLocalGridSearchTerms(search: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of search.split(/\s+/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const folded = foldTurkishSearch(trimmed);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    terms.push(trimmed);
  }
  return terms;
}

function parseActorUserId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(id) ? id : null;
}

function actorFieldSearchText(row: Record<string, unknown>, key: string): string {
  const rowName = gridText(row[`${key}Name`]);
  const id = parseActorUserId(row[key]);
  if (id == null) {
    return [rowName, i18n.t('dataGrid.systemActor'), 'Sistem', 'System'].filter(Boolean).join(' ');
  }
  return [
    rowName,
    getUserDisplayName(id) ?? '',
    String(id),
    i18n.t('dataGrid.userNumber', { number: id }),
  ].filter(Boolean).join(' ');
}

function fieldSearchText(row: Record<string, unknown>, key: string): string {
  return ACTOR_SEARCH_KEYS.has(key) ? actorFieldSearchText(row, key) : gridText(row[key]);
}

function rowMatchesResolvedActors(
  row: Record<string, unknown>,
  keys: string[],
  actor?: GridSearchActorOptions,
): boolean {
  const ids = actor?.actorUserIds ?? [];
  const includeSystem = Boolean(actor?.actorIncludeSystem);
  if (ids.length === 0 && !includeSystem) return false;
  if (!keys.some((key) => ACTOR_SEARCH_KEYS.has(key))) return false;
  for (const key of keys) {
    if (!ACTOR_SEARCH_KEYS.has(key)) continue;
    const id = parseActorUserId(row[key]);
    if (id == null) {
      if (includeSystem) return true;
      continue;
    }
    if (ids.includes(id)) return true;
  }
  return false;
}

function buildSearchHaystack(row: Record<string, unknown>, keys: string[]): string {
  return foldTurkishSearch(
    keys
      .map((key) => fieldSearchText(row, key))
      .filter((value) => value.length > 0)
      .join(' '),
  );
}

/** Her terim seçili alanlardan en az birinde geçmeli (AND); API ApplySearch ile uyumlu. */
export const matchesGridSearch = (
  row: Record<string, unknown>,
  search: string,
  keys: string[],
  actor?: GridSearchActorOptions,
): boolean => {
  const terms = splitLocalGridSearchTerms(search);
  if (terms.length === 0 || keys.length === 0) return true;
  if (rowMatchesResolvedActors(row, keys, actor)) return true;
  const haystack = buildSearchHaystack(row, keys);
  return terms.every((term) => haystack.includes(foldTurkishSearch(term)));
};

const compareGridValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return gridText(a).localeCompare(gridText(b), 'tr', { numeric: true });
};

const matchesGridFilter = (row: Record<string, unknown>, filter: GridFilter): boolean => {
  const rawFolded = foldTurkishSearch(gridText(row[filter.column]));
  const valueFolded = foldTurkishSearch(filter.value);
  const rawLower = gridText(row[filter.column]).toLocaleLowerCase('tr-TR');
  const valueLower = filter.value.trim().toLocaleLowerCase('tr-TR');
  switch (filter.operator) {
    case 'contains': return rawFolded.includes(valueFolded);
    case 'notContains': return !rawFolded.includes(valueFolded);
    case 'equals': return rawFolded === valueFolded;
    case 'notEquals': return rawFolded !== valueFolded;
    case 'startsWith': return rawFolded.startsWith(valueFolded);
    case 'endsWith': return rawFolded.endsWith(valueFolded);
    case 'isNull': return !rawLower;
    case 'isNotNull': return Boolean(rawLower);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const num = Number(rawLower);
      const cmp = Number(valueLower);
      if (!Number.isFinite(num) || !Number.isFinite(cmp)) return false;
      if (filter.operator === 'gt') return num > cmp;
      if (filter.operator === 'gte') return num >= cmp;
      if (filter.operator === 'lt') return num < cmp;
      return num <= cmp;
    }
    default: return true;
  }
};

export interface FilterLocalGridOptions {
  /** false: tüm eşleşen satırları tek sayfada döner (önizleme grid'leri). Varsayılan true. */
  paginate?: boolean;
}

export function filterLocalGridPage<T extends { id: number }>(
  items: T[],
  request: GridRequest,
  searchableKeys: string[],
  options: FilterLocalGridOptions = {},
): GridPage<T> {
  const paginate = options.paginate ?? true;
  let rows = [...items];
  const search = request.search?.trim();
  if (search) {
    const keys = request.searchFields?.length ? request.searchFields : searchableKeys;
    rows = rows.filter((row) => matchesGridSearch(row as Record<string, unknown>, search, keys, {
      actorUserIds: request.actorUserIds,
      actorIncludeSystem: request.actorIncludeSystem,
    }));
  }
  if (request.filters.length) {
    rows = rows.filter((row) => (request.filterLogic === 'or'
      ? request.filters.some((filter) => matchesGridFilter(row as Record<string, unknown>, filter))
      : request.filters.every((filter) => matchesGridFilter(row as Record<string, unknown>, filter))));
  }
  if (request.sortBy) {
    const dir = request.sortDirection === 'desc' ? -1 : 1;
    rows.sort((a, b) =>
      compareGridValues(
        (a as Record<string, unknown>)[request.sortBy!],
        (b as Record<string, unknown>)[request.sortBy!],
      ) * dir);
  }

  const totalCount = rows.length;
  if (!paginate) {
    return {
      items: rows,
      pageNumber: 1,
      pageSize: Math.max(totalCount, 1),
      totalCount,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };
  }

  const pageSize = Math.max(request.pageSize ?? 25, 1);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageNumber = Math.min(Math.max(request.pageNumber ?? 1, 1), totalPages);
  const start = (pageNumber - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: pageNumber > 1,
    hasNextPage: pageNumber < totalPages,
  };
}
