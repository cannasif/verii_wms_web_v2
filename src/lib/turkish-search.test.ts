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
  it('maps Turkish/English I variants to Latin ADMIN for Administrator', () => {
    assert.equal(toTurkishApiSearch('ADMİN'), 'ADMIN');
    assert.equal(toTurkishApiSearch('admin'), 'ADMIN');
    assert.equal(toTurkishApiSearch('Admin'), 'ADMIN');
    assert.equal(toTurkishApiSearch('ADMIN'), 'ADMIN');
  });

  it('folds DİGİ / digi to DIGI for ERP-style codes', () => {
    assert.equal(toTurkishApiSearch('DİGİ'), 'DIGI');
    assert.equal(toTurkishApiSearch('digi'), 'DIGI');
  });

  it('preserves ğüşöç so Turkish names still match', () => {
    assert.equal(toTurkishApiSearch('Erdoğan'), 'ERDOĞAN');
    assert.equal(toTurkishApiSearch('erdoğan'), 'ERDOĞAN');
    assert.equal(toTurkishApiSearch('işlem'), 'IŞLEM');
  });
});

describe('appendFoldedSearchToken', () => {
  it('appends trimmed tokens and dedupes by Turkish fold', () => {
    assert.deepEqual(appendFoldedSearchToken([], '  GENEL '), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'genel'), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'DIGI'), ['GENEL', 'DIGI']);
  });
});
