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
    activityItems,
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

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', user?.id ?? null, branch?.code ?? null],
    queryFn: ({ signal }) => dashboardApi.getSummary({ signal }),
    staleTime: 60_000,
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
  };
}
