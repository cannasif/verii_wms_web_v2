import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { goodsReceiptApi } from '@/features/goods-receipt/api/goods-receipt-api';
import { shipmentApi } from '@/features/shipment/api/shipment-api';
import { transferApi } from '@/features/transfer/api/transfer-api';
import { warehouseBalanceApi } from '@/features/warehouse-balance/api/warehouse-balance.api';
import { useAuthStore } from '@/stores/auth-store';
import type { GrHeader } from '@/features/goods-receipt/types/goods-receipt';
import type { ShipmentHeader } from '@/features/shipment/types/shipment';

const COUNT_PARAMS = { pageNumber: 1, pageSize: 1 } as const;
const RECENT_PARAMS = {
  pageNumber: 1,
  pageSize: 6,
  sortBy: 'UpdatedDate',
  sortDirection: 'desc',
} as const;

export type DashboardActivityKind = 'goods-receipt' | 'shipment';

export interface DashboardActivityItem {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
  statusKey: 'completed' | 'preparing' | 'pending';
}

export interface DashboardMetrics {
  stockSkuCount: number;
  goodsReceiptCount: number;
  assignedGoodsReceiptCount: number;
  pendingApprovalCount: number;
  shipmentCount: number;
  assignedShipmentCount: number;
  transferCount: number;
  myTasksCount: number;
  activityItems: DashboardActivityItem[];
}

function resolveTotalCount(value: unknown): number {
  if (value == null || typeof value !== 'object') return 0;

  const direct = value as { totalCount?: number; data?: unknown };
  if (typeof direct.totalCount === 'number') return direct.totalCount;

  if (direct.data != null && typeof direct.data === 'object') {
    const nested = direct.data as { totalCount?: number; data?: unknown[] };
    if (typeof nested.totalCount === 'number') return nested.totalCount;
    if (Array.isArray(nested.data)) return nested.data.length;
  }

  if (Array.isArray(direct.data)) return direct.data.length;
  return 0;
}

function resolvePagedRows<T>(value: unknown): T[] {
  if (value == null || typeof value !== 'object') return [];

  const direct = value as { data?: unknown };
  if (Array.isArray(direct.data)) return direct.data as T[];

  if (direct.data != null && typeof direct.data === 'object') {
    const nested = direct.data as { data?: unknown[] };
    if (Array.isArray(nested.data)) return nested.data as T[];
  }

  return [];
}

function mapGrActivity(item: GrHeader): DashboardActivityItem {
  const statusKey = item.isCompleted ? 'completed' : item.approvalStatus === false ? 'pending' : 'preparing';
  return {
    id: `gr-${item.id}`,
    kind: 'goods-receipt',
    title: item.documentNo || `#${item.id}`,
    subtitle: item.customerName || item.customerCode || '-',
    timestamp: item.updatedDate || item.createdDate || '',
    statusKey,
  };
}

function mapShipmentActivity(item: ShipmentHeader): DashboardActivityItem {
  const statusKey = item.isCompleted ? 'completed' : item.isPendingApproval ? 'pending' : 'preparing';
  return {
    id: `sh-${item.id}`,
    kind: 'shipment',
    title: item.documentNo || `#${item.id}`,
    subtitle: item.customerName || item.customerCode || '-',
    timestamp: item.updatedDate || item.createdDate || '',
    statusKey,
  };
}

export function useDashboardMetrics(): {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  branch: ReturnType<typeof useAuthStore.getState>['branch'];
  metrics: DashboardMetrics;
  isLoading: boolean;
  isError: boolean;
} {
  const user = useAuthStore((state) => state.user);
  const branch = useAuthStore((state) => state.branch);
  const userId = user?.id;

  const [
    stockQuery,
    grQuery,
    grAssignedQuery,
    grApprovalQuery,
    shipmentQuery,
    shipmentAssignedQuery,
    transferQuery,
    recentGrQuery,
    recentShipmentQuery,
  ] = useQueries({
    queries: [
      {
        queryKey: ['dashboard', 'stock-count'],
        queryFn: ({ signal }) => warehouseBalanceApi.getStockPaged(COUNT_PARAMS, { signal }),
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'gr-count'],
        queryFn: ({ signal }) => goodsReceiptApi.getGrHeadersPaged(COUNT_PARAMS, { signal }),
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'gr-assigned', userId],
        queryFn: ({ signal }) => goodsReceiptApi.getAssignedHeaders(userId!, COUNT_PARAMS, { signal }),
        enabled: userId != null,
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'gr-approval'],
        queryFn: ({ signal }) => goodsReceiptApi.getAwaitingApprovalHeaders(COUNT_PARAMS, { signal }),
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'shipment-count'],
        queryFn: ({ signal }) => shipmentApi.getHeadersPaged(COUNT_PARAMS, { signal }),
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'shipment-assigned', userId],
        queryFn: ({ signal }) => shipmentApi.getAssignedHeaders(userId!, COUNT_PARAMS, { signal }),
        enabled: userId != null,
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'transfer-count'],
        queryFn: ({ signal }) => transferApi.getHeadersPaged(COUNT_PARAMS, { signal }),
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'recent-gr'],
        queryFn: ({ signal }) => goodsReceiptApi.getGrHeadersPaged(RECENT_PARAMS, { signal }),
        staleTime: 60_000,
      },
      {
        queryKey: ['dashboard', 'recent-shipment'],
        queryFn: ({ signal }) => shipmentApi.getHeadersPaged(RECENT_PARAMS, { signal }),
        staleTime: 60_000,
      },
    ],
  });

  const assignedGoodsReceiptCount = resolveTotalCount(grAssignedQuery.data);
  const assignedShipmentCount = resolveTotalCount(shipmentAssignedQuery.data);

  const metrics = useMemo<DashboardMetrics>(() => {
    const activityItems = [
      ...resolvePagedRows<GrHeader>(recentGrQuery.data).map(mapGrActivity),
      ...resolvePagedRows<ShipmentHeader>(recentShipmentQuery.data).map(mapShipmentActivity),
    ]
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return {
      stockSkuCount: resolveTotalCount(stockQuery.data),
      goodsReceiptCount: resolveTotalCount(grQuery.data),
      assignedGoodsReceiptCount,
      pendingApprovalCount: resolveTotalCount(grApprovalQuery.data),
      shipmentCount: resolveTotalCount(shipmentQuery.data),
      assignedShipmentCount,
      transferCount: resolveTotalCount(transferQuery.data),
      myTasksCount: assignedGoodsReceiptCount + assignedShipmentCount,
      activityItems,
    };
  }, [
    assignedGoodsReceiptCount,
    assignedShipmentCount,
    grApprovalQuery.data,
    grQuery.data,
    recentGrQuery.data,
    recentShipmentQuery.data,
    shipmentQuery.data,
    stockQuery.data,
    transferQuery.data,
  ]);

  const isLoading = [
    stockQuery,
    grQuery,
    grAssignedQuery,
    grApprovalQuery,
    shipmentQuery,
    shipmentAssignedQuery,
    transferQuery,
    recentGrQuery,
    recentShipmentQuery,
  ].some((query) => query.isLoading);

  const isError = [
    stockQuery,
    grQuery,
    grAssignedQuery,
    grApprovalQuery,
    shipmentQuery,
    shipmentAssignedQuery,
    transferQuery,
    recentGrQuery,
    recentShipmentQuery,
  ].some((query) => query.isError);

  return { user, branch, metrics, isLoading, isError };
}
