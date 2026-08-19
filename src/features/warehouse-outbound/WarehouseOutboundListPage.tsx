import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Ban, Eye, Loader2, Pencil, PlayCircle, Save, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDateInput } from '@/components/shared/AppInput';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { warehouseOutboundApi } from './warehouseOutbound-api';
import type { ShipmentDetail, ShipmentGridRow } from './types';

export function WarehouseOutboundListPage() {
  const { t } = useModuleTranslation('warehouse-outbound');
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [editDetail, setEditDetail] = useState<ShipmentDetail | null>(null);
  const [lifecycle, setLifecycle] = useState<{ row: ShipmentGridRow; kind: 'delete' | 'cancel' } | null>(null);
  const [busyId, setBusyId] = useState<number>();
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (id: number, mode: 'detail' | 'edit') => {
    setBusyId(id);
    try { const result = await warehouseOutboundApi.detail(id); if (mode === 'detail') setDetail(result); else setEditDetail(result); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('list.errors.openFailed')); }
    finally { setBusyId(undefined); }
  }, [t]);

  const columns = useMemo<GridColumn<ShipmentGridRow>[]>(() => [
    ...systemColumns<ShipmentGridRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    { key: 'documentNo', label: t('list.columns.documentNo'), sortable: true, filterable: true, render: (row) => row.documentNo },
    { key: 'documentDate', label: t('list.columns.documentDate'), sortable: true, filterable: true, render: (row) => formatProjectDate(row.documentDate) },
    { key: 'customerCode', label: t('list.columns.customerCode'), sortable: true, filterable: true, render: (row) => row.customerCode },
    { key: 'customerName', label: t('list.columns.customerName'), sortable: true, filterable: true, render: (row) => row.customerName ?? '—' },
    { key: 'sourceWarehouseCode', label: t('list.columns.sourceWarehouseCode'), sortable: true, filterable: true, render: (row) => row.sourceWarehouseCode },
    { key: 'sourceWarehouseName', label: t('list.columns.sourceWarehouseName'), sortable: true, filterable: true, render: (row) => row.sourceWarehouseName },
    { key: 'initiationMode', label: t('list.columns.initiationMode'), sortable: true, filterable: true, render: (row) => row.initiationMode },
    { key: 'status', label: t('list.columns.status'), sortable: true, filterable: true, render: (row) => <OpsStatusBadge tone={inferOpsStatusTone(row.status)}>{row.status}</OpsStatusBadge> },
    { key: 'requestedQuantity', label: t('list.columns.requestedQuantity'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.requestedQuantity) },
    { key: 'pickedQuantity', label: t('list.columns.pickedQuantity'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.pickedQuantity) },
    { key: 'packedQuantity', label: t('list.columns.packedQuantity'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.packedQuantity) },
    { key: 'loadedQuantity', label: t('list.columns.loadedQuantity'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.loadedQuantity) },
    { key: 'shippedQuantity', label: t('list.columns.shippedQuantity'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.shippedQuantity) },
    {
      key: 'actions', label: t('list.columns.actions'), ...requiredActionColumn,
      render: (row) => <div className="flex items-center gap-1">
        {row.status !== 'Cancelled' && <Link to={`/warehouse/warehouse-outbounds/${row.id}/operations`} title={t('list.actionTitles.runOperation')} className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10"><PlayCircle className="size-4" /></Link>}
        {row.status === 'Draft' && <button type="button" title={t('list.actionTitles.editDraft')} onClick={() => void load(row.id, 'edit')} className="rounded-lg p-2 text-amber-500 hover:bg-amber-500/10"><Pencil className="size-4" /></button>}
        {row.status === 'Draft' && <button type="button" title={t('list.actionTitles.deleteDraft')} onClick={() => setLifecycle({ row, kind: 'delete' })} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>}
        {row.status !== 'Cancelled' && <button type="button" title={t('list.actionTitles.cancelShipment')} onClick={() => setLifecycle({ row, kind: 'cancel' })} className="rounded-lg p-2 text-orange-500 hover:bg-orange-500/10"><Ban className="size-4" /></button>}
        <button type="button" title={t('list.actionTitles.showDetail')} onClick={() => void load(row.id, 'detail')} className="rounded-lg p-2 text-violet-500 hover:bg-violet-500/10">{busyId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}</button>
      </div>,
    },
  ], [busyId, load, t]);

  const refreshed = () => setRevision((value) => value + 1);
  return <>
    <AdvancedDataGrid key={revision} pageKey="warehouse-outbounds" title={t('list.title')}
      description={t('list.description')}
      columns={columns} fetchPage={warehouseOutboundApi.paged} />
    {detail && <ShipmentDetailDialog detail={detail} close={() => setDetail(null)} />}
    {editDetail && <EditShipment detail={editDetail} close={() => setEditDetail(null)} saved={() => { setEditDetail(null); refreshed(); }} />}
    {lifecycle && <LifecycleDialog value={lifecycle} close={() => setLifecycle(null)} completed={() => { setLifecycle(null); refreshed(); }} />}
  </>;
}

