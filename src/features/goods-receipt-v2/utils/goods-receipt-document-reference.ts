export function normalizeGoodsReceiptDocumentNo(value: string): string {
  return Array.from(value.toUpperCase())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x21 && code <= 0x7e;
    })
    .join("")
    .slice(0, 15);
}

/** E-irsaliye / belge no içindeki 4 haneli yıl (2000–2099). */
function isDocumentYearSuffix(suffix: string): boolean {
  if (!/^\d{4}$/.test(suffix)) return false;
  const year = Number(suffix);
  return year >= 2000 && year <= 2099;
}

/**
 * 15 karaktere tamamlar (boşsa dokunmaz).
 * - Sonda yıl (GIB2026) veya sadece harf (ASD) → sona sıfır
 * - Sonda yıl olmayan rakam (GIB1545) → araya sıfır
 * - Tamamı rakam → sona sıfır
 */
export function completeGoodsReceiptDocumentNo(value: string): string {
  const normalized = normalizeGoodsReceiptDocumentNo(value);
  if (!normalized || normalized.length >= 15) return normalized;

  const numericSuffix = normalized.match(/\d+$/)?.[0];
  if (!numericSuffix) {
    return normalized.padEnd(15, "0");
  }

  const prefix = normalized.slice(0, -numericSuffix.length);
  if (!prefix || isDocumentYearSuffix(numericSuffix)) {
    return normalized.padEnd(15, "0");
  }

  return `${prefix}${numericSuffix.padStart(15 - prefix.length, "0")}`;
}

export function isValidGoodsReceiptDocumentNo(value: string): boolean {
  return /^[\x21-\x7E]{15}$/.test(value);
}
