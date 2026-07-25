import type { ApiResponse, PagedResponse } from '@/types/api';

export interface WarehouseStockBalanceDto {
  id: number;
  branchCode: string;
  warehouseId: number;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  stockId: number;
  stockCode?: string | null;
  stockName?: string | null;
  yapKodId?: number | null;
  yapKodCode?: string | null;
  yapKodName?: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  distinctSerialCount: number;
  distinctShelfCount: number;
  lastTransactionDate?: string | null;
  lastRecalculatedAt?: string | null;
}

export interface WarehouseStockSerialBalanceDto {
  id: number;
  branchCode: string;
  warehouseId: number;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  shelfId?: number | null;
  shelfCode?: string | null;
  shelfName?: string | null;
  stockId: number;
  stockCode?: string | null;
  stockName?: string | null;
  yapKodId?: number | null;
  yapKodCode?: string | null;
  yapKodName?: string | null;
  serialNo?: string | null;
  serialNo2?: string | null;
  serialNo3?: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  stockStatus?: string | null;
  lastTransactionDate?: string | null;
}

export interface WarehouseBalanceRebuildResultDto {
  summaryRecordCount: number;
  warehouseId?: number | null;
  stockId?: number | null;
  rebuiltAt: string;
}

export interface WarehouseBalanceConsistencySummaryDto {
  summaryRowCount: number;
  detailGroupCount: number;
  mismatchCount: number;
  missingSummaryCount: number;
  extraSummaryCount: number;
  checkedAt: string;
}

export interface WarehouseBalanceConsistencyIssueDto {
  branchCode: string;
  warehouseId: number;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  stockId: number;
  stockCode?: string | null;
  stockName?: string | null;
  yapKodId?: number | null;
  yapKodCode?: string | null;
  yapKodName?: string | null;
  issueType: string;
  summaryQuantity: number;
  detailQuantity: number;
  summaryReservedQuantity: number;
  detailReservedQuantity: number;
  summaryAvailableQuantity: number;
  detailAvailableQuantity: number;
  summaryDistinctSerialCount: number;
  detailDistinctSerialCount: number;
  summaryDistinctShelfCount: number;
  detailDistinctShelfCount: number;
}

export type WarehouseStockBalancePagedResponse = ApiResponse<PagedResponse<WarehouseStockBalanceDto>>;
export type WarehouseStockSerialBalancePagedResponse = ApiResponse<PagedResponse<WarehouseStockSerialBalanceDto>>;
