import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasSteelReceiptPlacementDraft,
  restoreSelectedLine,
} from './steel-receipt-placement-draft.helpers';
import type { SteelLineRow } from '../types/steel-receipt.types';

const line = (id: number): SteelLineRow => ({
  id,
  planId: 1,
  importReferenceNo: 'IMP-1',
  lineNo: id,
  dCode: `D${id}`,
  stockCode: 'ST',
  supplierSerialNo: 'SER',
  expectedQuantity: 1,
  arrivedQuantity: 1,
  approvedQuantity: 1,
  rejectedQuantity: 0,
  unitCode: 'KG',
  arrivalStatus: 'Arrived',
  inspectionStatus: 'Approved',
  conversionStatus: 'Created',
  putawayStatus: 'Pending',
  goodsReceiptId: 10,
  targetWarehouseId: 5,
  receivingLocationId: 20,
  rowVersion: 'v1',
});

test('placement draft is meaningful when sheet or shelf is selected', () => {
  assert.equal(
    hasSteelReceiptPlacementDraft({
      importReferenceNo: 'IMP-1',
      reference: 'IMP-1',
      selectedLineId: 42,
      locationId: null,
      search: '',
    }),
    true,
  );
  assert.equal(
    hasSteelReceiptPlacementDraft({
      importReferenceNo: 'IMP-1',
      reference: 'IMP-1',
      selectedLineId: null,
      locationId: '55',
      search: '',
    }),
    true,
  );
});

test('empty placement draft is not meaningful', () => {
  assert.equal(
    hasSteelReceiptPlacementDraft({
      importReferenceNo: '',
      reference: '',
      selectedLineId: null,
      locationId: null,
      search: '',
    }),
    false,
  );
});

test('restoreSelectedLine returns matching row only when still pending', () => {
  const lines = [line(1), line(2)];
  assert.equal(restoreSelectedLine(lines, 2)?.id, 2);
  assert.equal(restoreSelectedLine(lines, 99), null);
});
