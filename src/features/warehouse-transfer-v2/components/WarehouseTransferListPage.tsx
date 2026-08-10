import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Ban, Eye, Loader2, Pencil, PlayCircle, Save, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDateInput } from '@/components/shared/AppInput';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectDate, formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { useProductionTransferListCancel } from '@/features/production-transfer/hooks/useProductionTransferListCancel';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import {
  ProductionTransferCancelBlockedDialog,
  ProductionTransferCancelConfirmDialog,
} from '@/features/production-transfer/components/ProductionTransferCancelDialogs';
import {
  transferApiFor,
  type SubcontractingTransferDirection,
  type TransferApiVariant,
} from '../api/warehouse-transfer.api';
import type { WarehouseTransferDetail, WarehouseTransferGridRow } from '../types/warehouse-transfer.types';

type TransferClient = ReturnType<typeof transferApiFor>;
const G = 'dataGrid.transferRecords';

export function WarehouseTransferListPage({
  variant = 'warehouse',
  subcontractingDirection,
}: {
  variant?: TransferApiVariant;
  subcontractingDirection?: SubcontractingTransferDirection;
}): ReactElement {
  const { t, i18n } = useTranslation('common');
  const { can } = usePermissionAccess();
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const transferApi = useMemo(
    () => transferApiFor(variant, subcontractingDirection),
    [subcontractingDirection, variant],
  );
  const baseUrl = variant === 'production' ? '/warehouse/production-transfers'
    : variant === 'subcontracting' ? '/warehouse/subcontracting-transfers' : '/warehouse/transfers';
  const title = variant === 'production' ? t(`${G}.productionTitle`)
    : variant === 'subcontracting'
      ? subcontractingDirection === 'IssueToSupplier'
        ? t(`${G}.subcontractingIssueTitle`)
        : subcontractingDirection === 'ReceiptFromSupplier'
          ? t(`${G}.subcontractingReceiptTitle`)
          : t(`${G}.subcontractingGeneralTitle`)
      : t(`${G}.warehouseTitle`);
  const [detail, setDetail] = useState<WarehouseTransferDetail | null>(null);
  const [editDetail, setEditDetail] = useState<WarehouseTransferDetail | null>(null);
  const [lifecycle, setLifecycle] = useState<{ row: WarehouseTransferGridRow; kind: 'delete' | 'cancel' } | null>(null);
  const {
    precheckId: cancelPrecheckId,
    blocked: productionCancelBlocked,
    confirm: productionCancelConfirm,
    beginCancel: beginProductionCancel,
    closeBlocked,
    closeConfirm,
  } = useProductionTransferListCancel();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (id: number, mode: 'detail' | 'edit') => {
    setLoadingId(id);
    try {
      const result = await transferApi.detail(id);
      if (mode === 'detail') setDetail(result); else setEditDetail(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfer açılamadı.');
    } finally {
      setLoadingId(null);
    }
  }, [transferApi]);

  const beginCancel = useCallback(async (row: WarehouseTransferGridRow) => {
    if (variant !== 'production') {
      setLifecycle({ row, kind: 'cancel' });
      return;
    }
    await beginProductionCancel(row);
  }, [beginProductionCancel, variant]);

  const columns = useMemo<GridColumn<WarehouseTransferGridRow>[]>(() => [
    ...systemColumns<WarehouseTransferGridRow>(),
    { key: 'documentNo', label: t(`${G}.documentNo`), sortable: true, filterable: true, render: (row) => <span className="font-mono font-semibold">{row.documentNo}</span> },
    { key: 'documentDate', label: t(`${G}.documentDate`), sortable: true, filterable: true, render: (row) => formatProjectDate(row.documentDate) },
    { key: 'sourceWarehouseCode', label: t(`${G}.sourceWarehouseCode`), sortable: true, filterable: true, render: (row) => row.sourceWarehouseCode },
    { key: 'sourceWarehouseName', label: t(`${G}.sourceWarehouseName`), sortable: true, filterable: true, render: (row) => row.sourceWarehouseName },
    { key: 'targetWarehouseCode', label: t(`${G}.targetWarehouseCode`), sortable: true, filterable: true, render: (row) => row.targetWarehouseCode },
    { key: 'targetWarehouseName', label: t(`${G}.targetWarehouseName`), sortable: true, filterable: true, render: (row) => row.targetWarehouseName },
    { key: 'initiationMode', label: t(`${G}.flow`), sortable: true, filterable: true, render: (row) => row.initiationMode },
    { key: 'status', label: t(`${G}.status`), sortable: true, filterable: true, render: (row) => row.status },
    { key: 'lineCount', label: t(`${G}.lineCount`), sortable: true, filterable: true, render: (row) => row.lineCount },
    { key: 'requestedQuantity', label: t(`${G}.planned`), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.requestedQuantity) },
    { key: 'pickedQuantity', label: t(`${G}.picked`), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.pickedQuantity) },
    { key: 'shippedQuantity', label: t(`${G}.shipped`), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.shippedQuantity) },
    { key: 'receivedQuantity', label: t(`${G}.received`), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.receivedQuantity) },
    { key: 'putawayQuantity', label: t(`${G}.putaway`), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.putawayQuantity) },
    {
      key: 'actions', label: t(`${G}.actions`), ...requiredActionColumn,
      render: (row) => <div className="flex items-center gap-1">
        {row.status !== 'Cancelled' && <Link to={`${baseUrl}/${row.id}/operations`} title="Operasyonu yürüt" className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10"><PlayCircle className="size-4" /></Link>}
        {row.status === 'Draft' && <button type="button" title="Taslağı düzenle" onClick={() => void load(row.id, 'edit')} className="rounded-lg p-2 text-amber-500 hover:bg-amber-500/10"><Pencil className="size-4" /></button>}
        {row.status === 'Draft' && <button type="button" title="Taslağı sil" onClick={() => setLifecycle({ row, kind: 'delete' })} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>}
        {row.status !== 'Cancelled' && <button type="button" title="Transferi iptal et" disabled={cancelPrecheckId === row.id} onClick={() => void beginCancel(row)} className="rounded-lg p-2 text-orange-500 hover:bg-orange-500/10 disabled:opacity-50">{cancelPrecheckId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}</button>}
        <button type="button" title="Detayı göster" onClick={() => void load(row.id, 'detail')} className="rounded-lg p-2 text-violet-500 hover:bg-violet-500/10">{loadingId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}</button>
      </div>,
    },
  ], [baseUrl, beginCancel, cancelPrecheckId, gridLanguage, load, loadingId, t]);

  const refreshed = () => setRevision((value) => value + 1);
  return (
    <div data-no-auto-localize="true">
      <AdvancedDataGrid key={revision} pageKey={`${variant}-${subcontractingDirection ?? 'all'}-transfers`} title={title}
        description={t(`${G}.description`)}
        columns={columns} fetchPage={transferApi.paged} />
      {detail && <Detail detail={detail} baseUrl={baseUrl} close={() => setDetail(null)} />}
      {editDetail && <EditDraft api={transferApi} detail={editDetail} close={() => setEditDetail(null)} saved={() => { setEditDetail(null); refreshed(); }} />}
      {lifecycle && <LifecycleDialog api={transferApi} value={lifecycle} close={() => setLifecycle(null)} completed={() => { setLifecycle(null); refreshed(); }} />}
      {productionCancelBlocked && (
        <ProductionTransferCancelBlockedDialog
          documentNo={productionCancelBlocked.row.documentNo}
          transferId={productionCancelBlocked.row.id}
          readiness={productionCancelBlocked.readiness}
          canAssign={can('WMS.PRODUCTION_TRANSFER.ASSIGN')}
          onClose={closeBlocked}
          onReturnTasksStarted={() => {
            closeBlocked();
            refreshed();
          }}
        />
      )}
      {productionCancelConfirm && (
        <ProductionTransferCancelConfirmDialog
          documentNo={productionCancelConfirm.row.documentNo}
          transferId={productionCancelConfirm.row.id}
          sourceWarehouseId={productionCancelConfirm.sourceWarehouseId}
          policy={productionCancelConfirm.policy}
          onClose={closeConfirm}
          onCompleted={() => { closeConfirm(); refreshed(); }}
        />
      )}
    </div>
  );
}