function EditShipment({ detail, close, saved }: { detail: ShipmentDetail; close: () => void; saved: () => void }) {
  const { t } = useModuleTranslation('warehouse-outbound');
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
      await warehouseOutboundApi.update(detail.header.id, {
        rowVersion: detail.rowVersion, documentDate: form.documentDate,
        stagingLocationId: detail.draft.stagingLocationId ?? null, loadingLocationId: detail.draft.loadingLocationId ?? null,
        plannedShipmentAtUtc: utc(form.plannedShipmentAtUtc), priority: form.priority,
        externalReferenceNo: clean(form.externalReferenceNo), isEDispatch: form.isEDispatch,
        carrierCode: clean(form.carrierCode), carrierName: clean(form.carrierName),
        vehiclePlate: clean(form.vehiclePlate), trailerPlate: clean(form.trailerPlate),
        driverName: clean(form.driverName), sealNo: clean(form.sealNo), description: clean(form.description),
      });
      toast.success(t('list.toasts.updated')); saved();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('list.errors.updateFailed')); }
    finally { setBusy(false); }
  };
  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <ResponsiveDialog onClose={close} title={t('list.editDialog.title')} description={t('list.editDialog.description', { documentNo: detail.header.documentNo })} className="!max-w-3xl"><form onSubmit={(event) => void submit(event)} className="space-y-4">
    <header className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{t('list.editDialog.title')}</h2><p className="font-mono text-sm text-slate-500">{detail.header.documentNo}</p></div><button type="button" onClick={close} aria-label={t('list.editDialog.closeAria')} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X /></button></header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={t('list.editDialog.fields.documentDate')}><AppDateInput required value={form.documentDate} onChange={(e) => set('documentDate', e.target.value)} /></Field>
      <Field label={t('list.editDialog.fields.plannedShipment')}><AppDateInput type="datetime-local" value={form.plannedShipmentAtUtc} onChange={(e) => set('plannedShipmentAtUtc', e.target.value)} /></Field>
      <Field label={t('list.editDialog.fields.priority')}><input type="number" min={1} max={5} value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} className="input" /></Field>
      <Field label={t('list.editDialog.fields.externalReference')}><input maxLength={100} value={form.externalReferenceNo} onChange={(e) => set('externalReferenceNo', e.target.value)} className="input" /></Field>
      <Field label={t('list.editDialog.fields.carrierCode')}><input maxLength={50} value={form.carrierCode} onChange={(e) => set('carrierCode', e.target.value)} className="input" /></Field>
      <Field label={t('list.editDialog.fields.carrierName')}><input maxLength={200} value={form.carrierName} onChange={(e) => set('carrierName', e.target.value)} className="input" /></Field>
      <Field label={t('list.editDialog.fields.vehiclePlate')}><input maxLength={20} value={form.vehiclePlate} onChange={(e) => set('vehiclePlate', e.target.value)} className="input" /></Field>
      <Field label={t('list.editDialog.fields.trailerPlate')}><input maxLength={20} value={form.trailerPlate} onChange={(e) => set('trailerPlate', e.target.value)} className="input" /></Field>
      <Field label={t('list.editDialog.fields.driverName')}><input maxLength={200} value={form.driverName} onChange={(e) => set('driverName', e.target.value)} className="input" /></Field>
      <Field label={t('list.editDialog.fields.sealNo')}><input maxLength={100} value={form.sealNo} onChange={(e) => set('sealNo', e.target.value)} className="input" /></Field>
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={form.isEDispatch} onChange={(e) => set('isEDispatch', e.target.checked)} />{t('list.editDialog.eDispatch')}</label>
    </div>
    <Field label={t('list.editDialog.fields.description')}><textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} className="input h-auto py-3" /></Field>
    <p className="text-xs text-slate-500">{t('list.editDialog.lockedNotice')}</p>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4 py-2">{t('list.editDialog.cancel')}</button><button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{t('list.editDialog.save')}</button></div>
  </form></ResponsiveDialog>;
}

