import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  formatEntitlementDenialBadge,
  formatEntitlementDenialTitle,
  formatErpStatus,
  isErpLocked,
  isQuotaExhaustionReason,
  KKD_QUOTA_FULL_TITLE,
} from './kkd-quota-copy';

describe('isErpLocked', () => {
  it('locks deliveries once Netsis posting has started or finished', () => {
    assert.equal(isErpLocked('Processing'), true);
    assert.equal(isErpLocked('Succeeded'), true);
    assert.equal(isErpLocked('CommitUncertain'), true);
  });

  it('keeps failed or unsent deliveries cancellable in WMS', () => {
    assert.equal(isErpLocked('Pending'), false);
    assert.equal(isErpLocked('Failed'), false);
    assert.equal(isErpLocked(null), false);
  });
});

describe('formatErpStatus', () => {
  it('maps known posting states to operator labels', () => {
    assert.equal(formatErpStatus('Pending'), 'Gönderilmedi');
    assert.equal(formatErpStatus('Succeeded'), 'Gönderildi');
    assert.equal(formatErpStatus('Failed'), 'Gönderilemedi');
  });
});

describe('entitlement denial copy', () => {
  it('does not call every denial a full quota', () => {
    assert.equal(formatEntitlementDenialTitle('EMPLOYMENT_NOT_STARTED'), 'İşe giriş tarihi henüz gelmedi');
    assert.equal(formatEntitlementDenialBadge('STOCK_GROUP_MISSING'), 'GRUP YOK');
    assert.equal(isQuotaExhaustionReason('EMPLOYMENT_NOT_STARTED'), false);
  });

  it('keeps quota-exhaustion wording only for insufficient entitlement', () => {
    assert.equal(formatEntitlementDenialTitle('INSUFFICIENT_ENTITLEMENT'), KKD_QUOTA_FULL_TITLE);
    assert.equal(formatEntitlementDenialBadge('INSUFFICIENT_ENTITLEMENT'), 'KOTA DOLU');
    assert.equal(isQuotaExhaustionReason('INSUFFICIENT_ENTITLEMENT'), true);
    assert.equal(isQuotaExhaustionReason(null), true);
  });
});
