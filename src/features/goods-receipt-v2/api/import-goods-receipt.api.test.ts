import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { importGoodsReceiptApi } from './import-goods-receipt.api';

describe('importGoodsReceiptApi.createDirect', () => {
  it('does not persist and returns a visual-only completed result', async () => {
    const result = await importGoodsReceiptApi.createDirect({
      electronicWaybillNo: 'ITH202600000001',
      requireQualityControl: false,
      lines: [{ quantity: 4 }, { quantity: 6 }],
    });

    assert.equal(result.id, 0);
    assert.equal(result.documentNo, 'ITH202600000001');
    assert.equal(result.initiationMode, 'Direct');
    assert.equal(result.status, 'Completed');
    assert.equal(result.lineCount, 2);
    assert.equal(result.quantity, 10);
    assert.equal(result.replayed, false);
    assert.equal(result.qualityInspectionId, undefined);
  });

  it('marks quality routing when requireQualityControl is true', async () => {
    const result = await importGoodsReceiptApi.createDirect({
      waybillNo: 'WAYBILL-1',
      requireQualityControl: true,
      lines: [{ quantity: 1 }],
    });

    assert.equal(result.status, 'AwaitingQuality');
    assert.equal(result.qualityInspectionId, 0);
    assert.equal(result.documentNo, 'WAYBILL-1');
  });

  it('falls back to a pending document no when waybill fields are empty', async () => {
    const result = await importGoodsReceiptApi.createDirect({});
    assert.equal(result.documentNo, 'ITH-PENDING');
    assert.equal(result.lineCount, 0);
    assert.equal(result.quantity, 0);
  });
});
