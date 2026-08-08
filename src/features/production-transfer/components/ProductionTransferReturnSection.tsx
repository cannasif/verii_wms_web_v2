import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleCheck, Loader2, PackageCheck, Play } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { formatProjectNumber } from '@/lib/project-format';
import { useAuthStore } from '@/stores/auth-store';
import {
  productionTransferApi,
  type ProductionTask,
  type ProductionTaskBoard,
  type ProductionTaskLine,
} from '../api';
import { productionTaskTypeLabel } from '../production-transfer-task-labels';
import { useProductionTaskStart } from '../hooks/useProductionTaskStart';

interface Props {
  transferId: number;
  documentNo: string;
  onBoardChange?: (board: ProductionTaskBoard) => void;
}

function isReturnLineConfirmed(line: ProductionTaskLine): boolean {
  return line.processedQuantity >= line.requestedQuantity;
}

function returnShelfLabel(line: ProductionTaskLine): string {
  return line.targetLocationCode || line.sourceLocationCode || '—';
}

function ReturnLineSummary({ line }: { line: ProductionTaskLine }) {
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-xs text-[var(--wms-app-text-muted)]">Raf</span>
          <strong className="block">{returnShelfLabel(line)}</strong>
        </div>
        <div>
          <span className="text-xs text-[var(--wms-app-text-muted)]">Miktar</span>
          <strong className="block">{formatProjectNumber(line.requestedQuantity)}</strong>
        </div>
        <div className="sm:col-span-2">
          <StockIdentityCell
            stockCode={line.stockCode}
            stockName={line.stockName}
            layout="stacked"
          />
        </div>
        {line.serialNo ? (
          <div>
            <span className="text-xs text-[var(--wms-app-text-muted)]">Seri</span>
            <strong className="block">{line.serialNo}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductionTransferReturnSection({ transferId, documentNo, onBoardChange }: Props) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [board, setBoard] = useState<ProductionTaskBoard>();
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmLine, setConfirmLine] = useState<ProductionTaskLine | null>(null);

  const load = useCallback(async () => {
    try {
      const nextBoard = await productionTransferApi.taskBoard(transferId);
      setBoard(nextBoard);
      setLoadError(undefined);
      onBoardChange?.(nextBoard);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'İade görevi yüklenemedi.');
    }
  }, [onBoardChange, transferId]);

  useEffect(() => { void load(); }, [load]);

  const returnTask = useMemo(() => {
    if (!board || !currentUserId) return undefined;
    return board.tasks.find((task) =>
      (task.taskType === 'AssignmentReturn' || task.taskType === 'CancellationReturn')
      && task.assignments.some((assignment) => assignment.userId === currentUserId)
      && !['Completed', 'Cancelled'].includes(task.status));
  }, [board, currentUserId]);

  const runBoardAction = useCallback(async (action: () => Promise<ProductionTaskBoard>) => {
    setBusy(true);
    try {
      const nextBoard = await action();
      setBoard(nextBoard);
      onBoardChange?.(nextBoard);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }, [load, onBoardChange]);

  const {
    checkingTaskId,
    requestStart,
  } = useProductionTaskStart({ transferId, run: runBoardAction });

  const allLinesConfirmed = useMemo(
    () => Boolean(returnTask && returnTask.lines.length > 0 && returnTask.lines.every(isReturnLineConfirmed)),
    [returnTask],
  );

  const confirmReturnLine = async (line: ProductionTaskLine) => {
    if (!returnTask) return;
    setBusy(true);
    try {
      const nextBoard = await productionTransferApi.processReturnTaskLine(
        transferId,
        returnTask.taskId,
        line.taskLineId,
      );
      setBoard(nextBoard);
      onBoardChange?.(nextBoard);
      setConfirmLine(null);
      toast.success(`${line.stockCode} rafa yerleştirildi.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İade satırı onaylanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const completeReturn = async (task: ProductionTask) => {
    setBusy(true);
    try {
      const nextBoard = task.taskType === 'AssignmentReturn'
        ? await productionTransferApi.completeAssignmentReturn(transferId, task.taskId)
        : await productionTransferApi.completeCancellationReturn(transferId, task.taskId);
      setBoard(nextBoard);
      onBoardChange?.(nextBoard);
      toast.success(task.taskType === 'AssignmentReturn'
        ? 'İade tamamlandı, atama kaldırıldı.'
        : 'İptal iadesi tamamlandı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İade tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="wms-ops-form-card p-5">
        <p className="font-bold text-red-500">{loadError}</p>
        <button type="button" className="mt-3 text-sm font-bold text-[var(--wms-brand-primary)]" onClick={() => void load()}>
          Tekrar dene
        </button>
      </section>
    );
  }

  if (!board || !returnTask) return null;

  const canStart = returnTask.assignments.some((assignment) => assignment.userId === currentUserId)
    && !['InProgress', 'PartiallyCompleted', 'Completed', 'Cancelled'].includes(returnTask.status);
  const isActive = returnTask.status === 'InProgress' && returnTask.startedBy === currentUserId;

  return (
    <section className="space-y-4">
      <div className="wms-ops-form-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--wms-app-text-muted)]">
              {productionTaskTypeLabel(returnTask.taskType)}
            </p>
            <h2 className="mt-1 text-xl font-black">{documentNo}</h2>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              {returnTask.taskNo} · Ürünleri özgün rafa geri yerleştirin
            </p>
          </div>
          {canStart ? (
            <button
              type="button"
              disabled={busy || checkingTaskId === returnTask.taskId}
              onClick={() => void requestStart(returnTask.taskId, returnTask.taskNo)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
            >
              {checkingTaskId === returnTask.taskId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Bu işi yapıyorum
            </button>
          ) : null}
        </div>

        {isActive ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-black/5 text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
                  <tr>
                    <th className="p-3 text-left">Raf</th>
                    <th className="p-3 text-left">Stok</th>
                    <th className="p-3 text-left">Seri</th>
                    <th className="p-3 text-right">Miktar</th>
                    <th className="p-3 text-center">Onay</th>
                  </tr>
                </thead>
                <tbody>
                  {returnTask.lines.map((line) => {
                    const confirmed = isReturnLineConfirmed(line);
                    return (
                      <tr key={line.taskLineId} className="border-t border-[var(--wms-app-border)]">
                        <td className="p-3">{returnShelfLabel(line)}</td>
                        <td className="p-3">
                          <StockIdentityCell stockCode={line.stockCode} stockName={line.stockName} layout="stacked" />
                        </td>
                        <td className="p-3">{line.serialNo || '—'}</td>
                        <td className="p-3 text-right">{formatProjectNumber(line.requestedQuantity)}</td>
                        <td className="p-3 text-center">
                          {confirmed ? (
                            <CheckCircle2 className="mx-auto size-5 text-emerald-500" aria-label="Onaylandı" />
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              title="Rafa yerleştirmeyi onayla"
                              onClick={() => setConfirmLine(line)}
                              className="mx-auto inline-flex size-9 items-center justify-center rounded-lg border border-[var(--wms-app-border)] hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-40"
                            >
                              <CircleCheck className="size-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end">
              <OpsActionButton
                variant="primary"
                loading={busy}
                disabled={!allLinesConfirmed}
                onClick={() => void completeReturn(returnTask)}
              >
                <PackageCheck className="size-4" />
                İadeyi tamamladım, tüm ürünleri yerine yerleştirdim
              </OpsActionButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--wms-app-text-muted)]">
            İade işlemine başlamak için &quot;Bu işi yapıyorum&quot; butonunu kullanın.
          </p>
        )}
      </div>

      {confirmLine ? (
        <ResponsiveDialog
          onClose={() => setConfirmLine(null)}
          title="Rafa yerleştirmeyi onayla"
          description="Bilgileri kontrol edin; onayladığınızda stok hareketi kaydedilir."
        >
          <ReturnLineSummary line={confirmLine} />
          <p className="mt-4 text-sm font-semibold">Rafa geri yerleştirmeyi onaylıyor musunuz?</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              onClick={() => setConfirmLine(null)}
            >
              İptal
            </button>
            <OpsActionButton variant="primary" loading={busy} onClick={() => void confirmReturnLine(confirmLine)}>
              Onayla
            </OpsActionButton>
          </div>
        </ResponsiveDialog>
      ) : null}
    </section>
  );
}
