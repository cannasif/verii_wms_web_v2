export function normalizeGoodsReceiptDocumentNo(
  value: string,
  electronic: boolean,
): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, electronic ? 16 : 15);
}

export function isValidGoodsReceiptDocumentNo(
  value: string,
  electronic: boolean,
): boolean {
  return new RegExp(`^[A-Z0-9]{${electronic ? 16 : 15}}$`).test(value);
}
