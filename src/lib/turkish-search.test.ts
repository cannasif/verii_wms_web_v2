import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { appendFoldedSearchToken, foldTurkishSearch, toTurkishApiSearch } from './turkish-search';

describe('foldTurkishSearch', () => {
  it('folds DİGİ and DIGI to the same key', () => {
    assert.equal(foldTurkishSearch('DİGİ'), 'digi');
    assert.equal(foldTurkishSearch('DIGI'), 'digi');
    assert.equal(foldTurkishSearch('dıgı'), 'digi');
    assert.equal(foldTurkishSearch('DiGi'), 'digi');
  });

  it('folds ş ğ ü ö ç', () => {
    assert.equal(foldTurkishSearch('İŞĞÜÖÇ'), 'isguoc');
    assert.equal(foldTurkishSearch('işgüöç'), 'isguoc');
  });
});

describe('toTurkishApiSearch', () => {
  it('returns Latin uppercase for API contains', () => {
    assert.equal(toTurkishApiSearch('DİGİ'), 'DIGI');
    assert.equal(toTurkishApiSearch('  digi  '), 'DIGI');
    assert.equal(toTurkishApiSearch(''), '');
  });
});

describe('appendFoldedSearchToken', () => {
  it('appends trimmed tokens and dedupes by Turkish fold', () => {
    assert.deepEqual(appendFoldedSearchToken([], '  GENEL '), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'genel'), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'DIGI'), ['GENEL', 'DIGI']);
  });
});
