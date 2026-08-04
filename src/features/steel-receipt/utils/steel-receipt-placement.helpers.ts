import type { SteelLineRow, SteelPendingPlacementSource } from '../types/steel-receipt.types';

export function isPlacementPendingLine(row: SteelLineRow): boolean {
  return row.conversionStatus !== 'NotCreated'
    && Boolean(row.goodsReceiptId)
    && row.putawayStatus !== 'Placed';
}

export function filterPlacementPendingLines(lines: SteelLineRow[]): SteelLineRow[] {
  return lines.filter(isPlacementPendingLine);
}

export function filterPlacementLinesBySearch(lines: SteelLineRow[], search: string): SteelLineRow[] {
  const normalized = search.trim().toLocaleLowerCase('tr-TR');
  if (!normalized) return lines;
  return lines.filter((row) => [
    row.dCode,
    row.stockCode,
    row.stockName,
    row.supplierSerialNo,
    row.netsisOrderNo,
    row.importReferenceNo,
  ].some((value) => value?.toLocaleLowerCase('tr-TR').includes(normalized)));
}

export function groupPlacementImportSources(lines: SteelLineRow[]): SteelPendingPlacementSource[] {
  const grouped = new Map<string, number>();
  for (const line of lines) {
    const reference = line.importReferenceNo?.trim();
    if (!reference) continue;
    grouped.set(reference, (grouped.get(reference) ?? 0) + 1);
  }
  return Array.from(grouped.entries())
    .map(([importReferenceNo, pendingLineCount]) => ({ importReferenceNo, pendingLineCount }));
}

export function sortPlacementImportSources(
  sources: SteelPendingPlacementSource[],
): SteelPendingPlacementSource[] {
  return [...sources].sort((left, right) => {
    const byImportedAt = (right.importedAtUtc ?? '').localeCompare(left.importedAtUtc ?? '');
    if (byImportedAt !== 0) return byImportedAt;
    return right.importReferenceNo.localeCompare(left.importReferenceNo, 'tr');
  });
}
