import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  areAllPlacementSheetsSelected,
  hasSteelReceiptPlacementDraft,
  keepPendingPlacementSelection,
  restoreSelectedLine,
  restoreSelectedLines,
  toggleAllPlacementSheetSelection,
  togglePlacementSheetSelection,
} from './steel-receipt-placement-draft.helpers';
import type { SteelLineRow } from '../types/steel-receipt.types';

const line = (id: number, warehouse = 5): SteelLineRow => ({
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
  targetWarehouseId: warehouse,
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

test('restoreSelectedLines falls back to a single selectedLineId from older drafts', () => {
  const lines = [line(1), line(2), line(3)];
  assert.deepEqual(
    restoreSelectedLines(lines, undefined, 2).map((row) => row.id),
    [2],
  );
});

test('checkbox selection keeps click order and restores still-pending sheets', () => {
  const lines = [line(1), line(2), line(3), line(4), line(5), line(6)];
  const selected = [2, 4, 5].reduce(
    (current, id) => togglePlacementSheetSelection(current, line(id)),
    [] as ReturnType<typeof line>[],
  );
  assert.deepEqual(selected.map((row) => row.id), [2, 4, 5]);
  assert.deepEqual(
    restoreSelectedLines(lines, [2, 4, 5]).map((row) => row.id),
    [2, 4, 5],
  );
  assert.deepEqual(
    keepPendingPlacementSelection(selected, [line(4), line(5), line(6)]).map((row) => row.id),
    [4, 5],
  );
});

test('select all uses visible list order and keeps already selected sheets first', () => {
  const visible = [line(1), line(2), line(3)];
  const selected = togglePlacementSheetSelection([], line(3));
  const result = toggleAllPlacementSheetSelection(
    selected,
    visible,
    (row) => row.targetWarehouseId ?? 0,
  );
  assert.deepEqual(result.selected.map((row) => row.id), [3, 1, 2]);
  assert.equal(result.skippedWarehouseMismatch, false);
  assert.equal(areAllPlacementSheetsSelected(result.selected, visible), true);
});

test('select all unchecks visible sheets and skips other warehouses', () => {
  const compatible = [line(1, 5), line(2, 5)];
  const mixed = [...compatible, line(3, 9)];
  const selected = toggleAllPlacementSheetSelection(
    [],
    mixed,
    (row) => row.targetWarehouseId ?? 0,
  );
  assert.deepEqual(selected.selected.map((row) => row.id), [1, 2]);
  assert.equal(selected.skippedWarehouseMismatch, true);
  assert.equal(areAllPlacementSheetsSelected(selected.selected, compatible), true);

  const unchecked = toggleAllPlacementSheetSelection(
    selected.selected,
    mixed,
    (row) => row.targetWarehouseId ?? 0,
  );
  assert.deepEqual(unchecked.selected.map((row) => row.id), []);
  assert.equal(unchecked.skippedWarehouseMismatch, false);

  const cleared = toggleAllPlacementSheetSelection(
    [...selected.selected, line(4, 5)],
    compatible,
    (row) => row.targetWarehouseId ?? 0,
  );
  assert.deepEqual(cleared.selected.map((row) => row.id), [4]);
});
