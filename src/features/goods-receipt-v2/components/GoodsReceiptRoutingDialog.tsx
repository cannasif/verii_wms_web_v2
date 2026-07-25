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
  GoodsReceiptSplitRoutingResult,
  LocationOption,
  SeriesOption,
  WarehouseOption,
} from '../types/goods-receipt.types';

interface LineDraft {
  lineId: number;
  transferQuantity: number;
  outboundQuantity: number;
  sourceLocationId?: number;
  sourceLocationValue?: string | null;
}

export function GoodsReceiptRoutingDialog({
  detail,
  initialKind,
  onClose,
  onCompleted,
}: {
  detail: GoodsReceiptDetail;
  initialKind: 'transfer' | 'outbound';
  onClose: () => void;
  onCompleted: (result: GoodsReceiptSplitRoutingResult) => Promise<void>;
}): ReactElement {
  const [transferSeries, setTransferSeries] = useState<SeriesOption[]>([]);
  const [outboundSeries, setOutboundSeries] = useState<SeriesOption[]>([]);
  const [transferSeriesId, setTransferSeriesId] = useState('');
  const [outboundSeriesId, setOutboundSeriesId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>();
  const [targetWarehouseValue, setTargetWarehouseValue] = useState<string | null>(null);
  const [targetLocationId, setTargetLocationId] = useState<number>();
  const [targetLocationValue, setTargetLocationValue] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number>();
  const [customerValue, setCustomerValue] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>(() => detail.lines.map((line) => ({
    lineId: line.id,
    transferQuantity: initialKind === 'transfer' ? line.routableQuantity : 0,
    outboundQuantity: initialKind === 'outbound' ? line.routableQuantity : 0,
    sourceLocationId: line.defaultPutawayLocationId ?? line.defaultReceivingLocationId,
    sourceLocationValue: line.defaultPutawayLocationId || line.defaultReceivingLocationId
      ? String(line.defaultPutawayLocationId ?? line.defaultReceivingLocationId)
      : null,
  })));

  const qualityReady = detail.header.qualityStatus === 'NotRequired' || detail.header.qualityStatus === 'Passed';
  const approvalReady = detail.header.approvalStatus === 'NotRequired' || detail.header.approvalStatus === 'Approved';
  const routableLines = useMemo(() => detail.lines.filter((line) => line.routableQuantity > 0), [detail.lines]);
  const transferTotal = lines.reduce((sum, line) => sum + Math.max(0, line.transferQuantity), 0);
  const outboundTotal = lines.reduce((sum, line) => sum + Math.max(0, line.outboundQuantity), 0);

  useEffect(() => {
    void Promise.all([
      goodsReceiptV2Api.transferSeries(detail.header.targetWarehouseId),
      goodsReceiptV2Api.outboundSeries(detail.header.targetWarehouseId),
    ]).then(([transferItems, outboundItems]) => {
      setTransferSeries(transferItems);
      setOutboundSeries(outboundItems);
      setTransferSeriesId(String((transferItems.find((item) => item.isDefault) ?? transferItems[0])?.id ?? ''));
      setOutboundSeriesId(String((outboundItems.find((item) => item.isDefault) ?? outboundItems[0])?.id ?? ''));
    }).catch((error: Error) => toast.error(error.message));
  }, [detail.header.targetWarehouseId]);

  const patchLine = (lineId: number, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...patch } : line));

  const submit = async () => {
    if (!qualityReady) return toast.error('Kalite/GKK kararı tamamlanmadan yönlendirme yapılamaz.');
    if (!approvalReady) return toast.error('Mal kabul onayı tamamlanmadan yönlendirme yapılamaz.');
    if (transferTotal <= 0 && outboundTotal <= 0) return toast.error('En az bir kaleme transfer veya ambar çıkış miktarı girin.');
    if (transferTotal > 0 && (!transferSeriesId || !targetWarehouseId)) return toast.error('Transfer belge serisi ve hedef deposu zorunludur.');
    if (transferTotal > 0 && targetWarehouseId === detail.header.targetWarehouseId) return toast.error('Kaynak ve hedef depo aynı olamaz.');
    if (outboundTotal > 0 && (!outboundSeriesId || !customerId)) return toast.error('Ambar çıkış belge serisi ve carisi zorunludur.');
    for (const draft of lines) {
      const source = detail.lines.find((line) => line.id === draft.lineId)!;
      if (draft.transferQuantity < 0 || draft.outboundQuantity < 0)
        return toast.error(`${source.stockCode} için miktarlar negatif olamaz.`);
      if (draft.transferQuantity + draft.outboundQuantity > source.routableQuantity)
        return toast.error(`${source.stockCode} için toplam en fazla ${formatProjectNumber(source.routableQuantity)} yönlendirilebilir.`);
    }

    const mapLines = (selector: (line: LineDraft) => number) => lines
      .filter((line) => selector(line) > 0)
      .map((line) => ({ goodsReceiptLineId: line.lineId, quantity: selector(line), sourceLocationId: line.sourceLocationId ?? null }));
    setSaving(true);
    try {
      const result = await goodsReceiptV2Api.routeSplit(detail.header.id, {
        transfer: transferTotal > 0 ? {
          idempotencyKey: crypto.randomUUID(),
          documentSeriesId: Number(transferSeriesId),
          targetWarehouseId,
          targetReceivingLocationId: targetLocationId ?? null,
          targetPutawayLocationId: targetLocationId ?? null,
          priority: detail.header.priority || 3,
          description: description.trim() || null,
          lines: mapLines((line) => line.transferQuantity),
        } : null,
        outbound: outboundTotal > 0 ? {
          idempotencyKey: crypto.randomUUID(),
          documentSeriesId: Number(outboundSeriesId),
          customerId,
          stagingLocationId: null,
          loadingLocationId: null,
          priority: detail.header.priority || 3,
          description: description.trim() || null,
          lines: mapLines((line) => line.outboundQuantity),
        } : null,
      });
      toast.success(`${result.routes.map((route) => route.targetDocumentNo).join(' ve ')} oluşturuldu; toplam ${formatProjectNumber(result.routedQuantity)} yönlendirildi.`);
      await onCompleted(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yönlendirme oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} aria-describedby={undefined} className="max-h-[calc(100%_-_2rem)] w-full overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-2xl sm:max-w-7xl sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-500">Mal Kabul Sonrası Dağıtım</p><DialogTitle className="mt-1 text-xl font-bold">{detail.header.documentNo}</DialogTitle><p className="text-sm text-slate-500">Her kalemin kalan miktarını aynı işlemde transfer ve ambar çıkış arasında bölün.</p></div>
        <button type="button" aria-label="Kapat" onClick={onClose} className="rounded-lg p-2"><X className="size-5"/></button>
      </header>
      <div className={`mt-4 rounded-xl border p-3 text-sm ${qualityReady && approvalReady ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-amber-500/30 bg-amber-500/5 text-amber-600'}`}>Kalite/GKK: <strong>{detail.header.qualityStatus}</strong> · Mal kabul onayı: <strong>{detail.header.approvalStatus}</strong></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RouteCard title="Depolar Arası Transfer" icon={<ArrowRightLeft className="size-5"/>} total={transferTotal}>
          <Field label="Belge serisi"><AppDropdown value={transferSeriesId} onValueChange={setTransferSeriesId} placeholder="Seri seçin" options={transferSeries.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.previewDocumentNumber}` }))}/></Field>
          <Field label="Hedef depo"><PagedAppDropdown<WarehouseOption> queryKey={['gr-route-target-warehouse', detail.header.branchCode]} fetchPage={(request) => goodsReceiptV2Api.warehouses(request, detail.header.branchCode)} toOption={(item) => ({ value: String(item.id), label: `${item.warehouseCode} · ${item.warehouseName}` })} value={targetWarehouseValue} onValueChange={(value) => { setTargetWarehouseValue(value); setTargetWarehouseId(Number(value)); setTargetLocationValue(null); setTargetLocationId(undefined); }} searchable/></Field>
          <Field label="Hedef raf"><PagedAppDropdown<LocationOption> queryKey={['gr-route-target-location', targetWarehouseId]} enabled={Boolean(targetWarehouseId)} fetchPage={(request) => goodsReceiptV2Api.locations(request, targetWarehouseId!)} toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })} value={targetLocationValue} onValueChange={(value) => { setTargetLocationValue(value); setTargetLocationId(Number(value)); }} searchable/></Field>
        </RouteCard>
        <RouteCard title="Ambar Çıkış" icon={<PackageMinus className="size-5"/>} total={outboundTotal}>
          <Field label="Belge serisi"><AppDropdown value={outboundSeriesId} onValueChange={setOutboundSeriesId} placeholder="Seri seçin" options={outboundSeries.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.previewDocumentNumber}` }))}/></Field>
          <Field label="Çıkış carisi"><PagedAppDropdown<CustomerOption> queryKey={['gr-route-customer', detail.header.branchCode]} fetchPage={(request) => goodsReceiptV2Api.customers(request, detail.header.branchCode)} toOption={(item) => ({ value: String(item.id), label: `${item.customerCode} · ${item.customerName}` })} value={customerValue} onValueChange={(value) => { setCustomerValue(value); setCustomerId(Number(value)); }} searchable/></Field>
        </RouteCard>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full min-w-[900px] text-sm"><thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">Stok</th><th className="p-3 text-right">Kabul</th><th className="p-3 text-right">Önceki</th><th className="p-3 text-right">Kalan</th><th className="p-3">Transfer</th><th className="p-3">Ambar Çıkış</th><th className="p-3">Kaynak Raf</th></tr></thead>
          <tbody>{routableLines.map((line) => { const draft = lines.find((item) => item.lineId === line.id)!; const remaining = line.routableQuantity - draft.transferQuantity - draft.outboundQuantity; return <tr key={line.id} className="border-t border-[var(--wms-app-border)]"><td className="p-3"><strong>{line.stockCode}</strong><div className="text-xs text-slate-500">{line.stockName}</div></td><td className="p-3 text-right">{formatProjectNumber(line.acceptedQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(line.routedQuantity)}</td><td className={`p-3 text-right font-bold ${remaining < 0 ? 'text-rose-500' : 'text-cyan-600'}`}>{formatProjectNumber(remaining)}</td><td className="p-3"><input className="input min-w-28" type="number" min="0" max={line.routableQuantity} step="0.000001" value={draft.transferQuantity} onChange={(event) => patchLine(line.id, { transferQuantity: Number(event.target.value) })}/></td><td className="p-3"><input className="input min-w-28" type="number" min="0" max={line.routableQuantity} step="0.000001" value={draft.outboundQuantity} onChange={(event) => patchLine(line.id, { outboundQuantity: Number(event.target.value) })}/></td><td className="p-3"><PagedAppDropdown<LocationOption> queryKey={['gr-route-source-location', line.id, line.targetWarehouseId]} fetchPage={(request) => goodsReceiptV2Api.locations(request, line.targetWarehouseId)} toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })} selectedOption={draft.sourceLocationValue ? { value: draft.sourceLocationValue, label: `Raf #${draft.sourceLocationValue}` } : undefined} value={draft.sourceLocationValue} onValueChange={(value) => patchLine(line.id, { sourceLocationValue: value, sourceLocationId: Number(value) })} searchable/></td></tr>; })}</tbody>
        </table>
      </div>
      <Field label="Operasyon notu"><textarea className="input mt-5 min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500}/></Field>
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wms-app-border)] pt-4"><div className="flex gap-4 text-sm"><strong>Transfer: {formatProjectNumber(transferTotal)}</strong><strong>Ambar çıkış: {formatProjectNumber(outboundTotal)}</strong></div><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-semibold">Vazgeç</button><button type="button" disabled={saving || !routableLines.length || transferTotal + outboundTotal <= 0} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40">{saving ? <Loader2 className="size-4 animate-spin"/> : <ArrowRightLeft className="size-4"/>}Dağıtımı Oluştur</button></div></footer>
    </DialogContent>
  </Dialog>;
}

function RouteCard({ title, icon, total, children }: { title: string; icon: ReactElement; total: number; children: ReactElement | ReactElement[] }) {
  return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] p-4"><header className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-cyan-600">{icon}{title}</div><span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-600">{formatProjectNumber(total)}</span></header><div className="grid gap-3 md:grid-cols-2">{children}</div></section>;
}
function Field({ label, children }: { label: string; children: ReactElement }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>{children}</label>; }
