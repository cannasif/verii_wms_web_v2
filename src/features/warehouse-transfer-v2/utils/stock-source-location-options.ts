import type { DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import { formatProjectNumber } from '@/lib/project-format';
import { warehouseTransferApi } from '../api/warehouse-transfer.api';

export interface StockSourceLocationRow {
  id: number;
  code: string;
  name: string;
  availableQuantity?: number;
}

export const stockSourceLocationOption = (row: StockSourceLocationRow) => ({
  value: String(row.id),
  label: `${row.code} · ${row.name}`,
  description: row.availableQuantity !== undefined
    ? `Kullanılabilir: ${formatProjectNumber(row.availableQuantity)}`
    : undefined,
});

export function fetchStockSourceLocationsPage(
  request: DropdownPageRequest,
  branchCode: string,
  warehouseId: number,
  stockId: number,
  yapCodeId?: number,
) {
  return warehouseTransferApi.stockLocationsPage(request, branchCode, warehouseId, stockId, yapCodeId).then((page) => ({
    ...page,
    items: page.items.map((row) => ({
      id: row.locationId,
      code: row.locationCode,
      name: row.locationName,
      availableQuantity: row.availableQuantity,
    })),
  }));
}
