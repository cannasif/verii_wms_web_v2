import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  normalizeGoodsReceiptWaybillFields,
  resolveGoodsReceiptWaybillNo,
  resolveGoodsReceiptWaybillReference,
} from './goods-receipt-waybill';

describe('goods-receipt-waybill', () => {
  it('prefers electronicWaybillNo when both are filled', () => {
    assert.equal(
      resolveGoodsReceiptWaybillNo({
        waybillNo: 'IRS202600000001',
        electronicWaybillNo: 'GIB2026AB000000',
      }),
      'GIB2026AB000000',
    );
  });

  it('falls back to waybillNo when electronic is empty', () => {
    assert.equal(
      resolveGoodsReceiptWaybillNo({
        waybillNo: 'IRS202600000001',
        electronicWaybillNo: null,
      }),
      'IRS202600000001',
    );
  });

  it('reports the reference kind for dynamic user-facing labels', () => {
    assert.deepEqual(
      resolveGoodsReceiptWaybillReference({ electronicWaybillNo: 'GIB2026AB000000' }),
      { number: 'GIB2026AB000000', kind: 'electronic' },
    );
    assert.deepEqual(
      resolveGoodsReceiptWaybillReference({ waybillNo: 'IRS202600000001' }),
      { number: 'IRS202600000001', kind: 'regular' },
    );
  });

  it('falls back to electronicWaybillNo when waybill is empty', () => {
    assert.equal(
      resolveGoodsReceiptWaybillNo({
        waybillNo: null,
        electronicWaybillNo: 'GIB2026AB000000',
      }),
      'GIB2026AB000000',
    );
  });

  it('reads PascalCase API fields', () => {
    const normalized = normalizeGoodsReceiptWaybillFields({
      WaybillNo: null,
      ElectronicWaybillNo: 'GIB2026AB000000',
    });
    assert.equal(normalized.waybillNo, 'GIB2026AB000000');
    assert.equal(resolveGoodsReceiptWaybillNo(normalized), 'GIB2026AB000000');
  });

  it('scans unknown waybill-like keys', () => {
    assert.equal(
      resolveGoodsReceiptWaybillNo({
        gibWaybillNo: 'GIB2026ZZ000001',
      }),
      'GIB2026ZZ000001',
    );
  });
});
