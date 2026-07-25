import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ArrowRightLeft, Loader2, PackageMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatProjectNumber } from '@/lib/project-format';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import type {
  CustomerOption,
  GoodsReceiptDetail,
  GoodsReceiptRoutingResult,
  LocationOption,
  SeriesOption,
  WarehouseOption,
} from '../types/goods-receipt.types';

type RouteKind = 'transfer' | 'outbound';
interface LineDraft { lineId: number; quantity: number; sourceLocationId?: number; sourceLocationValue?: string | null }

export function GoodsReceiptRoutingDialog({
  detail,
  initialKind,
  onClose,
  onCompleted,
}: {
  detail: GoodsReceiptDetail;
  initialKind: RouteKind;
  onClose: () => void;
  onCompleted: (result: GoodsReceiptRoutingResult) => Promise<void>;
}): ReactElement {
  const [kind, setKind] = useState<RouteKind>(initialKind);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>();
  const [targetWarehouseValue, setTargetWarehouseValue] = useState<string | null>(null);
  const [targetLocationId, setTargetLocationId] = useState<number>();
  const [targetLocationValue, setTargetLocationValue] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number>();
  const [customerValue, setCustomerValue] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    detail.lines.map((line) => ({
      lineId: line.id,
      quantity: 0,
      sourceLocationId: line.defaultPutawayLocationId ?? line.defaultReceivingLocationId,
      sourceLocationValue: line.defaultPutawayLocationId || line.defaultReceivingLocationId
        ? String(line.defaultPutawayLocationId ?? line.defaultReceivingLocationId)
        : null,
    })));

  const qualityReady = detail.header.qualityStatus === 'NotRequired' || detail.header.qualityStatus === 'Passed';
  const approvalReady = detail.header.approvalStatus === 'NotRequired' || detail.header.approvalStatus === 'Approved';
  const routableLines = useMemo(() => detail.lines.filter((line) => line.routableQuantity > 0), [detail.lines]);
  const total = lines.reduce((sum, line) => sum + (line.quantity > 0 ? line.quantity : 0), 0);

  useEffect(() => {
    setSeries([]);
    setSeriesId('');
    const load = kind === 'transfer' ? goodsReceiptV2Api.transferSeries : goodsReceiptV2Api.outboundSeries;
    void load(detail.header.targetWarehouseId)
      .then((items) => {
        setSeries(items);
        const preferred = items.find((item) => item.isDefault) ?? items[0];
        setSeriesId(preferred ? String(preferred.id) : '');
      })
      .catch((error: Error) => toast.error(error.message));
  }, [detail.header.targetWarehouseId, kind]);

  const patchLine = (lineId: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...patch } : line));

  const submit = async () => {
    if (!qualityReady) return toast.error('Kalite/GKK kararı tamamlanmadan yönlendirme yapılamaz.');
    if (!approvalReady) return toast.error('Mal kabul onayı tamamlanmadan yönlendirme yapılamaz.');
    if (!seriesId) return toast.error('Belge serisi seçmelisiniz.');
    const selected = lines.filter((line) => line.quantity > 0);
    if (!selected.length) return toast.error('En az bir kalem için miktar girmelisiniz.');
    for (const selectedLine of selected) {
      const source = detail.lines.find((line) => line.id === selectedLine.lineId)!;
      if (selectedLine.quantity > source.routableQuantity)
        return toast.error(`${source.stockCode} için en fazla ${formatProjectNumber(source.routableQuantity)} yönlendirilebilir.`);
    }
    if (kind === 'transfer' && !targetWarehouseId) return toast.error('Hedef depo seçmelisiniz.');
    if (kind === 'transfer' && targetWarehouseId === detail.header.targetWarehouseId) return toast.error('Kaynak ve hedef depo aynı olamaz.');
    if (kind === 'outbound' && !customerId) return toast.error('Ambar çıkış carisi seçmelisiniz.');

    setSaving(true);
    try {
      const common = {
        idempotencyKey: crypto.randomUUID(),
        documentSeriesId: Number(seriesId),
        priority: detail.header.priority || 3,
        description: description.trim() || null,
        lines: selected.map((line) => ({
          goodsReceiptLineId: line.lineId,
          quantity: line.quantity,
          sourceLocationId: line.sourceLocationId ?? null,
        })),
      };
      const result = kind === 'transfer'
        ? await goodsReceiptV2Api.routeToTransfer(detail.header.id, {
            ...common,
            targetWarehouseId,
            targetReceivingLocationId: targetLocationId ?? null,
            targetPutawayLocationId: targetLocationId ?? null,
          })
        : await goodsReceiptV2Api.routeToOutbound(detail.header.id, {
            ...common,
            customerId,
            stagingLocationId: null,
            loadingLocationId: null,
          });
      toast.success(`${result.targetDocumentNo} oluşturuldu; ${formatProjectNumber(result.routedQuantity)} miktar yönlendirildi.`);
      await onCompleted(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yönlendirme oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} aria-describedby={undefined} className="max-h-[calc(100%_-_2rem)] w-full overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl sm:max-w-5xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-500">Mal Kabulden Yönlendirme</p>
          <DialogTitle className="mt-1 text-xl font-bold">{detail.header.documentNo}</DialogTitle>
          <p className="text-sm text-slate-500">Kalemleri kısmi miktarlarda DAT veya ambar çıkış belgesine aktarın.</p>
        </div>
        <button type="button" aria-label="Kapat" onClick={onClose} className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5"><X className="size-5"/></button>
      </header>

      <div className={`mt-4 rounded-xl border p-3 text-sm ${qualityReady && approvalReady ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-amber-500/30 bg-amber-500/5 text-amber-600'}`}>
        Kalite/GKK: <strong>{detail.header.qualityStatus}</strong> · Mal kabul onayı: <strong>{detail.header.approvalStatus}</strong>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="İşlem">
          <AppDropdown value={kind} onValueChange={(value) => setKind(value as RouteKind)} options={[
            { value: 'transfer', label: 'Depolar Arası Transfer (DAT)' },
            { value: 'outbound', label: 'Ambar Çıkış' },
          ]}/>
        </Field>
        <Field label="Belge serisi">
          <AppDropdown value={seriesId} onValueChange={setSeriesId} placeholder="Belge serisi seçin" options={series.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.previewDocumentNumber}` }))}/>
        </Field>
        {kind === 'transfer' ? <>
          <Field label="Hedef depo">
            <PagedAppDropdown<WarehouseOption> queryKey={['gr-route-target-warehouse', detail.header.branchCode]} fetchPage={(request) => goodsReceiptV2Api.warehouses(request, detail.header.branchCode)}
              toOption={(item) => ({ value: String(item.id), label: `${item.warehouseCode} · ${item.warehouseName}` })}
              value={targetWarehouseValue} onValueChange={(value) => { setTargetWarehouseValue(value); setTargetWarehouseId(Number(value)); setTargetLocationValue(null); setTargetLocationId(undefined); }} searchable/>
          </Field>
          <Field label="Hedef raf">
            <PagedAppDropdown<LocationOption> queryKey={['gr-route-target-location', targetWarehouseId]} enabled={Boolean(targetWarehouseId)}
              fetchPage={(request) => goodsReceiptV2Api.locations(request, targetWarehouseId!)}
              toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })}
              value={targetLocationValue} onValueChange={(value) => { setTargetLocationValue(value); setTargetLocationId(Number(value)); }} searchable/>
          </Field>
        </> : <Field label="Çıkış carisi">
          <PagedAppDropdown<CustomerOption> queryKey={['gr-route-customer', detail.header.branchCode]} fetchPage={(request) => goodsReceiptV2Api.customers(request, detail.header.branchCode)}
            toOption={(item) => ({ value: String(item.id), label: `${item.customerCode} · ${item.customerName}` })}
            value={customerValue} onValueChange={(value) => { setCustomerValue(value); setCustomerId(Number(value)); }} searchable/>
        </Field>}
      </div>

      <div className="mt-5 space-y-3">
        {routableLines.map((line) => {
          const draft = lines.find((item) => item.lineId === line.id)!;
          return <article key={line.id} className="grid gap-3 rounded-xl border border-[var(--wms-app-border)] p-4 md:grid-cols-[1fr_180px_280px] md:items-end">
            <div>
              <strong>#{line.lineNo} · {line.stockCode}</strong>
              <p className="text-xs text-slate-500">{line.stockName}</p>
              <p className="mt-1 text-xs">Kabul: {formatProjectNumber(line.acceptedQuantity)} · Yönlendirilen: {formatProjectNumber(line.routedQuantity)} · <strong>Kalan: {formatProjectNumber(line.routableQuantity)}</strong></p>
            </div>
            <Field label={`Miktar (${line.unitCode})`}>
              <input className="input" type="number" min="0" max={line.routableQuantity} step="0.000001" value={draft.quantity} onChange={(event) => patchLine(line.id, { quantity: Number(event.target.value) })}/>
            </Field>
            <Field label="Kaynak raf">
              <PagedAppDropdown<LocationOption> queryKey={['gr-route-source-location', line.id, line.targetWarehouseId]}
                fetchPage={(request) => goodsReceiptV2Api.locations(request, line.targetWarehouseId)}
                toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })}
                selectedOption={draft.sourceLocationValue ? { value: draft.sourceLocationValue, label: `Raf #${draft.sourceLocationValue}` } : undefined}
                value={draft.sourceLocationValue} onValueChange={(value) => patchLine(line.id, { sourceLocationValue: value, sourceLocationId: Number(value) })} searchable/>
            </Field>
          </article>;
        })}
        {!routableLines.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Yönlendirilebilir miktar kalmadı.</div>}
      </div>

      <Field label="Açıklama">
        <textarea className="input mt-5 min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500}/>
      </Field>
      <footer className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--wms-app-border)] pt-4">
        <strong>Toplam: {formatProjectNumber(total)}</strong>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-semibold">Vazgeç</button>
          <button type="button" disabled={saving || !routableLines.length} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40">
            {saving ? <Loader2 className="size-4 animate-spin"/> : kind === 'transfer' ? <ArrowRightLeft className="size-4"/> : <PackageMinus className="size-4"/>}
            Belgeyi Oluştur
          </button>
        </div>
      </footer>
    </DialogContent>
  </Dialog>;
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>{children}</label>;
}
