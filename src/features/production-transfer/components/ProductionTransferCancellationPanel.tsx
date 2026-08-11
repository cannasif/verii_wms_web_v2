import { useState, type ReactElement } from 'react';
import { Ban, RotateCcw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { formatProjectNumber } from '@/lib/project-format';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { LocationOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import {
  productionTransferApi,
  type ProductionTaskBoard,
  type ProductionTransferPolicy,
} from '../api';
import type { ProductionCancellationReadiness } from '../production-transfer-cancellation';

interface Props {
  transferId: number;
  transferStatus: string;
  sourceWarehouseId: number;
  readiness: ProductionCancellationReadiness;
  policy?: ProductionTransferPolicy;
  canCancel: boolean;
  canAssign: boolean;
  busy: boolean;
  onRun: (action: () => Promise<ProductionTaskBoard>) => void;
  onCancelled: () => void;
}

export function ProductionTransferCancellationPanel({
  transferId,
  transferStatus,
  sourceWarehouseId,
  readiness,
  policy,
  canCancel,
  canAssign,
  busy,
  onRun,
  onCancelled,
}: Props): ReactElement | null {
  const [returnLocationValue, setReturnLocationValue] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  if (!canCancel || ['Cancelled', 'Completed'].includes(transferStatus)) return null;

  const applyCancel = async () => {
    if (!readiness.canCancel) {
      toast.error('Toplanmış stoklar için iptal iade görevleri tamamlanmadan transfer iptal edilemez.');
      return;
    }
    if (cancelReason.trim().length < 5) {
      toast.error('İptal nedeni en az 5 karakter olmalıdır.');
      return;
    }
    try {
      await productionTransferApi.cancel(
        transferId,
        cancelReason,
        policy?.cancellationReturnPolicy === 'ManagerSelectionRequired' && returnLocationValue
          ? Number(returnLocationValue)
          : undefined,
      );
      toast.success('Transfer ve bağlı stok hareketleri güvenli biçimde iptal edildi.');
      setCancelReason('');
      setReturnLocationValue(null);
      onCancelled();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İptal başarısız.');
    }
  };

  return (
    <>
      {readiness.hasPickedStock && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 font-black text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4" />
            İptal öncesi stok iadesi
          </h3>
          <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
            Bu transferde toplanmış {formatProjectNumber(readiness.pickedQuantity)} birim stok var.
            İptal edebilmek için tek bir <strong>iptal iade görevi</strong> başlatılmalı;
            iade tamamlandığında toplanmamış kalan malzeme <strong>iş emrinin Atanmayanlar</strong> havuzuna geri döner.
          </p>
          {readiness.unresolvedPickedStock && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Toplanmış stok kayıtlı; toplayan depo çalışanı netleşmediği için önce iade görevleri oluşturulmalıdır.
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {readiness.pickers.map((picker) => (
              <li
                key={picker.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--wms-app-border)] px-3 py-2"
              >
                <div>
                  <strong>{picker.username}</strong>
                  <span className="ml-2 text-[var(--wms-app-text-muted)]">
                    {formatProjectNumber(picker.processedQuantity)} birim · {picker.pickTaskNo}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {readiness.needsCancellationReturn && canAssign && (
            <button
              type="button"
              disabled={busy}
              title="İptal iade görevi oluştur"
              onClick={() => void onRun(() => productionTransferApi.requestCancellationReturn(transferId))}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-600"
            >
              <RotateCcw className="size-3.5" />
              İade görevini başlat
            </button>
          )}
          {readiness.cancellationReturnTask && readiness.cancellationReturnTask.status !== 'Completed' && (
            <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {readiness.cancellationReturnTask.taskNo} iptal iade görevi tamamlanana kadar transfer iptal edilemez.
            </p>
          )}
          {!readiness.canCancel && !readiness.needsCancellationReturn && (
            <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
              İptal iade görevi tamamlanana kadar transfer iptal edilemez.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="flex items-center gap-2 font-black text-red-500">
          <Ban className="size-4" />
          Transferi iptal et
        </h3>
        <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
          Toplanmamış rezervasyonlar çözülür. Toplanmış stok varsa önce yukarıdaki iade görevleri tamamlanmalıdır.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {policy?.cancellationReturnPolicy === 'ManagerSelectionRequired' && (
            <PagedAppDropdown<LocationOption>
              queryKey={['production-cancel-return-location', transferId, sourceWarehouseId]}
              fetchPage={(request) => warehouseTransferApi.locations(request, sourceWarehouseId)}
              toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })}
              value={returnLocationValue}
              onValueChange={setReturnLocationValue}
              placeholder="İade rafını seçin"
              searchable
              disabled={!readiness.canCancel}
            />
          )}
          <input
            className="input lg:col-span-2"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="İptal nedeni (en az 5 karakter)"
            disabled={!readiness.canCancel}
          />
          <button
            type="button"
            disabled={
              busy
              || !readiness.canCancel
              || cancelReason.trim().length < 5
              || (policy?.cancellationReturnPolicy === 'ManagerSelectionRequired' && !returnLocationValue)
            }
            onClick={() => void applyCancel()}
            className="rounded-lg border border-red-500 px-4 py-2 text-sm font-bold text-red-500 disabled:opacity-50"
          >
            İptali uygula
          </button>
        </div>
      </div>
    </>
  );
}
