import { normalizeGridPage } from '@/lib/paged';
import { getErpMirrorPage } from './api/erp-mirror.api';
import type { StockMirror } from './types/erp-mirror.types';

export type StockIdentityRef = {
  stockId?: number | null;
  stockCode?: string | null;
  stockName?: string | null;
  branchCode?: string | null;
};

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase('tr-TR');

async function fetchStockPage(filters: Array<{ column: string; operator: string; value: string }>, search = '') {
  const page = await getErpMirrorPage<StockMirror>('stocks', {
    pageNumber: 1,
    pageSize: 25,
    search: search || null,
    sortBy: 'erpStockCode',
    sortDirection: 'asc',
    filterLogic: 'and',
    filters,
  });
  return normalizeGridPage<StockMirror>(page).items;
}

export async function resolveStockMirror(ref: StockIdentityRef): Promise<StockMirror> {
  const branchCode = ref.branchCode?.trim() || undefined;
  const stockId = typeof ref.stockId === 'number' && Number.isFinite(ref.stockId) && ref.stockId > 0
    ? ref.stockId
    : null;
  const stockCode = ref.stockCode?.trim() || '';

  if (stockId != null) {
    const filters = [
      { column: 'id', operator: 'equals', value: String(stockId) },
      ...(branchCode ? [{ column: 'branchCode', operator: 'equals', value: branchCode }] : []),
    ];
    const byId = await fetchStockPage(filters);
    const match = byId.find((item) => item.id === stockId)
      ?? byId[0];
    if (match) return match;
  }

  if (!stockCode) {
    throw new Error('STOCK_NOT_FOUND');
  }

  const filters = branchCode
    ? [{ column: 'branchCode', operator: 'equals', value: branchCode }]
    : [];
  const byCode = await fetchStockPage(filters, stockCode);
  const needle = normalizeCode(stockCode);
  const match = byCode.find((item) => normalizeCode(item.erpStockCode) === needle);
  if (match) return match;

  throw new Error('STOCK_NOT_FOUND');
}
