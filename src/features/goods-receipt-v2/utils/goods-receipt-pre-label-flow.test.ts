import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { GoodsReceiptLabelRow } from "../types/goods-receipt.types";
import {
  activePreLabelsForTask,
  isGoodsReceiptLabelBarcode,
  printedPreLabelsForTask,
} from "./goods-receipt-pre-label-flow";

const label = (
  id: number,
  taskLineId: number | undefined,
  status: string,
  printCount = 0,
): GoodsReceiptLabelRow => ({
  id,
  batchId: 1,
  goodsReceiptId: 10,
  goodsReceiptLineId: 20,
  taskLineId,
  stockId: 30,
  stockCode: "STK-1",
  quantity: 1,
  unitCode: "ADET",
  barcodeValue: `GR-${id}`,
  status,
  printCount,
  rowVersion: "",
});

describe("ön etiket kabul akışı", () => {
  it("yalnız mal kabul etiketi kaynağını geçerli sayar", () => {
    assert.equal(isGoodsReceiptLabelBarcode("GoodsReceiptLabel"), true);
    assert.equal(isGoodsReceiptLabelBarcode("GeneratedBarcode"), false);
    assert.equal(isGoodsReceiptLabelBarcode("StockAlias"), false);
  });

  it("başka satırın, tüketilmiş ve iptal edilmiş etiketlerini dışarıda bırakır", () => {
    const result = activePreLabelsForTask(
      [
        label(1, 100, "Generated"),
        label(2, 100, "Printed", 1),
        label(3, 100, "Consumed", 1),
        label(4, 100, "Void"),
        label(5, 200, "Printed", 1),
      ],
      new Set([100]),
    );

    assert.deepEqual(
      result.map((item) => item.id),
      [1, 2],
    );
  });

  it("yalnız yazdırılmış açık ön etiketleri okutmaya hazır sayar", () => {
    const result = printedPreLabelsForTask(
      [
        label(1, 100, "Generated"),
        label(2, 100, "Printed", 1),
        label(3, 100, "Generated", 1),
      ],
      new Set([100]),
    );

    assert.deepEqual(
      result.map((item) => item.id),
      [2, 3],
    );
  });
});
