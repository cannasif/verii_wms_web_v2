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
  it('preserves Turkish and English I variants for server-side collation', () => {
    assert.equal(toTurkishApiSearch('ADMİN'), 'ADMİN');
    assert.equal(toTurkishApiSearch('admin'), 'admin');
    assert.equal(toTurkishApiSearch('Admin'), 'Admin');
    assert.equal(toTurkishApiSearch('ADMIN'), 'ADMIN');
  });

  it('does not turn dotted Turkish text into a different word', () => {
    assert.equal(toTurkishApiSearch('SABİT'), 'SABİT');
    assert.equal(toTurkishApiSearch('sabit'), 'sabit');
    assert.equal(toTurkishApiSearch('  sabit  '), 'sabit');
  });

  it('preserves all remaining Turkish characters', () => {
    assert.equal(toTurkishApiSearch('Erdoğan'), 'Erdoğan');
    assert.equal(toTurkishApiSearch('işlem'), 'işlem');
  });
});

describe('appendFoldedSearchToken', () => {
  it('appends trimmed tokens and dedupes by Turkish fold', () => {
    assert.deepEqual(appendFoldedSearchToken([], '  GENEL '), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'genel'), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'DIGI'), ['GENEL', 'DIGI']);
  });
});
