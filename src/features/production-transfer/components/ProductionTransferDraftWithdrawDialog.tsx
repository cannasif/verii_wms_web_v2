import { useMemo, useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { transferApiFor } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import { productionTransferApi, type ProductionWorkOrderTransferHeaderRow } from '../api';
import { formatTaskAssignees } from '../production-transfer-task-chain';

type DraftWithdrawLine = {
  lineId: number;
  lineNo: number;
  stockCode: string;
  stockName?: string;
  quantity: number;
  assignedUsernames: string[];
  canWithdraw: boolean;
};

export function ProductionTransferDraftWithdrawDialog({
  row,
  onClose,
  onCompleted,
}: {
  row: ProductionWorkOrderTransferHeaderRow;
  onClose: () => void;
  onCompleted: () => void;
}): ReactElement {
  const transferApi = useMemo(() => transferApiFor('production'), []);
  const [selectedLineIds, setSelectedLineIds] = useState<ReadonlySet<number>>(new Set());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['production-transfer', 'draft-withdraw-detail', row.transferId],
    queryFn: () => transferApi.detail(row.transferId),
  });
  const boardQuery = useQuery({
    queryKey: ['production-transfer', 'draft-withdraw-board', row.transferId],
    queryFn: () => productionTransferApi.taskBoard(row.transferId),
  });

  const lines = useMemo<DraftWithdrawLine[]>(() => {
    const detail = detailQuery.data;
    if (!detail) return [];

    const assigneesByLineId = new Map<number, string[]>();
    for (const task of boardQuery.data?.tasks ?? []) {
      const usernames = task.assignments.map((assignment) => assignment.username);
      for (const taskLine of task.lines) {
        const current = assigneesByLineId.get(taskLine.transferLineId) ?? [];
        assigneesByLineId.set(
          taskLine.transferLineId,
          [...new Set([...current, ...usernames])],
        );
      }
    }

    return detail.lines.map((line) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      stockCode: line.stockCode,
      stockName: line.stockName,
      quantity: line.requestedQuantity,
      assignedUsernames: assigneesByLineId.get(line.id) ?? [],
      canWithdraw: line.pickedQuantity <= 0,
    }));
  }, [boardQuery.data?.tasks, detailQuery.data]);

  const selectableLineIds = useMemo(
    () => lines.filter((line) => line.canWithdraw).map((line) => line.lineId),
    [lines],
  );
  const selectedCount = [...selectedLineIds].filter((lineId) => selectableLineIds.includes(lineId)).length;
  const allSelected = selectableLineIds.length > 0 && selectedCount === selectableLineIds.length;

  const toggleLine = (lineId: number): void =>
    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });

  const toggleAll = (): void =>
    setSelectedLineIds(allSelected ? new Set() : new Set(selectableLineIds));

  const submit = async (): Promise<void> => {
    const transferLineIds = [...selectedLineIds].filter((lineId) => selectableLineIds.includes(lineId));
    if (transferLineIds.length === 0) {
      toast.error('Geri alınacak en az bir satır seçin.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await productionTransferApi.withdrawDraftLines(row.transferId, {
        transferLineIds,
        reason: reason.trim() || null,
      });
      const workOrderLabel = result.workOrderNumber ?? row.productionOrderNo ?? row.externalReferenceNo ?? 'iş emri';
      if (result.transferDeleted) {
        toast.success(
          `${result.withdrawnLineCount} satır ${workOrderLabel} iş emrine geri alındı; taslak transfer kapatıldı.`,
        );
      } else {
        toast.success(
          `${result.withdrawnLineCount} satır ${workOrderLabel} iş emrine geri alındı. Transferde ${result.remainingLineCount} satır kaldı.`,
        );
      }
      onCompleted();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stoklar geri alınamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const loading = detailQuery.isLoading || boardQuery.isLoading;
  const error = detailQuery.error ?? boardQuery.error;

  return (
    <ResponsiveDialog
      onClose={onClose}
      title="Atanan stokları geri al"
      description={`${row.documentNo} taslak transferinden seçilen satırlar iş emrine döner.`}
      className="!max-w-3xl"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Atanan stokları geri al</h2>
          <p className="mt-1 font-mono text-sm text-[var(--wms-app-text-muted)]">{row.documentNo}</p>
          {(row.productionOrderNo ?? row.externalReferenceNo) ? (
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              İş emri: {row.productionOrderNo ?? row.externalReferenceNo}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Pencereyi kapat"
          className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X />
        </button>
      </header>

      <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        Geri alınan satırlar kısmi transfer sonrası olduğu gibi ilgili iş emrinin Atanmayanlar listesine düşer.
        Toplanmış satırlar geri alınamaz.
      </p>

      {loading ? (
        <div className="mt-6">
          <OpsLoadingState message="Taslak satırları yükleniyor…" code="DRAFT-WITHDRAW" compact />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-rose-500">
          {error instanceof Error ? error.message : 'Taslak satırları yüklenemedi.'}
        </p>
      ) : lines.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--wms-app-text-muted)]">Geri alınabilecek satır bulunamadı.</p>
      ) : (
        <div className="mt-5 overflow-auto rounded-xl border border-[var(--wms-ops-card-border)]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--wms-ops-card-border)] bg-[var(--wms-ops-card-bg)]">
                <th className="w-12 p-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectableLineIds.length === 0}
                    onChange={toggleAll}
                    aria-label="Tüm satırları seç"
                  />
                </th>
                <th className="p-3 text-left">Stok</th>
                <th className="p-3 text-right">Miktar</th>
                <th className="p-3 text-left">Atananlar</th>
                <th className="p-3 text-left">Durum</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const selected = selectedLineIds.has(line.lineId);
                return (
                  <tr
                    key={line.lineId}
                    className={cn(
                      'border-b border-[var(--wms-ops-card-border)] last:border-b-0',
                      selected && 'bg-[var(--wms-brand-primary)]/5',
                    )}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!line.canWithdraw}
                        onChange={() => toggleLine(line.lineId)}
                        aria-label={`${line.stockCode} satırını seç`}
                      />
                    </td>
                    <td className="p-3">
                      <strong>{line.stockCode}</strong>
                      {line.stockName ? (
                        <div className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right font-bold">{formatProjectNumber(line.quantity)}</td>
                    <td className="p-3">{formatTaskAssignees(line.assignedUsernames)}</td>
                    <td className="p-3 text-xs">
                      {line.canWithdraw ? (
                        <span className="font-bold text-emerald-600">Geri alınabilir</span>
                      ) : (
                        <span className="font-bold text-rose-500">Toplanmış</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <label className="mt-4 block text-sm font-bold">
        Açıklama (isteğe bağlı)
        <textarea
          className="input mt-2 min-h-20 w-full"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Geri alma nedeni"
        />
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-bold">
          Vazgeç
        </button>
        <button
          type="button"
          disabled={submitting || selectedCount === 0}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
          Seçilenleri iş emrine geri al
        </button>
      </div>
    </ResponsiveDialog>
  );
}
