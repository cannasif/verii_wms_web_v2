import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { formatProjectNumber } from '@/lib/project-format';
import type { ProductionTaskStockShortage } from '../api';

interface Props {
  taskNo: string;
  shortages: ProductionTaskStockShortage[];
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ProductionTaskStartShortageDialog({
  taskNo,
  shortages,
  busy = false,
  onConfirm,
  onCancel,
}: Props): ReactElement {
  return (
    <ResponsiveDialog
      onClose={onCancel}
      title="Eksik stok tespit edildi"
      description={`${taskNo} görevi için raflarda yeterli stok bulunamadı.`}
      className="!max-w-2xl border-amber-500/30"
    >
      <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-black/5 text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
            <tr>
              <th className="p-3">Stok</th>
              <th className="p-3 text-right">İstenen</th>
              <th className="p-3 text-right">Mevcut</th>
              <th className="p-3 text-right">Eksik</th>
            </tr>
          </thead>
          <tbody>
            {shortages.map((row) => (
              <tr key={row.taskLineId} className="border-t border-[var(--wms-app-border)]">
                <td className="p-3">
                  <strong>{row.stockCode}</strong>
                  {row.stockName && (
                    <div className="text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                  )}
                </td>
                <td className="p-3 text-right">{formatProjectNumber(row.requestedQuantity)}</td>
                <td className="p-3 text-right text-emerald-600">{formatProjectNumber(row.availableQuantity)}</td>
                <td className="p-3 text-right font-bold text-red-500">{formatProjectNumber(row.shortageQuantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-[var(--wms-app-text-muted)]">
        Eksik stok var, ön toplama yapmak ister misiniz? Onaylarsanız mevcut stok kadarı toplanabilir
        hale gelir; eksik kalan miktar stok geldikten sonra &quot;Rotayı güncelle&quot; ile tamamlanabilir.
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Hayır
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Evet, ön toplamaya başla
        </button>
      </div>
    </ResponsiveDialog>
  );
}
