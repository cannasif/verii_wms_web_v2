import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isInstantInCreatedPeriod } from './created-period';

describe('isInstantInCreatedPeriod', () => {
  const august = new Date(2026, 7, 15, 10, 30, 0);

  it('keeps date-only work order dates inside the selected month', () => {
    assert.equal(isInstantInCreatedPeriod('2026-08-01', 'month', august), true);
    assert.equal(isInstantInCreatedPeriod('2026-08-31', 'month', august), true);
    assert.equal(isInstantInCreatedPeriod('2026-07-31', 'month', august), false);
    assert.equal(isInstantInCreatedPeriod('2026-09-01', 'month', august), false);
  });

  it('treats a missing date as outside a selected period', () => {
    assert.equal(isInstantInCreatedPeriod(undefined, 'month', august), false);
    assert.equal(isInstantInCreatedPeriod(undefined, null, august), true);
  });
});
