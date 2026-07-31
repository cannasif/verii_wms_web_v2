import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isYearFirstDateDigits,
  maskManualDateTyping,
  normalizeManualDateInput,
  toDisplayDateValue,
} from './app-date-input.utils';

describe('app date input mask', () => {
  it('shows ISO values with dots', () => {
    assert.equal(toDisplayDateValue('2026-07-31'), '2026.07.31');
  });

  it('detects year-first vs day-first', () => {
    assert.equal(isYearFirstDateDigits('20261212'), true);
    assert.equal(isYearFirstDateDigits('12102026'), false);
    assert.equal(isYearFirstDateDigits('20'), true);
    assert.equal(isYearFirstDateDigits('12'), false);
  });

  it('masks YYYYMMDD as year-first', () => {
    assert.equal(maskManualDateTyping('20261212'), '2026.12.12');
    assert.equal(maskManualDateTyping('20261301'), '2026.12.01');
    assert.equal(maskManualDateTyping('20260230'), '2026.02.28');
  });

  it('masks DDMMYYYY as day-first (TR)', () => {
    assert.equal(maskManualDateTyping('12102026'), '12.10.2026');
    assert.equal(maskManualDateTyping('05122026'), '05.12.2026');
    assert.equal(maskManualDateTyping('31112026'), '30.11.2026');
  });

  it('normalizes both shapes to ISO', () => {
    assert.equal(normalizeManualDateInput('2026.12.12', 'date'), '2026-12-12');
    assert.equal(normalizeManualDateInput('20261212', 'date'), '2026-12-12');
    assert.equal(normalizeManualDateInput('12102026', 'date'), '2026-10-12');
    assert.equal(normalizeManualDateInput('12.10.2026', 'date'), '2026-10-12');
    assert.equal(normalizeManualDateInput('', 'date'), '');
    assert.equal(normalizeManualDateInput('2026.12', 'date'), null);
  });
});
