import { describe, expect, it } from 'vitest';
import { MAX_GRID_SEARCH_FIELDS, resolveGridSearchFields } from './grid-preferences';

describe('resolveGridSearchFields', () => {
  it('keeps explicitly selected searchable fields even when column visibility changes', () => {
    expect(resolveGridSearchFields(['code', 'name'], ['id', 'code', 'name']))
      .toEqual(['code', 'name']);
  });

  it('drops invalid and duplicate fields without broadening the search scope', () => {
    expect(resolveGridSearchFields(['code', 'prefix', 'code'], ['id', 'code', 'name']))
      .toEqual(['code']);
  });

  it('falls back to one safe field and enforces the shared field limit', () => {
    expect(resolveGridSearchFields([], ['id', 'code'])).toEqual(['id']);

    const fields = Array.from({ length: MAX_GRID_SEARCH_FIELDS + 3 }, (_, index) => `field${index}`);
    expect(resolveGridSearchFields(fields, fields)).toEqual(fields.slice(0, MAX_GRID_SEARCH_FIELDS));
  });
});
