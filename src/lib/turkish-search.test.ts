import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { appendFoldedSearchToken, foldTurkishSearch } from './turkish-search';

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

  it('folds words containing dotted and dotless i together', () => {
    assert.equal(foldTurkishSearch('ALIŞVERİŞ'), 'alisveris');
    assert.equal(foldTurkishSearch('alisveris'), 'alisveris');
    assert.equal(foldTurkishSearch('Çağrı ŞİMŞEK görüş'), 'cagri simsek gorus');
    assert.equal(foldTurkishSearch('kâr sükûnet'), 'kar sukunet');
  });

  it('keeps LIKE control characters literal in local matching', () => {
    assert.equal(foldTurkishSearch('100%_[]^\\'), '100%_[]^\\');
  });
});

describe('appendFoldedSearchToken', () => {
  it('appends trimmed tokens and dedupes by Turkish fold', () => {
    assert.deepEqual(appendFoldedSearchToken([], '  GENEL '), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'genel'), ['GENEL']);
    assert.deepEqual(appendFoldedSearchToken(['GENEL'], 'DIGI'), ['GENEL', 'DIGI']);
  });
});
