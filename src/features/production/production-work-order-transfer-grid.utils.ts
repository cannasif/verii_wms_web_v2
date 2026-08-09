import type { GridFilter, GridPage, GridRequest } from '@/components/shared/AdvancedDataGrid';

const gridText = (value: unknown): string =>
  value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value);

const compareGridValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return gridText(a).localeCompare(gridText(b), 'tr', { numeric: true });
};

export const matchesGridSearch = (
  row: Record<string, unknown>,
  search: string,
  keys: string[],
): boolean => {
  const term = search.trim().toLocaleLowerCase('tr-TR');
  if (!term) return true;
  return keys.some((key) => gridText(row[key]).toLocaleLowerCase('tr-TR').includes(term));
};

const matchesGridFilter = (row: Record<string, unknown>, filter: GridFilter): boolean => {
  const raw = gridText(row[filter.column]).toLocaleLowerCase('tr-TR');
  const value = filter.value.trim().toLocaleLowerCase('tr-TR');
  switch (filter.operator) {
    case 'contains': return raw.includes(value);
    case 'notContains': return !raw.includes(value);
    case 'equals': return raw === value;
    case 'notEquals': return raw !== value;
    case 'startsWith': return raw.startsWith(value);
    case 'endsWith': return raw.endsWith(value);
    case 'isNull': return !raw;
    case 'isNotNull': return Boolean(raw);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const num = Number(raw);
      const cmp = Number(value);
      if (!Number.isFinite(num) || !Number.isFinite(cmp)) return false;
      if (filter.operator === 'gt') return num > cmp;
      if (filter.operator === 'gte') return num >= cmp;
      if (filter.operator === 'lt') return num < cmp;
      return num <= cmp;
    }
    default: return true;
  }
};

export function filterLocalGridPage<T extends { id: number }>(
  items: T[],
  request: GridRequest,
  searchableKeys: string[],
): GridPage<T> {
  let rows = [...items];
  const search = request.search?.trim();
  if (search) {
    const keys = request.searchFields?.length ? request.searchFields : searchableKeys;
    rows = rows.filter((row) => matchesGridSearch(row as Record<string, unknown>, search, keys));
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
