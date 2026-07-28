import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidGoodsReceiptDocumentNo,
  normalizeGoodsReceiptDocumentNo,
} from "./goods-receipt-document-reference";

describe("emirli mal kabul irsaliye referansı", () => {
  it("normal irsaliyeyi 15 alfanümerik karaktere indirger", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("irs-2026-00000001", false),
      "IRS202600000001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("IRS202600000001", false), true);
    assert.equal(isValidGoodsReceiptDocumentNo("00000000000001", false), false);
  });

  it("e-irsaliyeyi 16 alfanümerik karaktere indirger", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("gib-2026-ab0000001", true),
      "GIB2026AB0000001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("GIB2026AB0000001", true), true);
    assert.equal(isValidGoodsReceiptDocumentNo("GIB202600000001", true), false);
  });
});
