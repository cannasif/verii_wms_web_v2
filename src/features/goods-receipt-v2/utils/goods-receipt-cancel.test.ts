import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  canCancelGoodsReceiptFromWms,
  isGoodsReceiptErpBlockingCancel,
} from './goods-receipt-cancel';

describe('goods-receipt-cancel', () => {
  it('blocks cancel when ERP transfer has started or succeeded', () => {
    assert.equal(isGoodsReceiptErpBlockingCancel('Succeeded'), true);
    assert.equal(isGoodsReceiptErpBlockingCancel('Processing'), true);
    assert.equal(isGoodsReceiptErpBlockingCancel('CommitUncertain'), true);
    assert.equal(isGoodsReceiptErpBlockingCancel('Cancelled'), true);
  });

  it('allows cancel when ERP is not posted yet', () => {
    assert.equal(
      canCancelGoodsReceiptFromWms({ status: 'Completed', erpIntegrationStatus: 'Pending' }),
      true,
    );
    assert.equal(
      canCancelGoodsReceiptFromWms({ status: 'Completed', erpIntegrationStatus: 'Failed' }),
      true,
    );
    assert.equal(
      canCancelGoodsReceiptFromWms({ status: 'Completed', erpIntegrationStatus: 'NotRequired' }),
      true,
    );
  });

  it('blocks cancel for already cancelled receipts and ERP-posted ones', () => {
    assert.equal(
      canCancelGoodsReceiptFromWms({ status: 'Cancelled', erpIntegrationStatus: 'Pending' }),
      false,
    );
    assert.equal(
      canCancelGoodsReceiptFromWms({ status: 'Completed', erpIntegrationStatus: 'Succeeded' }),
      false,
    );
  });
});
