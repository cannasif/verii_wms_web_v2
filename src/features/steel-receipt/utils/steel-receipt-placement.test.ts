import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  filterPlacementLinesBySearch,
  groupPlacementImportSources,
  isPlacementPendingLine,
  sortPlacementImportSources,
} from './steel-receipt-placement.helpers';
import type { SteelLineRow } from '../types/steel-receipt.types';

const baseLine = (overrides: Partial<SteelLineRow> = {}): SteelLineRow => ({
  id: 1,
  planId: 10,
  importReferenceNo: 'IMP-001',
  lineNo: 1,
  dCode: 'D001',
  stockCode: 'ST-01',
  supplierSerialNo: 'SER-01',
  expectedQuantity: 1,
  arrivedQuantity: 1,
  approvedQuantity: 1,
  rejectedQuantity: 0,
  unitCode: 'KG',
  arrivalStatus: 'Arrived',
  inspectionStatus: 'Approved',
  conversionStatus: 'Created',
  putawayStatus: 'Pending',
  goodsReceiptId: 100,
  targetWarehouseId: 5,
  receivingLocationId: 20,
  rowVersion: 'abc',
  ...overrides,
});

test('treats converted unreceived lines as not placement pending', () => {
  assert.equal(
    isPlacementPendingLine(baseLine({ conversionStatus: 'NotCreated', goodsReceiptId: undefined })),
    false,
  );
});

test('treats placed lines as not placement pending', () => {
  assert.equal(isPlacementPendingLine(baseLine({ putawayStatus: 'Placed' })), false);
});

test('treats direct receipt lines as placement pending', () => {
  assert.equal(isPlacementPendingLine(baseLine()), true);
});

test('filters lines by search text', () => {
  const lines = [
    baseLine({ id: 1, dCode: 'D001' }),
    baseLine({ id: 2, dCode: 'D002', supplierSerialNo: 'XYZ-99' }),
  ];
  assert.deepEqual(filterPlacementLinesBySearch(lines, 'xyz'), [lines[1]]);
});

test('groups placement imports by reference with pending counts', () => {
  const grouped = groupPlacementImportSources([
    baseLine({ id: 1, importReferenceNo: 'IMP-A' }),
    baseLine({ id: 2, importReferenceNo: 'IMP-A' }),
    baseLine({ id: 3, importReferenceNo: 'IMP-B' }),
  ]);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped, [
    { importReferenceNo: 'IMP-A', pendingLineCount: 2 },
    { importReferenceNo: 'IMP-B', pendingLineCount: 1 },
  ]);
});

test('sorts placement imports by importedAtUtc descending', () => {
  const sorted = sortPlacementImportSources([
    { importReferenceNo: 'OLD', pendingLineCount: 1, importedAtUtc: '2026-01-01T10:00:00Z' },
    { importReferenceNo: 'NEW', pendingLineCount: 2, importedAtUtc: '2026-03-01T10:00:00Z' },
  ]);
  assert.deepEqual(sorted.map((item) => item.importReferenceNo), ['NEW', 'OLD']);
});