function LifecycleDialog({ value, close, completed }: { value: { row: ShipmentGridRow; kind: 'delete' | 'cancel' }; close: () => void; completed: () => void }) {
  const { t } = useModuleTranslation('warehouse-outbound');
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const run = async () => {
    if (value.kind === 'cancel' && !reason.trim()) { toast.error(t('list.errors.cancelReasonRequired')); return; }
    setBusy(true);
    try {
      if (value.kind === 'delete') await warehouseOutboundApi.deleteDraft(value.row.id); else await warehouseOutboundApi.cancel(value.row.id, reason);
      toast.success(value.kind === 'delete' ? t('list.toasts.deleted') : t('list.toasts.cancelled')); completed();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('list.errors.actionFailed')); }
    finally { setBusy(false); }
  };
  const title = value.kind === 'delete' ? t('list.lifecycleDialog.deleteTitle') : t('list.lifecycleDialog.cancelTitle');
  return <ResponsiveDialog onClose={close} title={title} description={t('list.lifecycleDialog.description', { documentNo: value.row.documentNo })} className="!max-w-lg border-rose-500/30"><h2 className="text-xl font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{t('list.lifecycleDialog.irreversibleNotice', { documentNo: value.row.documentNo })}</p>{value.kind === 'cancel' && <textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('list.lifecycleDialog.cancelReasonPlaceholder')} className="input mt-4 h-auto py-3" />}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4 py-2">{t('list.lifecycleDialog.cancel')}</button><button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">{busy ? t('list.lifecycleDialog.processing') : value.kind === 'delete' ? t('list.lifecycleDialog.confirmDelete') : t('list.lifecycleDialog.confirmCancel')}</button></div></ResponsiveDialog>;
}

function ShipmentDetailDialog({ detail, close }: { detail: ShipmentDetail; close: () => void }) {
  const { t } = useModuleTranslation('warehouse-outbound');
  return <ResponsiveDialog onClose={close} framed={false} title={t('list.detailDialog.title', { documentNo: detail.header.documentNo })} description={t('list.detailDialog.description')} className="!max-w-6xl"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-black">{detail.header.documentNo}</h2><p>{detail.header.customerCode} · {detail.header.customerName}</p></div><div className="flex items-center gap-2 self-end sm:self-auto">{detail.header.status !== 'Cancelled' && <Link to={`/warehouse/warehouse-outbounds/${detail.header.id}/operations`} className="inline-flex min-h-11 items-center rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950">{t('list.detailDialog.openOperation')}</Link>}<button type="button" onClick={close} aria-label={t('list.detailDialog.closeAria')} className="grid size-11 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X /></button></div></div><div className="mt-5 overflow-auto"><table className="min-w-[760px] w-full text-sm"><thead><tr><th>{t('list.detailDialog.columns.line')}</th><th>{t('list.detailDialog.columns.stock')}</th><th>{t('list.detailDialog.columns.plan')}</th><th>{t('list.detailDialog.columns.reserved')}</th><th>{t('list.detailDialog.columns.picked')}</th><th>{t('list.detailDialog.columns.packed')}</th><th>{t('list.detailDialog.columns.loaded')}</th><th>{t('list.detailDialog.columns.shipped')}</th></tr></thead><tbody>{detail.lines.map((line) => <tr key={line.id} className="border-t border-[var(--wms-app-border)]"><td>{line.lineNo}</td><td><StockIdentityCell layout="inline" stockId={line.stockId} stockCode={line.stockCode} stockName={line.stockName} branchCode={detail.header.branchCode} /></td><td>{formatProjectNumber(line.requestedQuantity)}</td><td>{formatProjectNumber(line.reservedQuantity)}</td><td>{formatProjectNumber(line.pickedQuantity)}</td><td>{formatProjectNumber(line.packedQuantity)}</td><td>{formatProjectNumber(line.loadedQuantity)}</td><td>{formatProjectNumber(line.shippedQuantity)}</td></tr>)}</tbody></table></div></ResponsiveDialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-semibold">{label}</span>{children}</label>; }
function localDateTime(value?: string) { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
function utc(value: string) { return value ? new Date(value).toISOString() : null; }
function clean(value: string) { return value.trim() || null; }
