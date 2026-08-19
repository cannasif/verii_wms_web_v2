import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { lineQuotaBucket } from './kkd-quota-review';

describe('lineQuotaBucket', () => {
  it('keeps approved and rejected decisions even when the line is still excess', () => {
    assert.equal(lineQuotaBucket('Approved', true), 'approved');
    assert.equal(lineQuotaBucket('Rejected', true), 'rejected');
  });

  it('treats pending or excess lines as the review queue', () => {
    assert.equal(lineQuotaBucket('Pending', false), 'pending');
    assert.equal(lineQuotaBucket('None', true), 'pending');
  });

  it('hides in-quota lines with no decision', () => {
    assert.equal(lineQuotaBucket('None', false), 'none');
  });
});