function EditDraft({ api, detail, close, saved }: { api: TransferClient; detail: WarehouseTransferDetail; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({
    documentDate: detail.header.documentDate,
    plannedDispatchAtUtc: localDateTime(detail.header.plannedDispatchAtUtc),
    plannedArrivalAtUtc: localDateTime(detail.header.plannedArrivalAtUtc),
    priority: detail.header.priority,
    externalReferenceNo: detail.draft.externalReferenceNo ?? '',
    description: detail.draft.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.updateDraft(detail.header.id, {
        rowVersion: detail.rowVersion, documentDate: form.documentDate,
        sourceStagingLocationId: detail.draft.sourceStagingLocationId ?? null,
        targetReceivingLocationId: detail.draft.targetReceivingLocationId ?? null,
        targetPutawayLocationId: detail.draft.targetPutawayLocationId ?? null,
        plannedDispatchAtUtc: utc(form.plannedDispatchAtUtc), plannedArrivalAtUtc: utc(form.plannedArrivalAtUtc),
        priority: form.priority, externalReferenceNo: form.externalReferenceNo.trim() || null,
        description: form.description.trim() || null,
      });
      toast.success('Transfer taslağı güncellendi.'); saved();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Transfer güncellenemedi.'); }
    finally { setBusy(false); }
  };
  return <ResponsiveDialog onClose={close} title="Transfer taslağını düzenle" description={`${detail.header.documentNo} numaralı transfer taslağını düzenleyin.`} className="!max-w-2xl">
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <header className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Transfer taslağını düzenle</h2><p className="font-mono text-sm text-slate-500">{detail.header.documentNo}</p></div><button type="button" onClick={close} aria-label="Pencereyi kapat" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X /></button></header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Belge tarihi"><AppDateInput required value={form.documentDate} onChange={(e) => setForm({ ...form, documentDate: e.target.value })} /></Field>
        <Field label="Öncelik"><input type="number" min={1} max={5} required value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="input" /></Field>
        <Field label="Planlanan sevk"><AppDateInput type="datetime-local" value={form.plannedDispatchAtUtc} onChange={(e) => setForm({ ...form, plannedDispatchAtUtc: e.target.value })} /></Field>
        <Field label="Planlanan varış"><AppDateInput type="datetime-local" value={form.plannedArrivalAtUtc} onChange={(e) => setForm({ ...form, plannedArrivalAtUtc: e.target.value })} /></Field>
        <Field label="Dış referans"><input maxLength={100} value={form.externalReferenceNo} onChange={(e) => setForm({ ...form, externalReferenceNo: e.target.value })} className="input" /></Field>
      </div>
      <Field label="Açıklama"><textarea rows={4} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input h-auto py-3" /></Field>
      <p className="text-xs text-slate-500">Depo, raf, stok ve miktar alanları operasyon bütünlüğü için bu ekranda değiştirilemez.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4 py-2">Vazgeç</button><button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Kaydet</button></div>
    </form>
  </ResponsiveDialog>;
}

function LifecycleDialog({ api, value, close, completed }: { api: TransferClient; value: { row: WarehouseTransferGridRow; kind: 'delete' | 'cancel' }; close: () => void; completed: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (value.kind === 'cancel' && !reason.trim()) { toast.error('İptal nedeni zorunludur.'); return; }
    setBusy(true);
    try {
      if (value.kind === 'delete') await api.deleteDraft(value.row.id);
      else await api.cancel(value.row.id, reason);
      toast.success(value.kind === 'delete' ? 'Transfer taslağı silindi.' : 'Transfer iptal edildi; stok hareketleri ters çevrildi.');
      completed();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };
  const title = value.kind === 'delete' ? 'Taslağı sil' : 'Transferi iptal et';
  return <ResponsiveDialog onClose={close} title={title} description={`${value.row.documentNo} için geri alınamaz işlem onayı.`} className="!max-w-lg border-rose-500/30">
    <h2 className="text-xl font-black">{value.kind === 'delete' ? 'Taslağı sil' : 'Transferi iptal et'}</h2>
    <p className="mt-2 text-sm text-slate-500">{value.row.documentNo} için işlem geri alınamaz. Hareket görmüş belgede iptal, ters stok hareketlerini tek transaction içinde oluşturur.</p>
    {value.kind === 'cancel' && <textarea autoFocus rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="İptal nedenini yazın" className="input mt-4 h-auto py-3" />}
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4 py-2">Vazgeç</button><button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">{busy ? 'İşleniyor…' : value.kind === 'delete' ? 'Taslağı Sil' : 'İptal Et'}</button></div>
  </ResponsiveDialog>;
}

function Detail({ detail, baseUrl, close }: { detail: WarehouseTransferDetail; baseUrl: string; close: () => void }): ReactElement {
  const header = detail.header;
  return <ResponsiveDialog onClose={close} framed={false} title={`Transfer ${header.documentNo}`} description="Transfer kalemleri ve operasyon ilerlemesi." className="!max-w-6xl">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-black">{header.documentNo}</h2><p className="text-sm text-slate-500">{header.sourceWarehouseCode} {header.sourceWarehouseName} → {header.targetWarehouseCode} {header.targetWarehouseName}</p></div><div className="flex items-center gap-2 self-end sm:self-auto">{header.status !== 'Cancelled' && <Link to={`${baseUrl}/${header.id}/operations`} className="inline-flex min-h-11 items-center rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950">Operasyonu aç</Link>}<button type="button" onClick={close} aria-label="Pencereyi kapat" className="grid size-11 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="size-5" /></button></div></header>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><Info label="Durum" value={localizeEnumValue(header.status)} /><Info label="Onay" value={localizeEnumValue(header.approvalStatus)} /><Info label="Belge tarihi" value={formatProjectDate(header.documentDate)} /><Info label="Planlanan varış" value={header.plannedArrivalAtUtc ? formatProjectDateTime(header.plannedArrivalAtUtc) : '—'} /></div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]"><table className="w-full text-sm"><thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">#</th><th className="p-3">Stok</th><th className="p-3">YAP</th><th className="p-3 text-right">Plan</th><th className="p-3 text-right">Rezerve</th><th className="p-3 text-right">Toplanan</th><th className="p-3 text-right">Sevk</th><th className="p-3 text-right">Alınan</th><th className="p-3">Durum</th></tr></thead><tbody>{detail.lines.map((line) => <tr key={line.id} className="border-t border-[var(--wms-app-border)]"><td className="p-3">{line.lineNo}</td><td className="p-3"><StockIdentityCell stockId={line.stockId} stockCode={line.stockCode} stockName={line.stockName} branchCode={header.branchCode} /></td><td className="p-3">{line.yapCode || '—'}</td><td className="p-3 text-right">{formatProjectNumber(line.requestedQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(line.reservedQuantity ?? 0)}</td><td className="p-3 text-right">{formatProjectNumber(line.pickedQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(line.shippedQuantity)}</td><td className="p-3 text-right">{formatProjectNumber(line.receivedQuantity)}</td><td className="p-3">{localizeEnumValue(line.status)}</td></tr>)}</tbody></table></div>
  </ResponsiveDialog>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--wms-app-border)] p-3"><div className="text-xs text-slate-500">{label}</div><strong className="mt-1 block text-sm">{value}</strong></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-semibold">{label}</span>{children}</label>; }
function localDateTime(value?: string) { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
function utc(value: string) { return value ? new Date(value).toISOString() : null; }
