import { useEffect, useState, type ReactElement } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import type { ErpPostingResult, GoodsReceiptGridRow } from '../types/goods-receipt.types';

export function GoodsReceiptErpRetryDialog({
  header,
  close,
  completed,
}: {
  header: GoodsReceiptGridRow;
  close: () => void;
  completed: (result: ErpPostingResult) => Promise<void>;
}): ReactElement {
  const [posting, setPosting] = useState<ErpPostingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmedNotFound, setConfirmedNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    goodsReceiptV2Api.erpPosting(header.id)
      .then((value) => {
        if (active) setPosting(value);
      })
      .catch((error) => {
        if (active && header.erpIntegrationStatus !== 'Pending') {
          toast.error(message(error, 'ERP gönderim kaydı alınamadı.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [header.erpIntegrationStatus, header.id]);

  const uncertain = posting?.status === 'CommitUncertain'
    || header.erpIntegrationStatus === 'CommitUncertain';
  const canSubmit = !loading
    && !working
    && (!uncertain || (confirmedNotFound && reason.trim().length >= 5));
  const submitLabel = uncertain
    ? 'Mutabakatı kaydet ve yeniden gönder'
    : posting?.status === 'Failed'
      ? 'ERP’ye yeniden gönder'
      : 'ERP’ye gönder';

  const retry = async () => {
    if (!canSubmit) return;
    setWorking(true);
    try {
      if (uncertain) {
        await goodsReceiptV2Api.reconcileErpNotFound(header.id, reason.trim());
      }
      const result = await goodsReceiptV2Api.postErp(header.id);
      if (result.status === 'Succeeded') {
        toast.success(`Netsis irsaliyesi oluşturuldu: ${result.erpDocumentNo || result.sourceDocumentNo}`);
      } else if (result.status === 'CommitUncertain') {
        toast.warning('Netsis yanıtı yine kesinleşmedi. Mükerrer belgeyi önlemek için tekrar gönderim durduruldu.');
      } else {
        toast.error(result.errorMessage || 'ERP gönderimi tamamlanamadı.');
      }
      await completed(result);
    } catch (error) {
      toast.error(message(error, 'ERP gönderimi yeniden başlatılamadı.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !working) close(); }}>
      <DialogContent className="max-w-xl">
        <DialogTitle>ERP aktarımını yeniden gönder</DialogTitle>
        <DialogDescription>
          {header.documentNo} numaralı mal kabul Netsis alış irsaliyesine yeniden gönderilecektir.
        </DialogDescription>

        {loading ? (
          <div className="grid min-h-28 place-items-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--wms-app-border)] p-4 text-sm">
              <div><strong>Yerel durum:</strong> {header.erpIntegrationStatus}</div>
              <div><strong>Gönderim durumu:</strong> {posting?.status || 'Kayıt bulunamadı'}</div>
              <div><strong>Deneme:</strong> {posting?.attemptCount ?? 0}</div>
              {posting?.errorMessage ? <div className="mt-2 text-rose-600">{posting.errorMessage}</div> : null}
            </div>

            {uncertain ? (
              <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="flex gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Önceki isteğin sonucu belirsizdir. Netsis’te <strong>{header.documentNo}</strong>
                    {' '}ve <strong>{header.waybillNo || 'irsaliye numarası'}</strong> ile arama yapmadan yeniden göndermeyin.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={confirmedNotFound}
                    onChange={(event) => setConfirmedNotFound(event.target.checked)}
                  />
                  <span>Netsis’te belgeyi kontrol ettim ve bulunmadığını doğruladım.</span>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">Mutabakat açıklaması</span>
                  <textarea
                    className="input min-h-24 w-full resize-y"
                    value={reason}
                    maxLength={1000}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Örn. Netsis TBLFATUIRS ve irsaliye numarası üzerinden kontrol edildi; belge bulunamadı."
                  />
                  <span className="text-xs text-slate-500">En az 5 karakter; denetim kaydına yazılır.</span>
                </label>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2" disabled={working} onClick={close}>
                Vazgeç
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                disabled={!canSubmit}
                onClick={() => void retry()}
              >
                {working ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {submitLabel}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
