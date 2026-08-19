import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  formatProjectQuantity,
  isPieceUnit,
  maskProjectQuantityInput,
  nextQuantityCaret,
  parseLocalizedNumber,
} from './project-format';

const tr = { numberLocale: 'tr-TR', decimalPlaces: 2 } as const;

describe('parseLocalizedNumber', () => {
  it('parses TR grouping and decimal separators', () => {
    assert.equal(parseLocalizedNumber('1.000', tr), 1000);
    assert.equal(parseLocalizedNumber('1,5', tr), 1.5);
    assert.equal(parseLocalizedNumber('1.234,56', tr), 1234.56);
  });

  it('still accepts a dotted decimal when TR grouping does not apply', () => {
    assert.equal(parseLocalizedNumber('1.5', tr), 1.5);
  });
});

describe('quantity display and input mask', () => {
  it('treats adet-like units as whole pieces', () => {
    assert.equal(isPieceUnit('adet'), true);
    assert.equal(isPieceUnit('PCS'), true);
    assert.equal(isPieceUnit('KG'), false);
    assert.equal(formatProjectQuantity(12.4, 'AD', tr), '12');
  });

  it('masks piece input with grouping and keeps the caret on the typed digit', () => {
    assert.equal(maskProjectQuantityInput('1234', 'AD', tr), '1.234');
    assert.equal(nextQuantityCaret('123', 3, '1.234'), 4);
  });

  it('keeps a trailing decimal while typing a weight', () => {
    assert.equal(maskProjectQuantityInput('1,', 'KG', tr), '1,');
    assert.equal(maskProjectQuantityInput('1,5', 'KG', tr), '1,5');
  });
});
