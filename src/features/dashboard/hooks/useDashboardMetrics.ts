import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { dashboardApi } from '../api/dashboard.api';
import type {
  DashboardActivityItem,
  DashboardMetrics,
  DashboardSummary,
} from '../types/dashboard.types';

export type {
  DashboardActivityItem,
  DashboardActivityKind,
  DashboardActivityStatus,
  DashboardMetrics,
} from '../types/dashboard.types';

const EMPTY_METRICS: DashboardMetrics = {
  stockSkuCount: 0,
  goodsReceiptCount: 0,
  pendingApprovalCount: 0,
  shipmentCount: 0,
  transferCount: 0,
  myTasksCount: 0,
  goodsReceiptTodayCount: 0,
  shipmentTodayCount: 0,
  transferTodayCount: 0,
  pendingQualityInspectionCount: 0,
  openOperationCount: 0,
  inventoryHealth: {
    availablePositionCount: 0,
    reservedPositionCount: 0,
    qualityHoldPositionCount: 0,
    unavailablePositionCount: 0,
  },
  dailyOperations: [],
  systemHealth: {
    generatedAtUtc: '',
    lastBalanceProjectionAtUtc: null,
    erpIssueCount: 0,
  },
  activityItems: [],
};

export function mapDashboardSummary(summary: DashboardSummary | undefined): DashboardMetrics {
  if (!summary) return EMPTY_METRICS;

  const activityItems: DashboardActivityItem[] = (summary.recentActivities ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    timestamp: item.timestamp,
    statusKey: item.status,
  }));

  return {
    stockSkuCount: summary.stockItemCount,
    goodsReceiptCount: summary.goodsReceiptOrderCount,
    pendingApprovalCount: summary.pendingGoodsReceiptApprovalCount,
    shipmentCount: summary.shipmentOrderCount,
    transferCount: summary.activeTransferOrderCount,
    myTasksCount: summary.myAssignedTaskCount,
    goodsReceiptTodayCount: summary.goodsReceiptTodayCount ?? 0,
    shipmentTodayCount: summary.shipmentTodayCount ?? 0,
    transferTodayCount: summary.transferTodayCount ?? 0,
    pendingQualityInspectionCount: summary.pendingQualityInspectionCount ?? 0,
    openOperationCount: summary.openOperationCount ?? 0,
    inventoryHealth: summary.inventoryHealth ?? EMPTY_METRICS.inventoryHealth,
    dailyOperations: summary.dailyOperations ?? [],
    systemHealth: summary.systemHealth ?? EMPTY_METRICS.systemHealth,
    activityItems,
  };
}

export function useDashboardMetrics(): {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  branch: ReturnType<typeof useAuthStore.getState>['branch'];
  metrics: DashboardMetrics;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
} {
  const user = useAuthStore((state) => state.user);
  const branch = useAuthStore((state) => state.branch);

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', user?.id ?? null, branch?.code ?? null],
    queryFn: ({ signal }) => dashboardApi.getSummary({ signal }),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const metrics = useMemo(
    () => mapDashboardSummary(summaryQuery.data),
    [summaryQuery.data],
  );

  return {
    user,
    branch,
    metrics,
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    isFetching: summaryQuery.isFetching,
    refetch: () => {
      void summaryQuery.refetch();
    },
  };
}
