import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidGoodsReceiptDocumentNo,
  normalizeGoodsReceiptDocumentNo,
} from "./goods-receipt-document-reference";

describe("emirli mal kabul irsaliye referansı", () => {
  it("normal irsaliyeyi yalnız 15 rakama indirger", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("00-000 0000000001abc", false),
      "000000000000001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("000000000000001", false), true);
    assert.equal(isValidGoodsReceiptDocumentNo("00000000000001", false), false);
  });

  it("e-irsaliyeyi büyük harfe çevirip geçerli formatı doğrular", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("gib-2026-000000001", true),
      "GIB2026000000001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("GIB2026000000001", true), true);
    assert.equal(isValidGoodsReceiptDocumentNo("GIB202600000001", true), false);
  });
});
