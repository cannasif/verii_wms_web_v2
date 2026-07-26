import { useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { CheckCircle2, Loader2, PackageCheck, ShieldAlert, Warehouse } from 'lucide-react';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { formatProjectNumber } from '@/lib/project-format';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import type {
  GoodsReceiptDetail,
  GoodsReceiptLifecycleResult,
  GoodsReceiptPutawayCandidate,
  LocationOption,
} from '../types/goods-receipt.types';

export type GoodsReceiptLifecycleAction = 'approve' | 'shortClose' | 'putaway' | 'cancel';

interface Props {
  action: GoodsReceiptLifecycleAction;
  detail: GoodsReceiptDetail;
  onClose: () => void;
  onCompleted: (result: GoodsReceiptLifecycleResult) => Promise<void>;
}

interface PutawayFormLine extends GoodsReceiptPutawayCandidate {
  selected: boolean;
  requestedQuantity: string;
  targetLocationId: string;
}

const actionContent: Record<GoodsReceiptLifecycleAction, {
  title: string;
  description: string;
  submit: string;
  icon: ReactElement;
  destructive?: boolean;
}> = {
  approve: {
    title: 'Mal Kabulü Onayla',
    description: 'Kayıt operasyon onayına alınır. Aynı istek güvenli biçimde yalnızca bir kez uygulanır.',
    submit: 'Onayla',
    icon: <CheckCircle2 className="size-5" />,
  },
  shortClose: {
    title: 'Eksik Miktarı Kısa Kapat',
    description: 'Seçilen açık miktarlar artık beklenmez. Raporlama için gerekçe zorunludur.',
    submit: 'Kısa Kapat',
    icon: <PackageCheck className="size-5" />,
  },
  putaway: {
    title: 'Rafa Yerleştir',
    description: 'Kabul alanındaki kullanılabilir stok seçilen rafa transfer edilir; raf ve depo bakiyeleri aynı işlemde güncellenir.',
    submit: 'Rafa Yerleştir',
    icon: <Warehouse className="size-5" />,
  },
  cancel: {
    title: 'Mal Kabulü İptal Et',
    description: 'Bağlı stok ve kalite hareketleri ters kayıtla geri alınır. Kullanılmış stok varsa sistem iptali güvenli biçimde engeller.',
    submit: 'İptal Et',
    icon: <ShieldAlert className="size-5" />,
    destructive: true,
  },
};

export function GoodsReceiptLifecycleDialog({ action, detail, onClose, onCompleted }: Props): ReactElement {
  const content = actionContent[action];
  const idempotencyKey = useRef(crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shortCloseLines = useMemo(() => detail.lines
    .map((line) => ({
      lineId: line.id,
      lineNo: line.lineNo,
      stockCode: line.stockCode,
      unitCode: line.unitCode,
      quantity: Math.max(0, line.expectedQuantity - line.receivedQuantity - line.shortClosedQuantity),
    }))
    .filter((line) => line.quantity > 0), [detail.lines]);
  const [putawayLines, setPutawayLines] = useState<PutawayFormLine[]>(() => detail.putawayCandidates.map((line) => ({
    ...line,
    selected: true,
    requestedQuantity: String(line.quantity),
    targetLocationId: line.defaultTargetLocationId ? String(line.defaultTargetLocationId) : '',
  })));

  const updatePutaway = (index: number, patch: Partial<PutawayFormLine>): void => {
    setPutawayLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...patch } : line));
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    if ((action === 'cancel' || action === 'shortClose') && !reason.trim()) {
      setError('Bu işlem için açıklayıcı bir gerekçe zorunludur.');
      return;
    }
    try {
      setBusy(true);
      let result: GoodsReceiptLifecycleResult;
      if (action === 'approve') {
        result = await goodsReceiptV2Api.approve(detail.header.id, {
          idempotencyKey: idempotencyKey.current,
          rowVersion: detail.header.rowVersion,
          reason: reason.trim() || undefined,
        });
      } else if (action === 'shortClose') {
        if (!shortCloseLines.length) throw new Error('Kısa kapatılabilecek açık miktar bulunmuyor.');
        result = await goodsReceiptV2Api.shortClose(detail.header.id, {
          idempotencyKey: idempotencyKey.current,
          rowVersion: detail.header.rowVersion,
          reason: reason.trim(),
          lines: shortCloseLines.map((line) => ({ lineId: line.lineId, quantity: line.quantity })),
        });
      } else if (action === 'putaway') {
        const selected = putawayLines.filter((line) => line.selected);
        if (!selected.length) throw new Error('En az bir stok boyutu seçmelisiniz.');
        const invalid = selected.find((line) => {
          const quantity = Number(line.requestedQuantity);
          return !line.targetLocationId || !Number.isFinite(quantity) || quantity <= 0 || quantity > line.quantity;
        });
        if (invalid) throw new Error(`${invalid.stockCode} için miktar ve hedef raf bilgisini kontrol edin.`);
        result = await goodsReceiptV2Api.putaway(detail.header.id, {
          idempotencyKey: idempotencyKey.current,
          rowVersion: detail.header.rowVersion,
          reason: reason.trim() || undefined,
          occurredAtUtc: new Date().toISOString(),
          lines: selected.map((line) => ({
            lineId: line.lineId,
            quantity: Number(line.requestedQuantity),
            sourceLocationId: line.sourceLocationId,
            targetLocationId: Number(line.targetLocationId),
            lotNo: line.lotNo,
            serialNo: line.serialNo,
          })),
        });
      } else {
        result = await goodsReceiptV2Api.cancel(detail.header.id, {
          idempotencyKey: idempotencyKey.current,
          rowVersion: detail.header.rowVersion,
          reason: reason.trim(),
        });
      }
      await onCompleted(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog onClose={onClose} title={content.title} description={`${detail.header.documentNo} · ${content.description}`} className="!max-w-5xl">
      <form onSubmit={(event) => void submit(event)}>
        <header className="flex items-start gap-3">
          <span className={content.destructive ? 'rounded-xl bg-rose-500/15 p-2.5 text-rose-500' : 'rounded-xl bg-cyan-500/15 p-2.5 text-cyan-500'}>{content.icon}</span>
          <div>
            <h2 className="text-xl font-bold">{content.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{detail.header.documentNo} · {content.description}</p>
          </div>
        </header>

        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-500">{error}</div>}

        {action === 'shortClose' && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">Kalem</th><th className="p-3">Stok</th><th className="p-3 text-right">Kapatılacak Miktar</th></tr></thead>
              <tbody>{shortCloseLines.map((line) => <tr key={line.lineId} className="border-t border-[var(--wms-app-border)]"><td className="p-3">{line.lineNo}</td><td className="p-3 font-semibold">{line.stockCode}</td><td className="p-3 text-right">{formatProjectNumber(line.quantity)} {line.unitCode}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {action === 'putaway' && (
          <div className="mt-5 space-y-3">
            {!putawayLines.length && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600">Kabul alanında rafa yerleştirilebilecek kullanılabilir stok bulunamadı.</div>}
            {putawayLines.map((line, index) => (
              <section key={`${line.lineId}:${line.sourceLocationId}:${line.lotNo ?? ''}:${line.serialNo ?? ''}`} className="grid items-end gap-3 rounded-xl border border-[var(--wms-app-border)] p-4 md:grid-cols-[auto_1.4fr_.7fr_1.5fr]">
                <label className="flex h-11 items-center"><input type="checkbox" checked={line.selected} onChange={(event) => updatePutaway(index, { selected: event.target.checked })} aria-label={`${line.stockCode} seç`} /></label>
                <div><span className="text-xs text-slate-500">Stok / Lot / Seri</span><strong className="block">{line.stockCode} {line.yapCode && `· ${line.yapCode}`}</strong><small className="text-slate-500">{line.lotNo || 'Lot yok'} · {line.serialNo || 'Seri yok'} · Kaynak raf #{line.sourceLocationId}</small></div>
                <label className="space-y-1 text-sm"><span className="font-semibold">Miktar</span><input disabled={!line.selected} type="number" min="0.000001" max={line.quantity} step="0.000001" value={line.requestedQuantity} onChange={(event) => updatePutaway(index, { requestedQuantity: event.target.value })} className="input" /></label>
                <label className="space-y-1 text-sm"><span className="font-semibold">Hedef raf</span><PagedAppDropdown<LocationOption> disabled={!line.selected} enabled={line.selected} value={line.targetLocationId} onValueChange={(value) => updatePutaway(index, { targetLocationId: value })} queryKey={['gr-putaway-locations', line.warehouseId]} dependencies={[line.warehouseId]} fetchPage={(request) => goodsReceiptV2Api.locations(request, line.warehouseId)} toOption={(item) => ({ value: String(item.id), label: `${item.code} - ${item.name}`, description: item.locationType })} selectedOption={line.defaultTargetLocationId ? { value: String(line.defaultTargetLocationId), label: `Önerilen raf #${line.defaultTargetLocationId}` } : undefined} placeholder="Hedef raf seçin" searchable minSearchLength={1} /></label>
              </section>
            ))}
          </div>
        )}

        <label className="mt-5 block space-y-1 text-sm">
          <span className="font-semibold">{action === 'cancel' || action === 'shortClose' ? 'Gerekçe *' : 'Açıklama'}</span>
          <textarea autoFocus={action !== 'putaway'} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="input h-auto py-3" placeholder="Operasyon notunu yazın..." />
        </label>

        <footer className="mt-6 flex flex-col-reverse gap-2 border-t border-[var(--wms-app-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border px-4 py-2 disabled:opacity-50">Vazgeç</button>
          <button type="submit" disabled={busy || (action === 'putaway' && !putawayLines.length)} className={content.destructive ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2 font-semibold text-white disabled:opacity-40' : 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 font-semibold text-white disabled:opacity-40'}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : content.icon}{content.submit}
          </button>
        </footer>
      </form>
    </ResponsiveDialog>
  );
}
