import type { GoodsReceiptLabelRow } from "../types/goods-receipt.types";

export const GOODS_RECEIPT_LABEL_BARCODE_SOURCE = "GoodsReceiptLabel";

export function isGoodsReceiptLabelBarcode(source: string | null | undefined): boolean {
  return source === GOODS_RECEIPT_LABEL_BARCODE_SOURCE;
}

export function activePreLabelsForTask(
  labels: GoodsReceiptLabelRow[],
  openTaskLineIds: ReadonlySet<number>,
): GoodsReceiptLabelRow[] {
  return labels.filter(
    (label) =>
      label.taskLineId != null &&
      openTaskLineIds.has(label.taskLineId) &&
      !["Consumed", "Void", "Split"].includes(label.status),
  );
}

export function printedPreLabelsForTask(
  labels: GoodsReceiptLabelRow[],
  openTaskLineIds: ReadonlySet<number>,
): GoodsReceiptLabelRow[] {
  return activePreLabelsForTask(labels, openTaskLineIds).filter(
    (label) => label.status === "Printed" || label.printCount > 0,
  );
}
