import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Ban, Eye, Loader2, Pencil, PlayCircle, Save, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { shippingApi } from './shipping-api';
import type { ShipmentDetail, ShipmentGridRow } from './types';

export function ShippingListPage() {
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [editDetail, setEditDetail] = useState<ShipmentDetail | null>(null);
  const [lifecycle, setLifecycle] = useState<{ row: ShipmentGridRow; kind: 'delete' | 'cancel' } | null>(null);
  const [busyId, setBusyId] = useState<number>();
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (id: number, mode: 'detail' | 'edit') => {
    setBusyId(id);
    try { const result = await shippingApi.detail(id); if (mode === 'detail') setDetail(result); else setEditDetail(result); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Sevk açılamadı.'); }
    finally { setBusyId(undefined); }
  }, []);

  const columns = useMemo<GridColumn<ShipmentGridRow>[]>(() => [
    ...systemColumns<ShipmentGridRow>(),
    { key: 'documentNo', label: 'Sevk No', sortable: true, filterable: true, render: (row) => row.documentNo },
    { key: 'documentDate', label: 'Tarih', sortable: true, filterable: true, render: (row) => formatProjectDate(row.documentDate) },
    { key: 'customerCode', label: 'Cari Kodu', sortable: true, filterable: true, render: (row) => row.customerCode },
    { key: 'customerName', label: 'Cari Adı', sortable: true, filterable: true, render: (row) => row.customerName ?? '—' },
    { key: 'sourceWarehouseCode', label: 'Depo Kodu', sortable: true, filterable: true, render: (row) => row.sourceWarehouseCode },
    { key: 'sourceWarehouseName', label: 'Depo Adı', sortable: true, filterable: true, render: (row) => row.sourceWarehouseName },
    { key: 'initiationMode', label: 'Akış', sortable: true, filterable: true, render: (row) => row.initiationMode },
    { key: 'status', label: 'Durum', sortable: true, filterable: true, render: (row) => row.status },
    { key: 'requestedQuantity', label: 'Plan', sortable: true, filterable: true, render: (row) => formatProjectNumber(row.requestedQuantity) },
    { key: 'pickedQuantity', label: 'Toplandı', sortable: true, filterable: true, render: (row) => formatProjectNumber(row.pickedQuantity) },
    { key: 'packedQuantity', label: 'Paketlendi', sortable: true, filterable: true, render: (row) => formatProjectNumber(row.packedQuantity) },
    { key: 'loadedQuantity', label: 'Yüklendi', sortable: true, filterable: true, render: (row) => formatProjectNumber(row.loadedQuantity) },
    { key: 'shippedQuantity', label: 'Sevk', sortable: true, filterable: true, render: (row) => formatProjectNumber(row.shippedQuantity) },
    {
      key: 'actions', label: 'İşlemler', ...requiredActionColumn,
      render: (row) => <div className="flex items-center gap-1">
        {row.status !== 'Cancelled' && <Link to={`/warehouse/shipments/${row.id}/operations`} title="Operasyonu yürüt" className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10"><PlayCircle className="size-4" /></Link>}
        {row.status === 'Draft' && <button type="button" title="Taslağı düzenle" onClick={() => void load(row.id, 'edit')} className="rounded-lg p-2 text-amber-500 hover:bg-amber-500/10"><Pencil className="size-4" /></button>}
        {row.status === 'Draft' && <button type="button" title="Taslağı sil" onClick={() => setLifecycle({ row, kind: 'delete' })} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>}
        {row.status !== 'Cancelled' && <button type="button" title="Sevki iptal et" onClick={() => setLifecycle({ row, kind: 'cancel' })} className="rounded-lg p-2 text-orange-500 hover:bg-orange-500/10"><Ban className="size-4" /></button>}
        <button type="button" title="Detayı göster" onClick={() => void load(row.id, 'detail')} className="rounded-lg p-2 text-violet-500 hover:bg-violet-500/10">{busyId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}</button>
      </div>,
    },
  ], [busyId, load]);

  const refreshed = () => setRevision((value) => value + 1);
  return <>
    <AdvancedDataGrid key={revision} pageKey="shipments-v2" title="Sevk Kayıtları"
      description="Plan, toplama, paketleme, yükleme ve sevk miktarlarını sunucu taraflı izleyin."
      columns={columns} fetchPage={shippingApi.paged} />
    {detail && <ShipmentDetailDialog detail={detail} close={() => setDetail(null)} />}
    {editDetail && <EditShipment detail={editDetail} close={() => setEditDetail(null)} saved={() => { setEditDetail(null); refreshed(); }} />}
    {lifecycle && <LifecycleDialog value={lifecycle} close={() => setLifecycle(null)} completed={() => { setLifecycle(null); refreshed(); }} />}
  </>;
}

function EditShipment({ detail, close, saved }: { detail: ShipmentDetail; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({
    documentDate: detail.header.documentDate, plannedShipmentAtUtc: localDateTime(detail.header.plannedShipmentAtUtc),
    priority: detail.header.priority, externalReferenceNo: detail.draft.externalReferenceNo ?? '',
    isEDispatch: detail.draft.isEDispatch, carrierCode: detail.draft.carrierCode ?? '', carrierName: detail.draft.carrierName ?? '',
    vehiclePlate: detail.draft.vehiclePlate ?? '', trailerPlate: detail.draft.trailerPlate ?? '',
    driverName: detail.draft.driverName ?? '', sealNo: detail.draft.sealNo ?? '', description: detail.draft.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await shippingApi.update(detail.header.id, {
        rowVersion: detail.rowVersion, documentDate: form.documentDate,
        stagingLocationId: detail.draft.stagingLocationId ?? null, loadingLocationId: detail.draft.loadingLocationId ?? null,
        plannedShipmentAtUtc: utc(form.plannedShipmentAtUtc), priority: form.priority,
        externalReferenceNo: clean(form.externalReferenceNo), isEDispatch: form.isEDispatch,
        carrierCode: clean(form.carrierCode), carrierName: clean(form.carrierName),
        vehiclePlate: clean(form.vehiclePlate), trailerPlate: clean(form.trailerPlate),
        driverName: clean(form.driverName), sealNo: clean(form.sealNo), description: clean(form.description),
      });
      toast.success('Sevk taslağı güncellendi.'); saved();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Sevk güncellenemedi.'); }
    finally { setBusy(false); }
  };
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <ResponsiveDialog onClose={close} title="Sevk taslağını düzenle" description={`${detail.header.documentNo} numaralı sevk taslağını düzenleyin.`} className="!max-w-3xl">
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
    <header className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Sevk taslağını düzenle</h2><p className="font-mono text-sm text-slate-500">{detail.header.documentNo}</p></div><button type="button" onClick={close} aria-label="Pencereyi kapat" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X /></button></header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Belge tarihi"><input type="date" required value={form.documentDate} onChange={(e) => set('documentDate', e.target.value)} className="input" /></Field>
      <Field label="Planlanan sevk"><input type="datetime-local" value={form.plannedShipmentAtUtc} onChange={(e) => set('plannedShipmentAtUtc', e.target.value)} className="input" /></Field>
      <Field label="Öncelik"><input type="number" min={1} max={5} value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} className="input" /></Field>
      <Field label="Dış referans"><input maxLength={100} value={form.externalReferenceNo} onChange={(e) => set('externalReferenceNo', e.target.value)} className="input" /></Field>
      <Field label="Taşıyıcı kodu"><input maxLength={50} value={form.carrierCode} onChange={(e) => set('carrierCode', e.target.value)} className="input" /></Field>
      <Field label="Taşıyıcı adı"><input maxLength={200} value={form.carrierName} onChange={(e) => set('carrierName', e.target.value)} className="input" /></Field>
      <Field label="Araç plakası"><input maxLength={20} value={form.vehiclePlate} onChange={(e) => set('vehiclePlate', e.target.value)} className="input" /></Field>
      <Field label="Dorse plakası"><input maxLength={20} value={form.trailerPlate} onChange={(e) => set('trailerPlate', e.target.value)} className="input" /></Field>
      <Field label="Sürücü"><input maxLength={200} value={form.driverName} onChange={(e) => set('driverName', e.target.value)} className="input" /></Field>
      <Field label="Mühür no"><input maxLength={100} value={form.sealNo} onChange={(e) => set('sealNo', e.target.value)} className="input" /></Field>
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={form.isEDispatch} onChange={(e) => set('isEDispatch', e.target.checked)} />E-irsaliye</label>
    </div>
    <Field label="Açıklama"><textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} className="input h-auto py-3" /></Field>
    <p className="text-xs text-slate-500">Cari, depo, raf, stok ve miktar alanları operasyon bütünlüğü için bu ekranda değiştirilemez.</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4 py-2">Vazgeç</button><button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Kaydet</button></div>
  </form></ResponsiveDialog>;
}

function LifecycleDialog({ value, close, completed }: { value: { row: ShipmentGridRow; kind: 'delete' | 'cancel' }; close: () => void; completed: () => void }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const run = async () => {
    if (value.kind === 'cancel' && !reason.trim()) { toast.error('İptal nedeni zorunludur.'); return; }
    setBusy(true);
    try {
      if (value.kind === 'delete') await shippingApi.deleteDraft(value.row.id); else await shippingApi.cancel(value.row.id, reason);
      toast.success(value.kind === 'delete' ? 'Sevk taslağı silindi.' : 'Sevk iptal edildi; stok hareketleri ters çevrildi.'); completed();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };
  const title = value.kind === 'delete' ? 'Taslağı sil' : 'Sevki iptal et';
  return <ResponsiveDialog onClose={close} title={title} description={`${value.row.documentNo} için geri alınamaz işlem onayı.`} className="!max-w-lg border-rose-500/30"><h2 className="text-xl font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{value.row.documentNo} için işlem geri alınamaz. İptal sırasında stok hareketleri ters sırada ve tek transaction içinde çevrilir.</p>{value.kind === 'cancel' && <textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="İptal nedenini yazın" className="input mt-4 h-auto py-3" />}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4 py-2">Vazgeç</button><button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">{busy ? 'İşleniyor…' : value.kind === 'delete' ? 'Taslağı Sil' : 'İptal Et'}</button></div></ResponsiveDialog>;
}

function ShipmentDetailDialog({ detail, close }: { detail: ShipmentDetail; close: () => void }) {
  return <ResponsiveDialog onClose={close} title={`Sevk ${detail.header.documentNo}`} description="Sevk kalemleri ve operasyon ilerlemesi." className="!max-w-6xl"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-black">{detail.header.documentNo}</h2><p>{detail.header.customerCode} · {detail.header.customerName}</p></div><div className="flex items-center gap-2 self-end sm:self-auto">{detail.header.status !== 'Cancelled' && <Link to={`/warehouse/shipments/${detail.header.id}/operations`} className="inline-flex min-h-11 items-center rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950">Operasyonu aç</Link>}<button type="button" onClick={close} aria-label="Pencereyi kapat" className="grid size-11 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X /></button></div></div><div className="mt-5 overflow-auto"><table className="min-w-[760px] w-full text-sm"><thead><tr><th>#</th><th>Stok</th><th>Plan</th><th>Rezerve</th><th>Toplanan</th><th>Paket</th><th>Yüklenen</th><th>Sevk</th></tr></thead><tbody>{detail.lines.map((line) => <tr key={line.id} className="border-t border-[var(--wms-app-border)]"><td>{line.lineNo}</td><td>{line.stockCode} · {line.stockName}</td><td>{formatProjectNumber(line.requestedQuantity)}</td><td>{formatProjectNumber(line.reservedQuantity)}</td><td>{formatProjectNumber(line.pickedQuantity)}</td><td>{formatProjectNumber(line.packedQuantity)}</td><td>{formatProjectNumber(line.loadedQuantity)}</td><td>{formatProjectNumber(line.shippedQuantity)}</td></tr>)}</tbody></table></div></ResponsiveDialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-semibold">{label}</span>{children}</label>; }
function localDateTime(value?: string) { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
function utc(value: string) { return value ? new Date(value).toISOString() : null; }
function clean(value: string) { return value.trim() || null; }
