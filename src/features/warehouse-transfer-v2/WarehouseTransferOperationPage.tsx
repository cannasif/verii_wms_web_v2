import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, CheckCircle2, Loader2, PlayCircle, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { WarehouseBarcodeScanner } from '@/features/barcode-resolution/WarehouseBarcodeScanner';
import { completeGoodsReceiptDocumentNo, normalizeGoodsReceiptDocumentNo } from '@/features/goods-receipt-v2/utils/goods-receipt-document-reference';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectNumber } from '@/lib/project-format';
import { transferApiFor, warehouseTransferApi, type TransferApiVariant, type WarehouseTransferOperationLinePayload } from './api/warehouse-transfer.api';
import type { WarehouseTransferDetail } from './types/warehouse-transfer.types';

type Phase = 'pick' | 'dispatch' | 'receive' | 'putaway';
type EditLine = WarehouseTransferOperationLinePayload & { sourceValue: string | null; targetValue: string | null };

const phaseOptions = [
  { value: 'pick', label: '01 · Toplama' },
  { value: 'dispatch', label: '02 · Kaynak depodan sevk' },
  { value: 'receive', label: '03 · Hedef depo kabulü' },
  { value: 'putaway', label: '04 · Hedef rafa yerleştirme' },
];

export function WarehouseTransferOperationPage({ variant = 'warehouse' }: { variant?: TransferApiVariant }) {
  const id = Number(useParams().id);
  const transferApi = useMemo(() => transferApiFor(variant), [variant]);
  const listUrl = variant === 'production' ? '/warehouse/production-transfers/list'
    : variant === 'subcontracting' ? '/warehouse/subcontracting-transfers/list' : '/warehouse/transfers/list';
  const [detail, setDetail] = useState<WarehouseTransferDetail>();
  const [loadError, setLoadError] = useState<string>();
  const [phase, setPhase] = useState<Phase>('pick');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [reason, setReason] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [waybillNo, setWaybillNo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await transferApi.detail(id));
      setLoadError(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transfer kaydı açılamadı.';
      setLoadError(message);
      throw error;
    }
  }, [id, transferApi]);

  useEffect(() => { void load().catch((error: Error) => toast.error(error.message)); }, [load]);

  const remaining = useCallback((line: WarehouseTransferDetail['lines'][number]) => {
    switch (phase) {
      case 'pick': return line.requestedQuantity - line.pickedQuantity;
      case 'dispatch': return line.pickedQuantity - line.shippedQuantity;
      case 'receive': return line.shippedQuantity - line.receivedQuantity;
      case 'putaway': return line.receivedQuantity - line.putawayQuantity;
    }
  }, [phase]);

  useEffect(() => {
    if (!detail) return;
    setLines(detail.lines.filter((line) => remaining(line) > 0).map((line) => ({
      lineId: line.id,
      quantity: line.trackingType === 'Serial' || line.trackingType === 'LotAndSerial' ? 1 : remaining(line),
      sourceLocationId: null,
      targetLocationId: null,
      lotNo: null,
      serialNo: null,
      sourceValue: null,
      targetValue: null,
    })));
  }, [detail, phase, remaining]);

  const sourceWarehouseId = detail
    ? phase === 'pick' || phase === 'dispatch' ? detail.header.sourceWarehouseId : detail.header.targetWarehouseId
    : 0;
  const targetWarehouseId = detail
    ? phase === 'pick' ? detail.header.sourceWarehouseId : detail.header.targetWarehouseId
    : 0;
  const patch = (lineId: number, value: Partial<EditLine>) =>
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...value } : line));

  const transition = async (action: 'approve' | 'release') => {
    setBusy(true);
    try {
      const result = await transferApi.transition(id, action, reason);
      toast.success(`${result.documentNo}: ${localizeEnumValue(result.status)}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    const selected = lines.filter((line) => line.quantity > 0);
    if (!selected.length) return toast.error('İşlenecek en az bir satır olmalıdır.');
    if (selected.some((line) => !line.sourceLocationId || !line.targetLocationId))
      return toast.error('Kaynak ve hedef raf seçimlerini tamamlayın.');
    const invalidTracking = selected.find((edit) => {
      const line = detail?.lines.find((item) => item.id === edit.lineId);
      if (!line) return true;
      if ((line.trackingType === 'Serial' || line.trackingType === 'LotAndSerial') && (!edit.serialNo?.trim() || edit.quantity !== 1)) return true;
      return (line.trackingType === 'Lot' || line.trackingType === 'LotAndSerial') && !edit.lotNo?.trim();
    });
    if (invalidTracking) return toast.error('Seri, lot ve miktar bilgilerini stok takip kuralına uygun doldurun.');
    setBusy(true);
    try {
      const result = await transferApi.operate(id, phase, {
        lines: selected.map((line) => ({
          lineId: line.lineId,
          quantity: line.quantity,
          sourceLocationId: line.sourceLocationId,
          targetLocationId: line.targetLocationId,
          lotNo: line.lotNo,
          serialNo: line.serialNo,
        })),
        reason,
        vehiclePlate,
        driverName,
        waybillNo,
      });
      toast.success(`${result.documentNo}: ${localizeEnumValue(result.status)}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operasyon tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => detail ? {
    requested: detail.lines.reduce((x, y) => x + y.requestedQuantity, 0),
    picked: detail.lines.reduce((x, y) => x + y.pickedQuantity, 0),
    shipped: detail.lines.reduce((x, y) => x + y.shippedQuantity, 0),
    received: detail.lines.reduce((x, y) => x + y.receivedQuantity, 0),
    putaway: detail.lines.reduce((x, y) => x + y.putawayQuantity, 0),
  } : null, [detail]);

  if (loadError) return <OperationLoadError message={loadError} listUrl={listUrl} />;
  if (!detail || !totals) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-7 animate-spin text-violet-500" /></div>;

  return <section className="space-y-5">
    <header className="rounded-2xl border bg-gradient-to-r from-violet-500/10 via-[var(--wms-app-panel)] to-cyan-500/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-violet-500">Transfer Operasyon Merkezi</p><h1 className="mt-1 text-2xl font-black">{detail.header.documentNo}</h1><p className="text-sm text-slate-500">{detail.header.sourceWarehouseCode} {detail.header.sourceWarehouseName} → {detail.header.targetWarehouseCode} {detail.header.targetWarehouseName}</p></div>
        <Link to={listUrl} className="rounded-xl border px-4 py-2 text-sm">Kayıtlara dön</Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <Metric label="Plan" value={totals.requested} /><Metric label="Toplanan" value={totals.picked} /><Metric label="Sevk" value={totals.shipped} /><Metric label="Kabul" value={totals.received} /><Metric label="Yerleşen" value={totals.putaway} />
      </div>
    </header>

    <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-black">Belge kapıları</h2><p className="text-xs text-slate-500">Durum: {localizeEnumValue(detail.header.status)} · Onay: {localizeEnumValue(detail.header.approvalStatus)}</p></div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => void transition('approve')} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500 px-4 py-2 text-emerald-500"><ShieldCheck className="size-4" />Onayla</button>
          <button disabled={busy} onClick={() => void transition('release')} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-white"><PlayCircle className="size-4" />Serbest bırak</button>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Operasyon"><AppDropdown value={phase} onValueChange={(value) => setPhase(value as Phase)} options={phaseOptions} /></Field>
        <Field label="Araç plakası"><input className="input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} /></Field>
        <Field label="Şoför"><input className="input" value={driverName} onChange={(e) => setDriverName(e.target.value)} /></Field>
        <Field label="İrsaliye"><input className="input" maxLength={15} value={waybillNo} onChange={(e) => setWaybillNo(normalizeGoodsReceiptDocumentNo(e.target.value))} onBlur={() => setWaybillNo(completeGoodsReceiptDocumentNo(waybillNo))} /></Field>
      </div>
      <Field label="İşlem notu"><input className="input mt-3" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>

      <div className="mt-5">
        <WarehouseBarcodeScanner
          branchCode={detail.header.branchCode}
          purpose="Outbound"
          warehouseId={sourceWarehouseId}
          disabled={busy}
          title={`${phaseOptions.find((item) => item.value === phase)?.label ?? 'Transfer'} barkodunu okut`}
          description="Okutulan etiket mevcut stok/seri/lot ve raf bakiyesiyle eşleştirilir; ilgili transfer kalemi otomatik doldurulur."
          onResolved={(value) => {
            const targetLine = detail.lines.find((item) => item.stockId === value.stockId && remaining(item) > 0);
            if (!targetLine) {
              toast.error(`${value.stockCode} için bu transferde açık kalem bulunamadı.`);
              return;
            }
            const available = remaining(targetLine);
            const quantity = value.quantity ?? (value.serialNo ? 1 : Math.min(1, available));
            patch(targetLine.id, {
              quantity: Math.min(quantity, available),
              sourceLocationId: value.suggestedLocationId ?? null,
              sourceValue: value.suggestedLocationId ? String(value.suggestedLocationId) : null,
              lotNo: value.lotNo ?? null,
              serialNo: value.serialNo ?? null,
            });
          }}
        />
      </div>

      <div className="mt-5 space-y-3">
        {detail.lines.map((line) => {
          const edit = lines.find((x) => x.lineId === line.id);
          const available = remaining(line);
          return <div key={line.id} className={`rounded-xl border p-4 ${available <= 0 ? 'opacity-50' : ''}`}>
            <div className="mb-3 flex justify-between gap-3"><div><strong>#{line.lineNo} · {line.stockCode}</strong><p className="text-xs text-slate-500">{line.stockName} · {line.yapCode || 'YAP yok'} · Kullanılabilir {formatProjectNumber(Math.max(0, available))}</p></div><CheckCircle2 className={`size-5 ${available <= 0 ? 'text-emerald-500' : 'text-slate-500'}`} /></div>
            {edit && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Miktar"><input className="input" type="number" min="0.000001" max={available} step="0.000001" value={edit.quantity} onChange={(e) => patch(line.id, { quantity: Number(e.target.value) })} /></Field>
              <Field label="Kaynak raf"><PagedAppDropdown queryKey={['wt-op-source', phase, line.id, sourceWarehouseId]} fetchPage={(request) => warehouseTransferApi.locations(request, sourceWarehouseId)} toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })} value={edit.sourceValue} onValueChange={(value) => patch(line.id, { sourceValue: value, sourceLocationId: Number(value) })} searchable /></Field>
              <Field label="Hedef raf"><PagedAppDropdown queryKey={['wt-op-target', phase, line.id, targetWarehouseId]} fetchPage={(request) => warehouseTransferApi.locations(request, targetWarehouseId)} toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })} value={edit.targetValue} onValueChange={(value) => patch(line.id, { targetValue: value, targetLocationId: Number(value) })} searchable /></Field>
              <Field label="Lot"><input className="input" value={edit.lotNo ?? ''} onChange={(e) => patch(line.id, { lotNo: e.target.value || null })} /></Field>
              <Field label="Seri"><input className="input" value={edit.serialNo ?? ''} onChange={(e) => patch(line.id, { serialNo: e.target.value || null })} /></Field>
            </div>}
          </div>;
        })}
      </div>
      <div className="mt-5 flex justify-end"><button disabled={busy || !lines.length} onClick={() => void execute()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}Operasyonu işle</button></div>
    </section>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-[var(--wms-app-panel)] p-3"><p className="text-xs text-slate-500">{label}</p><strong>{formatProjectNumber(value)}</strong></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-semibold">{label}</span>{children}</label>;
}

function OperationLoadError({ message, listUrl }: { message: string; listUrl: string }) {
  return <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-500/30 bg-[var(--wms-app-panel)] p-8 text-center">
    <h1 className="text-xl font-black">Transfer operasyonu açılamadı</h1>
    <p className="mt-2 text-sm text-slate-500">{message}</p>
    <Link to={listUrl} className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white">Transfer listesine dön</Link>
  </section>;
}
