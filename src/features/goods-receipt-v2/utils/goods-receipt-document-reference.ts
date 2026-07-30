export function normalizeGoodsReceiptDocumentNo(value: string): string {
  return Array.from(value.toUpperCase())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x21 && code <= 0x7e;
    })
    .join("")
    .slice(0, 15);
}

export function completeGoodsReceiptDocumentNo(value: string): string {
  const normalized = normalizeGoodsReceiptDocumentNo(value);
  if (!normalized || normalized.length >= 15) return normalized;

  const numericSuffix = normalized.match(/\d+$/)?.[0];
  if (!numericSuffix) return normalized;

  const prefix = normalized.slice(0, -numericSuffix.length);
  return `${prefix}${numericSuffix.padStart(15 - prefix.length, "0")}`;
}

export function isValidGoodsReceiptDocumentNo(value: string): boolean {
  return /^[\x21-\x7E]{15}$/.test(value);
}
