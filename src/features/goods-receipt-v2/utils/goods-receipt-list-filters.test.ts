import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildGoodsReceiptListFacetFilters,
  countGoodsReceiptListFacets,
  EMPTY_GOODS_RECEIPT_LIST_FACETS,
  setGoodsReceiptFacetValue,
} from './goods-receipt-list-filters';

describe('buildGoodsReceiptListFacetFilters', () => {
  it('builds equals filters for selected dropdown values', () => {
    assert.deepEqual(
      buildGoodsReceiptListFacetFilters({
        ...EMPTY_GOODS_RECEIPT_LIST_FACETS,
        status: 'Draft',
        qualityStatus: 'Pending',
      }),
      [
        { column: 'status', operator: 'equals', value: 'Draft' },
        { column: 'qualityStatus', operator: 'equals', value: 'Pending' },
      ],
    );
  });
});

describe('setGoodsReceiptFacetValue', () => {
  it('sets and clears facet values', () => {
    const withDraft = setGoodsReceiptFacetValue(
      EMPTY_GOODS_RECEIPT_LIST_FACETS,
      'status',
      'Draft',
    );
    assert.equal(withDraft.status, 'Draft');
    assert.equal(countGoodsReceiptListFacets(withDraft), 1);
    assert.equal(
      setGoodsReceiptFacetValue(withDraft, 'status', '').status,
      '',
    );
  });
});
