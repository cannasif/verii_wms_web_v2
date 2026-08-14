import { describe, expect, it } from 'vitest';
import { buildDropdownPagedBody } from './dropdown-paging';

describe('buildDropdownPagedBody', () => {
  it('sends only the explicitly selected search fields', () => {
    const body = buildDropdownPagedBody({
      pageNumber: 1,
      pageSize: 20,
      search: 'mal kabul',
      searchFields: ['code'],
      sortBy: 'code',
    });

    expect(body.searchFields).toEqual(['code']);
  });

  it('uses the safe lookup allow-list and omits it when there is no search term', () => {
    const searching = buildDropdownPagedBody({
      pageNumber: 1,
      pageSize: 20,
      search: 'STK',
      sortBy: 'erpStockCode',
    });
    const idle = buildDropdownPagedBody({
      pageNumber: 1,
      pageSize: 20,
      search: '',
      sortBy: 'erpStockCode',
    });

    expect(searching.searchFields).toEqual(['erpStockCode', 'stockName']);
    expect(idle.searchFields).toBeUndefined();
  });

  it('limits supplier lookup search to customer code and name', () => {
    const body = buildDropdownPagedBody({
      pageNumber: 1,
      pageSize: 20,
      search: 'sabit',
      sortBy: 'customerCode',
    });

    expect(body.search).toBe('sabit');
    expect(body.searchFields).toEqual(['customerCode', 'customerName']);
  });
});
