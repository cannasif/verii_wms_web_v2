export function normalizeGoodsReceiptDocumentNo(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15);
}

export function isValidGoodsReceiptDocumentNo(value: string): boolean {
  return /^[A-Z0-9]{15}$/.test(value);
}
