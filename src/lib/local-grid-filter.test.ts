import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { GridRequest } from '@/components/shared/AdvancedDataGrid';
import { filterLocalGridPage, matchesGridSearch } from './local-grid-filter';

const SEARCHABLE_KEYS = ['netsisOrderNo', 'supplierSerialNo', 'stockCode'];

const previewRows = [
  { id: 2, netsisOrderNo: 'SIP-866', supplierSerialNo: 'LVH-960', stockCode: '150-02-101-009-3954' },
  { id: 3, netsisOrderNo: 'SIP-100', supplierSerialNo: 'LVH-961', stockCode: '150-02-101-009-4015' },
];

describe('matchesGridSearch', () => {
  it('matches each token across different columns (AND)', () => {
    const row = previewRows[0];
    assert.equal(
      matchesGridSearch(row, '866 960', SEARCHABLE_KEYS),
      true,
    );
    assert.equal(
      matchesGridSearch(row, '866 961', SEARCHABLE_KEYS),
      false,
    );
  });

  it('treats a single term as before', () => {
    assert.equal(matchesGridSearch(previewRows[0], '866', SEARCHABLE_KEYS), true);
    assert.equal(matchesGridSearch(previewRows[0], '960', SEARCHABLE_KEYS), true);
  });
});

describe('filterLocalGridPage', () => {
  const baseRequest: GridRequest = {
    pageNumber: 1,
    pageSize: 20,
    search: null,
    filterLogic: 'and',
    filters: [],
  };

  it('filters preview rows with multi-token search when unpaged', () => {
    const page = filterLocalGridPage(
      previewRows,
      { ...baseRequest, search: '866 960' },
      SEARCHABLE_KEYS,
      { paginate: false },
    );
    assert.equal(page.totalCount, 1);
    assert.equal(page.items[0]?.supplierSerialNo, 'LVH-960');
  });

  it('paginates filtered rows when paginate is true', () => {
    const page = filterLocalGridPage(
      previewRows,
      { ...baseRequest, search: '150-02', pageSize: 1, pageNumber: 2 },
      SEARCHABLE_KEYS,
      { paginate: true },
    );
    assert.equal(page.totalCount, 2);
    assert.equal(page.items.length, 1);
    assert.equal(page.pageNumber, 2);
  });
});
