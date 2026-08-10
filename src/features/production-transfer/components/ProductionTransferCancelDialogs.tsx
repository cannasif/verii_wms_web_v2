import { useState, type ReactElement } from 'react';
import { AlertTriangle, Ban, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { formatProjectNumber } from '@/lib/project-format';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { LocationOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { productionTransferApi, type ProductionTransferPolicy } from '../api';
import type { ProductionCancellationReadiness } from '../production-transfer-cancellation';

export function ProductionTransferCancelBlockedDialog({
  documentNo,
  transferId,
  readiness,
  canAssign = false,
  onClose,
  onReturnTasksStarted,
}: {
  documentNo: string;
  transferId: number;
  readiness: ProductionCancellationReadiness;
  canAssign?: boolean;
  onClose: () => void;
  onReturnTasksStarted?: () => void | Promise<void>;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const canStartReturnTasks = canAssign
    && readiness.needsCancellationReturn
    && !readiness.unresolvedPickedStock;

  const startReturnTasks = async (): Promise<void> => {
    if (!canStartReturnTasks) return;
    setBusy(true);
    try {
      await productionTransferApi.requestCancellationReturn(transferId);
      toast.success('İptal iade görevi oluşturuldu. İade tamamlandığında kalan toplama işi Atanmayanlar sekmesinde görünür.');
      await onReturnTasksStarted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İptal iade görevi oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      onClose={onClose}
      title="Toplanmış stok var — iptal engellendi"
      description={`${documentNo} belgesinde fiziksel toplama yapılmış. İptalden önce stokların rafa iade edilmesi gerekir.`}
      className="!max-w-xl border-amber-500/30"
    >
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <strong className="block text-amber-700 dark:text-amber-300">Toplanmış {formatProjectNumber(readiness.pickedQuantity)} birim stok bulundu.</strong>
          <p className="mt-1 text-[var(--wms-app-text-muted)]">
            İptal edebilmek için tek bir <strong>iptal iade görevi</strong> başlatılmalı;
            iade tamamlandığında kalan toplama işi <strong>Atanmayanlar</strong> sekmesinde görünür.
          </p>
        </div>
      </div>

      {readiness.needsCancellationReturn && readiness.missingReturnTasks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Toplanan stok özeti</p>
          <ul className="mt-2 space-y-1 text-sm">
            {readiness.missingReturnTasks.map((picker) => (
              <li key={picker.userId} className="rounded-lg border border-[var(--wms-app-border)] px-3 py-2">
                <strong>{picker.username}</strong>
                <span className="ml-2 text-[var(--wms-app-text-muted)]">
                  · {formatProjectNumber(picker.processedQuantity)} birim topladı ({picker.pickTaskNo})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {readiness.unresolvedPickedStock && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-[var(--wms-app-text-muted)]">
          Transfer kaydında toplanmış stok görünüyor ancak hangi depo çalışanının topladığı netleşmedi.
          Önce ilgili iade görevlerini başlatıp tamamlayın.
        </div>
      )}

      {readiness.pendingReturns.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Tamamlanmayı bekleyen iade görevleri</p>
          <ul className="mt-2 space-y-1 text-sm">
            {readiness.pendingReturns.map((picker) => (
              <li key={picker.userId} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <strong>{picker.username}</strong>
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  · {picker.returnTask?.taskNo} ({picker.returnTask?.status})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 py-2 text-sm">Kapat</button>
        {canStartReturnTasks ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startReturnTasks()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
            İade görevini başlat
          </button>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

export function ProductionTransferCancelConfirmDialog({
  documentNo,
  transferId,
  sourceWarehouseId,
  policy,
  onClose,
  onCompleted,
}: {
  documentNo: string;
  transferId: number;
  sourceWarehouseId: number;
  policy?: ProductionTransferPolicy;
  onClose: () => void;
  onCompleted: () => void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [returnLocationValue, setReturnLocationValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    try {
      await productionTransferApi.cancel(
        transferId,
        reason,
        policy?.cancellationReturnPolicy === 'ManagerSelectionRequired' && returnLocationValue
          ? Number(returnLocationValue)
          : undefined,
      );
      toast.success('Transfer ve bağlı stok hareketleri güvenli biçimde iptal edildi.');
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İptal başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      onClose={onClose}
      title="Transferi iptal et"
      description={`${documentNo} için geri alınamaz iptal onayı.`}
      className="!max-w-lg border-rose-500/30"
    >
      <div className="flex items-start gap-3">
        <Ban className="mt-0.5 size-5 shrink-0 text-rose-500" />
        <p className="text-sm text-[var(--wms-app-text-muted)]">
          Toplanmamış rezervasyonlar çözülür. Toplanmış stoklar için iade süreci tamamlandıysa belge güvenli biçimde iptal edilir.
        </p>
      </div>
      <div className="mt-4 grid gap-3">
        {policy?.cancellationReturnPolicy === 'ManagerSelectionRequired' && (
          <PagedAppDropdown<LocationOption>
            queryKey={['production-cancel-return-location', transferId, sourceWarehouseId]}
            fetchPage={(request) => warehouseTransferApi.locations(request, sourceWarehouseId)}
            toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })}
            value={returnLocationValue}
            onValueChange={setReturnLocationValue}
            placeholder="İade rafını seçin"
            searchable
          />
        )}
        <textarea
          autoFocus
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="İptal nedeni (en az 5 karakter)"
          className="input h-auto py-3"
        />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 py-2 text-sm">Vazgeç</button>
        <button
          type="button"
          disabled={
            busy
            || reason.trim().length < 5
            || (policy?.cancellationReturnPolicy === 'ManagerSelectionRequired' && !returnLocationValue)
          }
          onClick={() => void submit()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          İptal Et
        </button>
      </div>
    </ResponsiveDialog>
  );
}
