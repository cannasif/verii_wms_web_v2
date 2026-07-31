import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { OpenOrderLine } from '../types/goods-receipt.types';
import {
  appendDirectLineSearchToken,
  filterVisibleDirectOrderLines,
  matchesDirectOrderLineSearch,
} from './direct-order-line-filters';

const line = (overrides: Partial<OpenOrderLine> = {}): OpenOrderLine => ({
  siparisNo: 'SAS202600000011',
  orderId: 1,
  stockCode: '01/009',
  stockName: 'LOGITECH MX Master 3S Kablosuz Mouse',
  projectCode: 'GENEL',
  targetWarehouseCode: 1,
  orderedQuantity: 10,
  availableQuantity: 10,
  remainingQuantity: 10,
  ...overrides,
});

describe('appendDirectLineSearchToken', () => {
  it('trims and skips duplicates case-insensitively', () => {
    assert.deepEqual(appendDirectLineSearchToken([], '  GENEL '), ['GENEL']);
    assert.deepEqual(
      appendDirectLineSearchToken(['GENEL'], 'genel'),
      ['GENEL'],
    );
  });
});

describe('matchesDirectOrderLineSearch', () => {
  it('ANDs tokens across all columns', () => {
    assert.equal(
      matchesDirectOrderLineSearch(line(), ['GENEL', 'LOGITECH'], 'Merkez'),
      true,
    );
    assert.equal(
      matchesDirectOrderLineSearch(line(), ['GENEL', 'ASUS'], 'Merkez'),
      false,
    );
  });

  it('matches warehouse name and order quantity text', () => {
    assert.equal(
      matchesDirectOrderLineSearch(line(), ['merkez'], 'Merkez Depo'),
      true,
    );
    assert.equal(
      matchesDirectOrderLineSearch(line(), ['SAS202600000011']),
      true,
    );
  });

  it('matches Turkish diacritics and case in stock names', () => {
    const workShoe = line({
      stockName: 'İŞ AYAKKABISI',
      stockCode: '150-02-101-009-1689',
    });
    assert.equal(matchesDirectOrderLineSearch(workShoe, ['is']), true);
    assert.equal(matchesDirectOrderLineSearch(workShoe, ['IS']), true);
    assert.equal(matchesDirectOrderLineSearch(workShoe, ['iş']), true);
    assert.equal(matchesDirectOrderLineSearch(workShoe, ['ayakkabi']), true);
  });
});

describe('filterVisibleDirectOrderLines', () => {
  const rows = [
    line(),
    line({
      orderId: 2,
      stockName: 'ASUS Anakart',
      projectCode: 'OZEL',
      targetWarehouseCode: 2,
    }),
  ];

  it('applies project, warehouse and search together', () => {
    const filtered = filterVisibleDirectOrderLines(rows, {
      projectCodeFilter: 'GENEL',
      warehouseCodeFilter: '1',
      searchTokens: ['LOGITECH'],
      warehouseNameByCode: new Map([[1, 'Merkez']]),
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].orderId, 1);
  });
});
