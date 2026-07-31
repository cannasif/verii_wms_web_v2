export function normalizeGoodsReceiptDocumentNo(value: string): string {
  return Array.from(value.toUpperCase())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x21 && code <= 0x7e;
    })
    .join("")
    .slice(0, 15);
}

/**
 * 15 karaktere tamamlar (boşsa dokunmaz).
 * - Başta harf/sembol, sonda rakam → araya sıfır (ABD2026 → ABD000000002026)
 * - Tamamı rakam → sona sıfır (10 → 100000000000000)
 * - Sonda rakam yoksa değiştirmez
 */
export function completeGoodsReceiptDocumentNo(value: string): string {
  const normalized = normalizeGoodsReceiptDocumentNo(value);
  if (!normalized || normalized.length >= 15) return normalized;

  const numericSuffix = normalized.match(/\d+$/)?.[0];
  if (!numericSuffix) return normalized;

  const prefix = normalized.slice(0, -numericSuffix.length);
  if (!prefix) {
    return `${normalized}${"0".repeat(15 - normalized.length)}`;
  }

  return `${prefix}${numericSuffix.padStart(15 - prefix.length, "0")}`;
}

export function isValidGoodsReceiptDocumentNo(value: string): boolean {
  return /^[\x21-\x7E]{15}$/.test(value);
}
