import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { pageImportOpenFiles } from './import-goods-receipt.api';
import type { ImportOpenFile } from '../types/goods-receipt.types';

const files: ImportOpenFile[] = [
  {
    fileNumber: 'ITH-10',
    customerCode: '320.002',
    customerName: 'Çelik İthalat',
    deliveryCustomerCode: null,
    deliveryCustomerName: null,
  },
  {
    fileNumber: 'ITH-2-PEN-KOLU',
    customerCode: '320.001',
    customerName: 'Acme Dış Ticaret',
    deliveryCustomerCode: '120.001',
    deliveryCustomerName: 'İstanbul Teslim',
  },
];

describe('pageImportOpenFiles', () => {
  it('searches the full web query with Turkish character folding', () => {
    const page = pageImportOpenFiles(files, {
      pageNumber: 1,
      pageSize: 20,
      search: 'celik ithalat',
    });

    assert.deepEqual(page.items.map((file) => file.fileNumber), ['ITH-10']);
  });

  it('does not split a hyphenated query into independent terms', () => {
    const exactPhrase = pageImportOpenFiles(files, {
      pageNumber: 1,
      pageSize: 20,
      search: 'pen-kolu',
    });
    const rewrittenPhrase = pageImportOpenFiles(files, {
      pageNumber: 1,
      pageSize: 20,
      search: 'pen kolu',
    });

    assert.deepEqual(exactPhrase.items.map((file) => file.fileNumber), ['ITH-2-PEN-KOLU']);
    assert.equal(rewrittenPhrase.totalCount, 0);
  });

  it('sorts naturally and pages the ERP result deterministically', () => {
    const first = pageImportOpenFiles(files, {
      pageNumber: 1,
      pageSize: 1,
      search: '',
    });
    const second = pageImportOpenFiles(files, {
      pageNumber: 2,
      pageSize: 1,
      search: '',
    });

    assert.equal(first.items[0]?.fileNumber, 'ITH-2-PEN-KOLU');
    assert.equal(second.items[0]?.fileNumber, 'ITH-10');
    assert.equal(first.totalCount, 2);
    assert.equal(first.hasNextPage, true);
    assert.equal(second.hasNextPage, false);
  });
});
