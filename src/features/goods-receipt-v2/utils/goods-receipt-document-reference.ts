export function normalizeGoodsReceiptDocumentNo(
  value: string,
  electronic: boolean,
): string {
  return electronic
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16)
    : value.replace(/\D/g, "").slice(0, 15);
}

export function isValidGoodsReceiptDocumentNo(
  value: string,
  electronic: boolean,
): boolean {
  return electronic
    ? /^[A-Z0-9]{3}[0-9]{13}$/.test(value)
    : /^[0-9]{15}$/.test(value);
}
