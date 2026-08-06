import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import type { WarehouseTransferGridRow } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';
import type { ProductionTransferPolicy } from '../api';
import { loadProductionCancellationContext } from '../production-transfer-cancellation-loader';
import type { ProductionCancellationReadiness } from '../production-transfer-cancellation';

export function useProductionTransferListCancel() {
  const branchCode = useAuthStore((x) => x.branch?.code ?? '0');
  const [precheckId, setPrecheckId] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<{
    row: WarehouseTransferGridRow;
    readiness: ProductionCancellationReadiness;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    row: WarehouseTransferGridRow;
    sourceWarehouseId: number;
    policy?: ProductionTransferPolicy;
  } | null>(null);

  const beginCancel = useCallback(async (row: WarehouseTransferGridRow) => {
    setPrecheckId(row.id);
    try {
      const context = await loadProductionCancellationContext(row, branchCode);
      if (!context.readiness.canCancel) {
        setBlocked({ row, readiness: context.readiness });
        return;
      }
      setConfirm({
        row,
        sourceWarehouseId: context.sourceWarehouseId,
        policy: context.policy,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İptal ön kontrolü yapılamadı.');
    } finally {
      setPrecheckId(null);
    }
  }, [branchCode]);

  return {
    precheckId,
    blocked,
    confirm,
    beginCancel,
    closeBlocked: () => setBlocked(null),
    closeConfirm: () => setConfirm(null),
  };
}
