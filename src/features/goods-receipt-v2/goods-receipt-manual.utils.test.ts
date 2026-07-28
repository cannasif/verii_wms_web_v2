import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildManualLineTrackings,
  buildOrderlessLinePayload,
  validateManualLineTracking,
} from './goods-receipt-manual.utils';
import type { ManualReceiptLine } from './types/goods-receipt.types';

const serialLine = (overrides: Partial<ManualReceiptLine> = {}): ManualReceiptLine => ({
  localId: 'line-1',
  stockId: 1,
  stockCode: '01/001',
  quantity: 1,
  unitCode: 'AD',
  targetWarehouseId: 1,
  receivingLocationId: 26,
  trackingType: 'Serial',
  serialNo: 'SN-TEST-001',
  ...overrides,
});

describe('buildManualLineTrackings', () => {
  it('returns empty array for None tracking', () => {
    assert.deepEqual(
      buildManualLineTrackings({ trackingType: 'None', quantity: 5 }),
      [],
    );
  });

  it('maps serial line to one tracking row', () => {
    assert.deepEqual(
      buildManualLineTrackings({
        trackingType: 'Serial',
        quantity: 1,
        serialNo: ' SN-123 ',
      }),
      [{
        quantity: 1,
        lotNo: null,
        serialNo: 'SN-123',
        manufacturingDate: null,
        expirationDate: null,
        description: null,
      }],
    );
  });
});

describe('validateManualLineTracking', () => {
  it('rejects serial stock without serial number', () => {
    assert.equal(
      validateManualLineTracking({
        stockCode: '01/001',
        trackingType: 'Serial',
        quantity: 1,
      }),
      '01/001: seri numarası zorunludur.',
    );
  });

  it('accepts serial stock with serial and quantity 1', () => {
    assert.equal(
      validateManualLineTracking({
        stockCode: '01/001',
        trackingType: 'Serial',
        quantity: 1,
        serialNo: 'SN-123',
      }),
      null,
    );
  });

  it('rejects serial stock when quantity is greater than 1', () => {
    assert.equal(
      validateManualLineTracking({
        stockCode: '01/001',
        trackingType: 'Serial',
        quantity: 2,
        serialNo: 'SN-123',
      }),
      '01/001: seri takipli satırın miktarı 1 olmalıdır.',
    );
  });

  it('rejects lot stock without lot number', () => {
    assert.equal(
      validateManualLineTracking({
        stockCode: '02/001',
        trackingType: 'Lot',
        quantity: 10,
      }),
      '02/001: lot numarası zorunludur.',
    );
  });
});

describe('buildOrderlessLinePayload', () => {
  it('includes trackingType and trackings for serial lines', () => {
    const payload = buildOrderlessLinePayload(serialLine());

    assert.equal(payload.trackingType, 'Serial');
    assert.equal(payload.serialNo, 'SN-TEST-001');
    assert.deepEqual(payload.trackings, [{
      quantity: 1,
      lotNo: null,
      serialNo: 'SN-TEST-001',
      manufacturingDate: null,
      expirationDate: null,
      description: null,
    }]);
  });

  it('matches the shape that previously caused backend 400', () => {
    const payload = buildOrderlessLinePayload(serialLine({ serialNo: undefined }));

    assert.equal(payload.trackingType, 'Serial');
    assert.equal(payload.serialNo, null);
    assert.deepEqual(payload.trackings, [{
      quantity: 1,
      lotNo: null,
      serialNo: null,
      manufacturingDate: null,
      expirationDate: null,
      description: null,
    }]);
  });

  it('preserves purchase order source references for direct receipt', () => {
    const payload = buildOrderlessLinePayload(serialLine({
      sourceOrderNumber: 'SAS202600000001',
      sourceOrderId: 42,
    }));

    assert.equal(payload.sourceOrderNumber, 'SAS202600000001');
    assert.equal(payload.sourceOrderId, 42);
  });
});
