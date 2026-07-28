export type DashboardActivityKind = 'goods-receipt' | 'shipment';
export type DashboardActivityStatus = 'completed' | 'preparing' | 'pending';

export interface DashboardSummaryActivity {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
  status: DashboardActivityStatus;
}

export interface DashboardSummary {
  stockItemCount: number;
  goodsReceiptOrderCount: number;
  shipmentOrderCount: number;
  pendingGoodsReceiptApprovalCount: number;
  myAssignedTaskCount: number;
  activeTransferOrderCount: number;
  recentActivities: DashboardSummaryActivity[];
}

export interface DashboardActivityItem {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  subtitle: string;
  timestamp: string;
  statusKey: DashboardActivityStatus;
}

export interface DashboardMetrics {
  stockSkuCount: number;
  goodsReceiptCount: number;
  pendingApprovalCount: number;
  shipmentCount: number;
  transferCount: number;
  myTasksCount: number;
  activityItems: DashboardActivityItem[];
}
