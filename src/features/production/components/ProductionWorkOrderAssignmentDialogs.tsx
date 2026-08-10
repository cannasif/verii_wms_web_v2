import { useState, type ReactElement } from 'react';
import { Ban, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { productionApi } from '../api';
import type { ProductionSourceWorkOrder } from '../types';

export function ProductionWorkOrderAssignmentCancelDialog({
  row,
  onClose,
  onCompleted,
}: {
  row: ProductionSourceWorkOrder;
  onClose: () => void;
  onCompleted: () => void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const isCancellationReturnRemainder = row.listingKind === 'CancellationReturnRemainder';

  const submit = async (): Promise<void> => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    try {
      const result = await productionApi.cancelWorkOrderAssignment({
        idempotencyKey: crypto.randomUUID(),
        workOrderNumber: row.workOrderNumber,
        sourceType: row.sourceType,
        sourceSystemCode: row.sourceSystemCode,
        reason: reason.trim(),
        transferId: row.transferId ?? null,
      });
      toast.success(
        result.cancellationId > 0
          ? isCancellationReturnRemainder
            ? `${row.workOrderNumber} iptal kalanı ataması iptal edildi.`
            : `${row.workOrderNumber} iş emri ataması iptal edildi. Kayıt İptal Edilen sekmesinde görünür.`
          : `${row.workOrderNumber} taslak ataması geri alındı. Malzemeler Atanmayanlar sekmesinde görünür.`,
      );
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İş emri iptali başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      onClose={onClose}
      title={isCancellationReturnRemainder ? 'İptal kalanını iptal et' : 'İş emri atamasını iptal et'}
      description={
        isCancellationReturnRemainder
          ? `${row.workOrderNumber} · İptal iadesi sonrası kalan toplama ataması iptal edilir.`
          : `${row.workOrderNumber} · Atanmayan malzemeler iptal edilir; açık transferler geri çekilir veya iptal edilir.`
      }
      className="!max-w-lg border-rose-500/30"
    >
      <div className="flex items-start gap-3">
        <Ban className="mt-0.5 size-5 shrink-0 text-rose-500" />
        <p className="text-sm text-[var(--wms-app-text-muted)]">
          Toplanmış stok varsa önce iptal iadesini tamamlayın. Kısmi iptal desteklenir; aynı iş emrine tekrar iptal yapılırsa miktarlar birleştirilir.
        </p>
      </div>
      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
        İptal nedeni
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-2 text-sm"
          placeholder="En az 5 karakter"
        />
      </label>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 py-2 text-sm">Vazgeç</button>
        <button
          type="button"
          disabled={busy || reason.trim().length < 5}
          onClick={() => void submit()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" aria-hidden />}
          İptal et
        </button>
      </div>
    </ResponsiveDialog>
  );
}

export function ProductionWorkOrderAssignmentRestoreDialog({
  row,
  onClose,
  onCompleted,
}: {
  row: ProductionSourceWorkOrder;
  onClose: () => void;
  onCompleted: () => void;
}): ReactElement {
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    try {
      await productionApi.restoreWorkOrderAssignment({
        idempotencyKey: crypto.randomUUID(),
        workOrderNumber: row.workOrderNumber,
      });
      toast.success(`${row.workOrderNumber} iş emri Atanmayanlar sekmesine geri getirildi.`);
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Geri getirme başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      onClose={onClose}
      title="İş emrini geri getir"
      description={`${row.workOrderNumber} · İptal edilen malzemeler tekrar Atanmayanlar kuyruğuna döner.`}
      className="!max-w-lg border-emerald-500/30"
    >
      <div className="flex items-start gap-3">
        <RotateCcw className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        <p className="text-sm text-[var(--wms-app-text-muted)]">
          Tam geri getirme yapılır. Aynı iş emri zaten Atanmayanlar’da varsa satırlar birleşir; çift kayıt oluşmaz.
        </p>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-4 py-2 text-sm">Vazgeç</button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
          Geri getir
        </button>
      </div>
    </ResponsiveDialog>
  );
}
