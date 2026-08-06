import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { WarehouseTransferDetail } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';
import type { ProductionTaskBoard } from '../api';

interface StockFetchKey {
  key: string;
  stockId: number;
  yapCodeId?: number;
  warehouseId: number;
}

function buildStockFetchKeys(
  board: ProductionTaskBoard | undefined,
  detail: WarehouseTransferDetail | undefined,
): StockFetchKey[] {
  if (!board || !detail) return [];
  const detailById = new Map(detail.lines.map((line) => [line.id, line]));
  const keys = new Map<string, StockFetchKey>();

  for (const task of board.tasks) {
    for (const line of task.lines) {
      if (!line.sourceLocationId) continue;
      const transferLine = detailById.get(line.transferLineId);
      if (!transferLine) continue;
      const key = `${transferLine.stockId}|${transferLine.yapCodeId ?? ''}`;
      if (!keys.has(key)) {
        keys.set(key, {
          key,
          stockId: transferLine.stockId,
          yapCodeId: transferLine.yapCodeId,
          warehouseId: board.sourceWarehouseId,
        });
      }
    }
  }

  return [...keys.values()];
}

/** Görev satırlarındaki kaynak raflar için stok bakiyesinden kullanılabilir miktar. */
export function useProductionTaskSourceAvailability(
  board: ProductionTaskBoard | undefined,
  detail: WarehouseTransferDetail | undefined,
  branchCode: string,
) {
  const stockKeys = useMemo(() => buildStockFetchKeys(board, detail), [board, detail]);

  const queries = useQueries({
    queries: stockKeys.map(({ stockId, yapCodeId, warehouseId }) => ({
      queryKey: ['production-task-source-locations', branchCode, warehouseId, stockId, yapCodeId ?? null] as const,
      queryFn: () => warehouseTransferApi.resolveStockLocations(branchCode, warehouseId, stockId, yapCodeId),
      enabled: Boolean(board && detail),
      staleTime: 30_000,
    })),
  });

  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    stockKeys.forEach(({ key }, index) => {
      for (const location of queries[index]?.data ?? []) {
        map.set(`${key}|${location.locationId}`, location.availableQuantity);
      }
    });
    return map;
  }, [queries, stockKeys]);

  const getAvailable = (transferLineId: number, sourceLocationId?: number): number | undefined => {
    if (!detail || !sourceLocationId) return undefined;
    const transferLine = detail.lines.find((line) => line.id === transferLineId);
    if (!transferLine) return undefined;
    const stockKey = `${transferLine.stockId}|${transferLine.yapCodeId ?? ''}`;
    return lookup.get(`${stockKey}|${sourceLocationId}`);
  };

  return {
    getAvailable,
    isLoading: queries.some((query) => query.isLoading),
  };
}
