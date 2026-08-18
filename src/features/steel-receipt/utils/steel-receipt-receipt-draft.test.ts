import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  hasSteelReceiptReceiptDraft,
  isSteelReceiptTradeSelectionValid,
} from './steel-receipt-receipt-draft';

test('domestic receipt is valid without an import file', () => {
  assert.equal(isSteelReceiptTradeSelectionValid('Domestic', ''), true);
});

test('foreign receipt requires a selected import file', () => {
  assert.equal(isSteelReceiptTradeSelectionValid('Foreign', ''), false);
  assert.equal(isSteelReceiptTradeSelectionValid('Foreign', '  ITH-2026-001  '), true);
});

test('foreign trade selection keeps the operation draft meaningful', () => {
  assert.equal(
    hasSteelReceiptReceiptDraft({
      importReferenceNo: 'SAC-IMPORT-1',
      reference: '',
      selectedLineIds: [],
      note: '',
      isElectronic: true,
      receiptNo: '',
      documentDate: '2026-08-18',
      tradeType: 'Foreign',
      importFileNumber: 'ITH-2026-001',
    }),
    true,
  );
});
