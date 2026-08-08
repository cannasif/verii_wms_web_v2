import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  completeGoodsReceiptDocumentNo,
  isValidGoodsReceiptDocumentNo,
  normalizeGoodsReceiptDocumentNo,
} from "./goods-receipt-document-reference";

describe("emirli mal kabul irsaliye referansı", () => {
  it("normal irsaliyedeki sembolleri korur ve 15 karakterle sınırlar", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("irs-2026-000001"),
      "IRS-2026-000001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("IRS-2026-000001"), true);
    assert.equal(isValidGoodsReceiptDocumentNo("00000000000001"), false);
  });

  it("e-irsaliyede yıldız ve eğik çizgi gibi sembolleri kabul eder", () => {
    assert.equal(
      normalizeGoodsReceiptDocumentNo("gib*2026/ab0001"),
      "GIB*2026/AB0001",
    );
    assert.equal(isValidGoodsReceiptDocumentNo("GIB*2026/AB0001"), true);
    assert.equal(isValidGoodsReceiptDocumentNo("GIB20260000001"), false);
  });

  it("son sayısal bölümü sıfırla doldurarak 15 haneye tamamlar", () => {
    assert.equal(completeGoodsReceiptDocumentNo("AB2"), "AB0000000000002");
    assert.equal(completeGoodsReceiptDocumentNo("AB-2"), "AB-000000000002");
    assert.equal(completeGoodsReceiptDocumentNo("ABD2026"), "ABD000000002026");
    assert.equal(
      completeGoodsReceiptDocumentNo("ERS202600029"),
      "ERS000202600029",
    );
    assert.equal(
      completeGoodsReceiptDocumentNo("gib2026ab1"),
      "GIB2026AB000001",
    );
    assert.equal(completeGoodsReceiptDocumentNo("2"), "200000000000000");
    assert.equal(completeGoodsReceiptDocumentNo("10"), "100000000000000");
    assert.equal(completeGoodsReceiptDocumentNo("AB*12"), "AB*000000000012");
  });

  it("boş değerde ve sayısal son eki olmayan değerde dokunmaz", () => {
    assert.equal(completeGoodsReceiptDocumentNo(""), "");
    assert.equal(completeGoodsReceiptDocumentNo("   "), "");
    assert.equal(completeGoodsReceiptDocumentNo("ABC"), "ABC");
  });
});
