import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  productionTransferApi,
  type ProductionTaskBoard,
  type ProductionTaskStockShortage,
} from '../api';

interface ShortageDialogState {
  taskId: number;
  taskNo: string;
  shortages: ProductionTaskStockShortage[];
}

interface Options {
  transferId: number;
  run: (action: () => Promise<ProductionTaskBoard>) => Promise<void>;
}

export function useProductionTaskStart({ transferId, run }: Options) {
  const [shortageDialog, setShortageDialog] = useState<ShortageDialogState | null>(null);
  const [checkingTaskId, setCheckingTaskId] = useState<number>();

  const requestStart = useCallback(async (taskId: number, taskNo: string) => {
    setCheckingTaskId(taskId);
    try {
      const check = await productionTransferApi.checkTaskStart(transferId, taskId);
      if (check.shortages.length > 0) {
        setShortageDialog({ taskId, taskNo, shortages: check.shortages });
        return;
      }
      await run(() => productionTransferApi.startTask(transferId, taskId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stok kontrolü başarısız.');
    } finally {
      setCheckingTaskId(undefined);
    }
  }, [run, transferId]);

  const confirmPartialStart = useCallback(async () => {
    if (!shortageDialog) return;
    try {
      await run(() => productionTransferApi.startTask(transferId, shortageDialog.taskId, {
        allowPartialStart: true,
      }));
      setShortageDialog(null);
    } catch {
      // run() already surfaces toast errors.
    }
  }, [run, shortageDialog, transferId]);

  const cancelPartialStart = useCallback(() => {
    setShortageDialog(null);
  }, []);

  return {
    shortageDialog,
    checkingTaskId,
    requestStart,
    confirmPartialStart,
    cancelPartialStart,
  };
}
