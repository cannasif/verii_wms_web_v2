import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatErpStatus, isErpLocked } from './kkd-quota-copy';

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
