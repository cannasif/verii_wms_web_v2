import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'vitest';
import type { GridRequest } from '@/components/shared/AdvancedDataGrid';
import { filterLocalGridPage, matchesGridSearch } from './local-grid-filter';
import { setUserDisplayNameDirectory } from './user-display-names';

const SEARCHABLE_KEYS = ['netsisOrderNo', 'supplierSerialNo', 'stockCode'];

const previewRows = [
  { id: 2, netsisOrderNo: 'SIP-866', supplierSerialNo: 'LVH-960', stockCode: '150-02-101-009-3954' },
  { id: 3, netsisOrderNo: 'SIP-100', supplierSerialNo: 'LVH-961', stockCode: '150-02-101-009-4015' },
];

afterEach(() => {
  setUserDisplayNameDirectory([]);
});

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

  it('matches ASCII input against mixed Turkish characters across selected fields', () => {
    const row = { id: 4, customerName: 'Çağrı ŞİMŞEK', description: 'ALIŞVERİŞ görüşmesi' };
    assert.equal(matchesGridSearch(row, 'cagri alisveris', ['customerName', 'description']), true);
    assert.equal(matchesGridSearch(row, 'cagri bulunmayan', ['customerName', 'description']), false);
    assert.equal(matchesGridSearch(row, 'alisveris', ['customerName']), false);
  });

  it('matches visible actor names, not only numeric user ids', () => {
    setUserDisplayNameDirectory([
      { id: 8, firstName: 'Mutahhar', lastName: 'Yılmaz', username: 'mutahhar' },
    ]);
    const row = { id: 1, createdBy: 8, documentNo: 'TR-001' };
    assert.equal(matchesGridSearch(row, 'mutahhar yilmaz', ['createdBy']), true);
    assert.equal(matchesGridSearch(row, 'ali', ['createdBy']), false);
    assert.equal(matchesGridSearch(row, '8', ['createdBy']), true);
  });

  it('matches resolved actor ids from the grid request', () => {
    const row = { id: 1, createdBy: 8, documentNo: 'TR-001' };
    assert.equal(matchesGridSearch(row, 'mutahhar', ['createdBy']), false);
    assert.equal(
      matchesGridSearch(row, 'mutahhar', ['createdBy'], { actorUserIds: [8] }),
      true,
    );
    assert.equal(
      matchesGridSearch({ id: 2, createdBy: null }, 'Sistem', ['createdBy'], { actorIncludeSystem: true }),
      true,
    );
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

  it('filters actor columns by resolved user ids', () => {
    const page = filterLocalGridPage(
      [
        { id: 1, createdBy: 8, documentNo: 'TR-001' },
        { id: 2, createdBy: 9, documentNo: 'TR-002' },
      ],
      {
        ...baseRequest,
        search: 'mutahhar',
        searchFields: ['createdBy'],
        actorUserIds: [8],
      },
      ['documentNo', 'createdBy'],
      { paginate: false },
    );
    assert.equal(page.totalCount, 1);
    assert.equal(page.items[0]?.id, 1);
  });
});
