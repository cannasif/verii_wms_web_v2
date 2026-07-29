import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidGoodsReceiptDocumentNo,
  normalizeGoodsReceiptDocumentNo,
} from "./goods-receipt-document-reference";

describe("emirli mal kabul irsaliye referansı", () => {
  it("normal irsaliyeyi 15 alfanümerik karaktere indirger", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("irs-2026-00000001"),
      "IRS202600000001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("IRS202600000001"), true);
    assert.equal(isValidGoodsReceiptDocumentNo("00000000000001"), false);
  });

  it("e-irsaliyeyi 15 alfanümerik karaktere indirger", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("gib-2026-ab0000001"),
      "GIB2026AB000000",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("GIB2026AB000000"), true);
    assert.equal(isValidGoodsReceiptDocumentNo("GIB20260000001"), false);
  });
});
