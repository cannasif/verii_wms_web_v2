import { formatProjectNumber } from '@/lib/project-format';
import type { OpenOrderLine } from '../types/goods-receipt.types';

/** Küçük/büyük + Türkçe karakter katlama: "is" ↔ "İŞ", "genel" ↔ "GENEL". */
export function normalizeDirectLineSearchToken(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function appendDirectLineSearchToken(
  tokens: string[],
  raw: string,
): string[] {
  const normalized = normalizeDirectLineSearchToken(raw);
  if (!normalized) return tokens;
  if (
    tokens.some(
      (token) => normalizeDirectLineSearchToken(token) === normalized,
    )
  ) {
    return tokens;
  }
  return [...tokens, raw.trim()];
}

export function buildDirectOrderLineSearchHaystack(
  line: OpenOrderLine,
  warehouseName?: string,
): string {
  const quantities = [
    line.orderedQuantity,
    line.remainingQuantity,
    line.availableQuantity,
    line.deliveredQuantity,
    line.plannedQuantity,
  ]
    .filter((value): value is number => value != null && Number.isFinite(value))
    .flatMap((value) => [String(value), formatProjectNumber(value)]);

  return normalizeDirectLineSearchToken(
    [
      line.siparisNo,
      line.projectCode,
      line.stockCode,
      line.stockName,
      line.yapCode,
      line.yapDescription,
      line.unitCode,
      line.customerCode,
      line.customerName,
      line.targetWarehouseCode != null ? String(line.targetWarehouseCode) : '',
      warehouseName,
      ...quantities,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' '),
  );
}

export function matchesDirectOrderLineSearch(
  line: OpenOrderLine,
  tokens: string[],
  warehouseName?: string,
): boolean {
  const queries = tokens.map(normalizeDirectLineSearchToken).filter(Boolean);

  if (queries.length === 0) return true;

  const haystack = buildDirectOrderLineSearchHaystack(line, warehouseName);
  return queries.every((query) => haystack.includes(query));
}

export function filterVisibleDirectOrderLines(
  lines: OpenOrderLine[],
  options: {
    projectCodeFilter?: string;
    warehouseCodeFilter?: string;
    searchTokens?: string[];
    warehouseNameByCode?: ReadonlyMap<number, string>;
  },
): OpenOrderLine[] {
  const projectCode = options.projectCodeFilter?.trim() ?? '';
  const warehouseCodeRaw = options.warehouseCodeFilter?.trim() ?? '';
  const warehouseCode =
    warehouseCodeRaw === '' ? null : Number(warehouseCodeRaw);
  const tokens = options.searchTokens ?? [];
  const names = options.warehouseNameByCode;

  return lines.filter((line) => {
    if (projectCode && line.projectCode?.trim() !== projectCode) return false;
    if (
      warehouseCode != null &&
      Number.isFinite(warehouseCode) &&
      line.targetWarehouseCode !== warehouseCode
    ) {
      return false;
    }
    const warehouseName =
      line.targetWarehouseCode != null
        ? names?.get(line.targetWarehouseCode)
        : undefined;
    return matchesDirectOrderLineSearch(line, tokens, warehouseName);
  });
}
