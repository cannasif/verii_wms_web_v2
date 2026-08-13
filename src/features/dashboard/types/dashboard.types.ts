export type DashboardActivityKind = 'goods-receipt' | 'shipment' | 'transfer';
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
  goodsReceiptTodayCount: number;
  shipmentTodayCount: number;
  transferTodayCount: number;
  pendingQualityInspectionCount: number;
  openOperationCount: number;
  inventoryHealth: DashboardInventoryHealth;
  dailyOperations: DashboardDailyOperationPoint[];
  systemHealth: DashboardSystemHealth;
  recentActivities: DashboardSummaryActivity[];
}

export interface DashboardDailyOperationPoint {
  date: string;
  goodsReceiptCount: number;
  shipmentCount: number;
  transferCount: number;
}

export interface DashboardInventoryHealth {
  availablePositionCount: number;
  reservedPositionCount: number;
  qualityHoldPositionCount: number;
  unavailablePositionCount: number;
}

export interface DashboardSystemHealth {
  generatedAtUtc: string;
  lastBalanceProjectionAtUtc: string | null;
  erpIssueCount: number;
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
  goodsReceiptTodayCount: number;
  shipmentTodayCount: number;
  transferTodayCount: number;
  pendingQualityInspectionCount: number;
  openOperationCount: number;
  inventoryHealth: DashboardInventoryHealth;
  dailyOperations: DashboardDailyOperationPoint[];
  systemHealth: DashboardSystemHealth;
  activityItems: DashboardActivityItem[];
}
