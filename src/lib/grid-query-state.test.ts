import { describe, expect, it } from 'vitest';
import type { GridRequest } from '@/components/shared/AdvancedDataGrid';
import { canRetainGridPlaceholder, getGridResultScopeKey } from './grid-query-state';

const request = (overrides: Partial<GridRequest> = {}): GridRequest => ({
  pageNumber: 1,
  pageSize: 20,
  search: 'ABC',
  searchFields: ['code', 'name'],
  sortBy: 'code',
  sortDirection: 'asc',
  filterLogic: 'and',
  filters: [],
  ...overrides,
});

describe('grid query result scope', () => {
  it('retains rows only while paging in the same result set', () => {
    expect(canRetainGridPlaceholder(request(), request({ pageNumber: 2 }))).toBe(true);
  });

  it.each([
    [{ search: 'XYZ' }],
    [{ searchFields: ['code'] }],
    [{ sortDirection: 'desc' as const }],
    [{ pageSize: 50 }],
    [{ filters: [{ column: 'isActive', operator: 'equals', value: 'true' }] }],
  ])('does not retain unrelated rows when query scope changes', (override) => {
    expect(canRetainGridPlaceholder(request(), request(override))).toBe(false);
  });

  it('normalizes search-field order for an equivalent scope', () => {
    expect(getGridResultScopeKey(request({ searchFields: ['name', 'code'] })))
      .toBe(getGridResultScopeKey(request()));
  });
});
