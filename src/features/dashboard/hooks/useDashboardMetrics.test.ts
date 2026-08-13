import { describe, expect, it } from 'vitest';
import { mapDashboardSummary } from './useDashboardMetrics';
import type { DashboardSummary } from '../types/dashboard.types';

describe('mapDashboardSummary', () => {
  it('maps operational, inventory and system metrics without losing transfer activity', () => {
    const summary: DashboardSummary = {
      stockItemCount: 25,
      goodsReceiptOrderCount: 12,
      shipmentOrderCount: 9,
      pendingGoodsReceiptApprovalCount: 3,
      myAssignedTaskCount: 4,
      activeTransferOrderCount: 5,
      goodsReceiptTodayCount: 2,
      shipmentTodayCount: 1,
      transferTodayCount: 3,
      pendingQualityInspectionCount: 6,
      openOperationCount: 17,
      inventoryHealth: {
        availablePositionCount: 20,
        reservedPositionCount: 3,
        qualityHoldPositionCount: 1,
        unavailablePositionCount: 1,
      },
      dailyOperations: [
        { date: '2026-08-13', goodsReceiptCount: 2, shipmentCount: 1, transferCount: 3 },
      ],
      systemHealth: {
        generatedAtUtc: '2026-08-13T12:00:00Z',
        lastBalanceProjectionAtUtc: '2026-08-13T11:55:00Z',
        erpIssueCount: 2,
      },
      recentActivities: [
        {
          id: 'transfer-1',
          kind: 'transfer',
          title: 'DAT-0001',
          subtitle: 'Ana Depo → Üretim Deposu',
          timestamp: '2026-08-13T11:59:00Z',
          status: 'preparing',
        },
      ],
    };

    const metrics = mapDashboardSummary(summary);

    expect(metrics).toMatchObject({
      stockSkuCount: 25,
      goodsReceiptTodayCount: 2,
      shipmentTodayCount: 1,
      transferTodayCount: 3,
      pendingQualityInspectionCount: 6,
      openOperationCount: 17,
      inventoryHealth: summary.inventoryHealth,
      systemHealth: summary.systemHealth,
    });
    expect(metrics.dailyOperations).toEqual(summary.dailyOperations);
    expect(metrics.activityItems).toEqual([
      {
        id: 'transfer-1',
        kind: 'transfer',
        title: 'DAT-0001',
        subtitle: 'Ana Depo → Üretim Deposu',
        timestamp: '2026-08-13T11:59:00Z',
        statusKey: 'preparing',
      },
    ]);
  });

  it('returns safe empty collections when the API response is unavailable', () => {
    const metrics = mapDashboardSummary(undefined);

    expect(metrics.openOperationCount).toBe(0);
    expect(metrics.dailyOperations).toEqual([]);
    expect(metrics.activityItems).toEqual([]);
    expect(metrics.inventoryHealth.availablePositionCount).toBe(0);
  });
});
