import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, PackageCheck, PlayCircle, ShieldCheck, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { WarehouseBarcodeScanner } from '@/features/barcode-resolution/WarehouseBarcodeScanner';
import { formatProjectNumber } from '@/lib/project-format';
import { shippingApi, type ShipmentOperationLinePayload } from './shipping-api';
import type { ShipmentDetail } from './types';

type Phase = 'pick' | 'pack' | 'load' | 'ship';
type EditLine = ShipmentOperationLinePayload & { sourceValue: string | null; targetValue: string | null };
function isSerialTracked(line: ShipmentDetail['lines'][number]) { return line.trackingType === 'Serial' || line.trackingType === 'LotAndSerial'; }
const phases = [
  { value: 'pick', label: '01 · Toplama' },
  { value: 'pack', label: '02 · Paketleme' },
  { value: 'load', label: '03 · Yükleme' },
  { value: 'ship', label: '04 · Sevk kesinleştirme' },
];

export function ShippingOperationPage() {
  const id = Number(useParams().id);
  const [detail, setDetail] = useState<ShipmentDetail>();
  const [loadError, setLoadError] = useState<string>();
  const [phase, setPhase] = useState<Phase>('pick');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [reason, setReason] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [waybillNo, setWaybillNo] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setDetail(await shippingApi.detail(id));
      setLoadError(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sevk kaydı açılamadı.';
      setLoadError(message);
      throw error;
    }
  }, [id]);
  useEffect(() => { void load().catch((error: Error) => toast.error(error.message)); }, [load]);

  const remaining = useCallback((line: ShipmentDetail['lines'][number]) => {
    if (phase === 'pick') return line.requestedQuantity - line.pickedQuantity;
    if (phase === 'pack') return line.pickedQuantity - line.packedQuantity;
    if (phase === 'load') return Math.max(line.packedQuantity, line.pickedQuantity) - line.loadedQuantity;
    return Math.max(line.loadedQuantity, line.packedQuantity, line.pickedQuantity) - line.shippedQuantity;
  }, [phase]);
  useEffect(() => {
    if (!detail) return;
    setLines(detail.lines.filter((line) => remaining(line) > 0).map((line) => ({
      lineId: line.id, quantity: isSerialTracked(line) ? 1 : remaining(line), sourceLocationId: null, targetLocationId: null,
      lotNo: null, serialNo: null, handlingUnitNo: null, sourceValue: null, targetValue: null,
    })));
  }, [detail, phase, remaining]);
  const patch = (lineId: number, value: Partial<EditLine>) =>
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...value } : line));

  const transition = async (action: 'approve' | 'release') => {
    setBusy(true);
    try { const result = await shippingApi.transition(id, action, reason); toast.success(`${result.documentNo}: ${result.status}`); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (!detail) return toast.error('Sevk detayı henüz yüklenmedi.');
    const selected = lines.filter((line) => line.quantity > 0);
    if (!selected.length) return toast.error('İşlenecek en az bir satır olmalıdır.');
    if (phase !== 'pack' && selected.some((line) => !line.sourceLocationId || (phase !== 'ship' && !line.targetLocationId)))
      return toast.error('Kaynak ve hedef raf seçimlerini tamamlayın.');
    const invalidTracking = selected.find((edit) => {
      const line = detail.lines.find((item) => item.id === edit.lineId);
      if (!line) return true;
      if (isSerialTracked(line) && (!edit.serialNo?.trim() || edit.quantity !== 1)) return true;
      if ((line.trackingType === 'Lot' || line.trackingType === 'LotAndSerial') && !edit.lotNo?.trim()) return true;
      return line.requireHandlingUnit && !edit.handlingUnitNo?.trim();
    });
    if (invalidTracking) return toast.error('Seri, lot, palet/kasa ve miktar bilgilerini stok takip kuralına uygun doldurun.');
    setBusy(true);
    try {
      const result = await shippingApi.operate(id, phase, {
        lines: selected.map((line) => ({
          lineId: line.lineId,
          quantity: line.quantity,
          sourceLocationId: line.sourceLocationId,
          targetLocationId: line.targetLocationId,
          lotNo: line.lotNo,
          serialNo: line.serialNo,
          handlingUnitNo: line.handlingUnitNo,
        })),
        reason, vehiclePlate, driverName, waybillNo, trackingNo,
      });
      toast.success(`${result.documentNo}: ${result.status}`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Operasyon tamamlanamadı.'); }
    finally { setBusy(false); }
  };
  const totals = useMemo(() => detail ? {
    requested: detail.lines.reduce((x, y) => x + y.requestedQuantity, 0),
    picked: detail.lines.reduce((x, y) => x + y.pickedQuantity, 0),
    packed: detail.lines.reduce((x, y) => x + y.packedQuantity, 0),
    loaded: detail.lines.reduce((x, y) => x + y.loadedQuantity, 0),
    shipped: detail.lines.reduce((x, y) => x + y.shippedQuantity, 0),
  } : null, [detail]);
  if (loadError) return <OperationLoadError message={loadError} />;
  if (!detail || !totals) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-7 animate-spin text-cyan-500" /></div>;

  return <section className="space-y-5">
    <header className="rounded-2xl border bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-6">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-500">Sevk Operasyon Merkezi</p><h1 className="text-2xl font-black">{detail.header.documentNo}</h1><p className="text-sm text-slate-500">{detail.header.customerCode} · {detail.header.customerName} · {detail.header.sourceWarehouseName}</p></div><Link to="/warehouse/shipments/list" className="rounded-xl border px-4 py-2 text-sm">Kayıtlara dön</Link></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-5"><Metric label="Plan" value={totals.requested} /><Metric label="Toplanan" value={totals.picked} /><Metric label="Paket" value={totals.packed} /><Metric label="Yüklenen" value={totals.loaded} /><Metric label="Sevk" value={totals.shipped} /></div>
    </header>
    <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">Belge kapıları</h2><p className="text-xs text-slate-500">Durum: {detail.header.status} · Onay: {detail.header.approvalStatus}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => void transition('approve')} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500 px-4 py-2 text-emerald-500"><ShieldCheck className="size-4" />Onayla</button><button disabled={busy} onClick={() => void transition('release')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-white"><PlayCircle className="size-4" />Serbest bırak</button></div></div>
    </section>
    <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"><Field label="Operasyon"><AppDropdown value={phase} onValueChange={(value) => setPhase(value as Phase)} options={phases} /></Field><Field label="Araç plakası"><input className="input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} /></Field><Field label="Şoför"><input className="input" value={driverName} onChange={(e) => setDriverName(e.target.value)} /></Field><Field label="İrsaliye"><input className="input" value={waybillNo} onChange={(e) => setWaybillNo(e.target.value)} /></Field><Field label="Takip no"><input className="input" value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} /></Field><Field label="Not"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
      <div className="mt-5">
        <WarehouseBarcodeScanner
          branchCode={detail.header.branchCode}
          purpose="Outbound"
          warehouseId={detail.header.sourceWarehouseId}
          disabled={busy || phase === 'pack'}
          title={`${phases.find((item) => item.value === phase)?.label ?? 'Sevk'} barkodunu okut`}
          description={phase === 'pack'
            ? 'Paketleme adımında palet/kasa etiketi kullanılır. Stok seri/lot doğrulaması toplama, yükleme ve sevk adımlarında yapılır.'
            : 'Okutulan barkod stok, seri, lot, miktar ve mevcut raf bakiyesiyle doğrulanır; ilgili sevk kalemi otomatik doldurulur.'}
          onResolved={(value) => {
            const targetLine = detail.lines.find((item) => item.stockId === value.stockId && remaining(item) > 0);
            if (!targetLine) {
              toast.error(`${value.stockCode} için bu sevkte açık kalem bulunamadı.`);
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
      <div className="mt-5 space-y-3">{detail.lines.map((line) => { const edit = lines.find((x) => x.lineId === line.id); const available = remaining(line); return <div key={line.id} className={`rounded-xl border p-4 ${available <= 0 ? 'opacity-50' : ''}`}><div className="mb-3 flex justify-between"><div><strong>#{line.lineNo} · {line.stockCode}</strong><p className="text-xs text-slate-500">{line.stockName} · Kullanılabilir {formatProjectNumber(Math.max(0, available))}</p></div><CheckCircle2 className={`size-5 ${available <= 0 ? 'text-emerald-500' : 'text-slate-500'}`} /></div>{edit && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><Field label="Miktar"><input className="input" type="number" min="0.000001" max={available} step="0.000001" value={edit.quantity} onChange={(e) => patch(line.id, { quantity: Number(e.target.value) })} /></Field>{phase !== 'pack' && <Field label="Kaynak raf"><PagedAppDropdown queryKey={['sh-op-source', phase, line.id, detail.header.sourceWarehouseId]} fetchPage={(request) => shippingApi.locations(request, detail.header.sourceWarehouseId)} toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })} value={edit.sourceValue} onValueChange={(value) => patch(line.id, { sourceValue: value, sourceLocationId: Number(value) })} searchable /></Field>}{phase !== 'pack' && phase !== 'ship' && <Field label="Hedef raf"><PagedAppDropdown queryKey={['sh-op-target', phase, line.id, detail.header.sourceWarehouseId]} fetchPage={(request) => shippingApi.locations(request, detail.header.sourceWarehouseId)} toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })} value={edit.targetValue} onValueChange={(value) => patch(line.id, { targetValue: value, targetLocationId: Number(value) })} searchable /></Field>}<Field label="Lot"><input className="input" value={edit.lotNo ?? ''} onChange={(e) => patch(line.id, { lotNo: e.target.value || null })} /></Field><Field label="Seri"><input className="input" value={edit.serialNo ?? ''} onChange={(e) => patch(line.id, { serialNo: e.target.value || null })} /></Field><Field label="Palet/Kasa"><input className="input" value={edit.handlingUnitNo ?? ''} onChange={(e) => patch(line.id, { handlingUnitNo: e.target.value || null })} /></Field></div>}</div>; })}</div>
      <div className="mt-5 flex justify-end"><button disabled={busy || !lines.length} onClick={() => void execute()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : phase === 'ship' ? <Truck className="size-4" /> : <PackageCheck className="size-4" />}Operasyonu işle</button></div>
    </section>
  </section>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-[var(--wms-app-panel)] p-3"><p className="text-xs text-slate-500">{label}</p><strong>{formatProjectNumber(value)}</strong></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1 text-sm"><span className="font-semibold">{label}</span>{children}</label>; }
function OperationLoadError({ message }: { message: string }) { return <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-500/30 bg-[var(--wms-app-panel)] p-8 text-center"><h1 className="text-xl font-black">Sevk operasyonu açılamadı</h1><p className="mt-2 text-sm text-slate-500">{message}</p><Link to="/warehouse/shipments/list" className="mt-5 inline-flex rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950">Sevk listesine dön</Link></section>; }
