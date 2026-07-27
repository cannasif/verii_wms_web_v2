import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, Eye, Loader2, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { stockMovementsApi } from '../api/stock-movements.api';
import type { LocationOption, PostStockMovementRequest, StockMovementDetail, StockMovementGridRow, StockOption, WarehouseOption } from '../types/stock-movement.types';

const G = 'dataGrid.stockMovements';
const P = 'stockMovementsPage';
const OPERATION_TYPES = ['Receipt', 'Shipment', 'Transfer', 'AdjustmentIncrease', 'AdjustmentDecrease', 'CustomerReturn', 'SupplierReturn', 'Reversal'] as const;
const incoming = new Set(['Receipt', 'AdjustmentIncrease', 'CustomerReturn']);
const outgoing = new Set(['Shipment', 'AdjustmentDecrease', 'SupplierReturn']);
type FormState = { idempotencyKey: string; operationType: string; referenceType: string; referenceNo: string; reason: string; description: string; stockId: string; yapCodeId: string; quantity: string; sourceWarehouseId: string; sourceLocationId: string; targetWarehouseId: string; targetLocationId: string; unitCode: string; lotNo: string; serialNo: string; stockStatus: string };
const newForm = (): FormState => ({ idempotencyKey: crypto.randomUUID(), operationType: 'Receipt', referenceType: 'Manual', referenceNo: '', reason: '', description: '', stockId: '', yapCodeId: '', quantity: '', sourceWarehouseId: '', sourceLocationId: '', targetWarehouseId: '', targetLocationId: '', unitCode: '', lotNo: '', serialNo: '', stockStatus: 'Available' });
const nullable = (value: string) => value.trim() || null;

export function StockMovementsPage() {
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const { can, isLoading, isError } = usePermissionAccess();
  const allow = useCallback((permission: string) => isLoading || isError || can(permission), [can, isError, isLoading]);
  const typeLabel = useCallback((type: string) => t(`${P}.operationTypes.${type}`, { defaultValue: type }), [t]);
  const movementStatusLabel = useCallback((status: string) => t(`${P}.movementStatuses.${status}`, { defaultValue: status }), [t]);
  const [formOpen, setFormOpen] = useState(false); const [form, setForm] = useState<FormState>(newForm());
  const [stocks, setStocks] = useState<StockOption[]>([]); const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [sourceLocations, setSourceLocations] = useState<LocationOption[]>([]); const [targetLocations, setTargetLocations] = useState<LocationOption[]>([]);
  const [detail, setDetail] = useState<StockMovementDetail | null>(null); const [loadingDetail, setLoadingDetail] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<StockMovementGridRow | null>(null); const [reverseReason, setReverseReason] = useState(''); const [saving, setSaving] = useState(false);

  const openCreate = useCallback(async () => { setForm(newForm()); setFormOpen(true); try { const [stockRows, warehouseRows] = await Promise.all([stockMovementsApi.getStocks(), stockMovementsApi.getWarehouses()]); setStocks(stockRows); setWarehouses(warehouseRows); } catch (error) { toast.error(error instanceof Error ? error.message : t(`${P}.toast.optionsFailed`)); setFormOpen(false); } }, [t]);
  const setValue = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const selectWarehouse = async (side: 'source' | 'target', value: string) => { setValue(side === 'source' ? 'sourceWarehouseId' : 'targetWarehouseId', value); setValue(side === 'source' ? 'sourceLocationId' : 'targetLocationId', ''); if (!value) { if (side === 'source') setSourceLocations([]); else setTargetLocations([]); return; } try { const rows = await stockMovementsApi.getLocations(Number(value)); if (side === 'source') setSourceLocations(rows); else setTargetLocations(rows); } catch (error) { toast.error(error instanceof Error ? error.message : t(`${P}.toast.locationsFailed`)); } };
  const submit = async (event: FormEvent) => { event.preventDefault(); const qty = Number(form.quantity); if (!form.stockId || !Number.isFinite(qty) || qty <= 0) { toast.error(t(`${P}.toast.stockQtyRequired`)); return; } if (!form.unitCode) { toast.error(t(`${P}.toast.unitRequired`)); return; } const needsSource = outgoing.has(form.operationType) || form.operationType === 'Transfer'; const needsTarget = incoming.has(form.operationType) || form.operationType === 'Transfer'; if ((needsSource && (!form.sourceWarehouseId || !form.sourceLocationId)) || (needsTarget && (!form.targetWarehouseId || !form.targetLocationId))) { toast.error(t(`${P}.toast.warehouseLocationRequired`)); return; } setSaving(true); try { const payload: PostStockMovementRequest = { idempotencyKey: form.idempotencyKey, operationType: form.operationType, referenceType: nullable(form.referenceType), referenceNo: nullable(form.referenceNo), referenceId: null, occurredAt: null, reason: nullable(form.reason), description: nullable(form.description), lines: [{ stockId: Number(form.stockId), yapCodeId: form.yapCodeId ? Number(form.yapCodeId) : null, quantity: qty, sourceWarehouseId: needsSource ? Number(form.sourceWarehouseId) : null, sourceLocationId: needsSource ? Number(form.sourceLocationId) : null, targetWarehouseId: needsTarget ? Number(form.targetWarehouseId) : null, targetLocationId: needsTarget ? Number(form.targetLocationId) : null, unitCode: form.unitCode, lotNo: nullable(form.lotNo), serialNo: nullable(form.serialNo), stockStatus: form.stockStatus }] }; await stockMovementsApi.post(payload); toast.success(t(`${P}.toast.saveSuccess`)); setFormOpen(false); await Promise.all([queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'stock-movements'] }), queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'location-stock-balances'] }), queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'warehouse-stock-balances'] })]); } catch (error) { toast.error(error instanceof Error ? error.message : t(`${P}.toast.saveFailed`)); } finally { setSaving(false); } };
  const openDetail = useCallback(async (row: StockMovementGridRow) => { setLoadingDetail(true); try { setDetail(await stockMovementsApi.getById(row.id)); } catch (error) { toast.error(error instanceof Error ? error.message : t(`${P}.toast.detailFailed`)); } finally { setLoadingDetail(false); } }, [t]);
  const reverse = async () => { if (!reverseTarget || reverseReason.trim().length < 3) { toast.error(t(`${P}.toast.reverseReasonRequired`)); return; } setSaving(true); try { await stockMovementsApi.reverse(reverseTarget.id, crypto.randomUUID(), reverseReason.trim()); toast.success(t(`${P}.toast.reverseSuccess`)); setReverseTarget(null); setReverseReason(''); await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'stock-movements'] }); } catch (error) { toast.error(error instanceof Error ? error.message : t(`${P}.toast.reverseFailed`)); } finally { setSaving(false); } };

  const columns = useMemo<GridColumn<StockMovementGridRow>[]>(() => [
    ...systemColumns<StockMovementGridRow>(),
    { key: 'operationCode', label: t(`${G}.operationCode`), render: r => <code className="text-xs">{r.operationCode}</code> },
    { key: 'operationType', label: t(`${G}.operationType`), render: r => <span className="font-semibold">{typeLabel(r.operationType)}</span> },
    { key: 'status', label: t(`${G}.status`), render: r => <span className={`rounded-full px-2 py-1 text-xs font-semibold ${r.status === 'Reversed' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{movementStatusLabel(r.status === 'Reversed' ? 'Reversed' : 'Posted')}</span> },
    { key: 'referenceNo', label: t(`${G}.referenceNo`), render: r => r.referenceNo ? <span>{r.referenceType} / {r.referenceNo}</span> : '-' },
    { key: 'occurredAt', label: t(`${G}.occurredAt`), render: r => formatProjectDateTime(r.occurredAt) },
    { key: 'entryCount', label: t(`${G}.entryCount`), render: r => r.entryCount },
    { key: 'inboundQuantity', label: t(`${G}.inboundQuantity`), render: r => <span className="font-semibold text-emerald-600">+{r.inboundQuantity}</span> },
    { key: 'outboundQuantity', label: t(`${G}.outboundQuantity`), render: r => <span className="font-semibold text-red-600">-{r.outboundQuantity}</span> },
    { key: 'reason', label: t(`${G}.reason`), render: r => r.reason || '-' },
    { key: 'actions', label: t(`${G}.actions`), sortable: false, filterable: false, hideable: false, render: r => <div className="flex gap-1"><button type="button" title={t(`${G}.viewDetail`)} onClick={() => openDetail(r)} className="rounded-lg border p-2 text-cyan-600"><Eye className="size-4" /></button>{allow('WMS.STOCK_MOVEMENTS.REVERSE') && r.operationType !== 'Reversal' && r.status !== 'Reversed' && <button type="button" title={t(`${G}.reverseAction`)} onClick={() => setReverseTarget(r)} className="rounded-lg border p-2 text-amber-600"><RotateCcw className="size-4" /></button>}</div> },
  ], [allow, movementStatusLabel, openDetail, t, typeLabel, gridLanguage]);
  const needsSource = outgoing.has(form.operationType) || form.operationType === 'Transfer'; const needsTarget = incoming.has(form.operationType) || form.operationType === 'Transfer';
  const operationOptions = useMemo(() => OPERATION_TYPES.filter(key => key !== 'Reversal').map(value => ({ value, label: typeLabel(value) })), [typeLabel]);
  const stockStatusOptions = useMemo(() => (['Available', 'Quarantine', 'Blocked'] as const).map(value => ({ value, label: t(`${P}.stockStatuses.${value}`) })), [t]);

  return <div data-no-auto-localize="true">
    <AdvancedDataGrid pageKey="stock-movements" title={t(`${G}.title`)} description={t(`${G}.description`)} columns={columns} fetchPage={stockMovementsApi.getPaged} toolbarAction={allow('WMS.STOCK_MOVEMENTS.POST') ? { label: t(`${G}.toolbarAction`), run: openCreate } : undefined} />
    {formOpen && (
      <Dialog open onOpenChange={open => { if (!open && !saving) setFormOpen(false); }}>
        <OpsDialogContent size="xl" className="data-no-auto-localize">
          <OpsDialogHeader>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{t(`${P}.formTitle`)}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{t(`${P}.formDescription`)}</p>
            </div>
          </OpsDialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <OpsDialogBody className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label={t(`${P}.operationType`)}><AppDropdown value={form.operationType} onValueChange={(value) => { setForm(current => ({ ...newForm(), idempotencyKey: current.idempotencyKey, operationType: value })); setSourceLocations([]); setTargetLocations([]); }} options={operationOptions} ariaLabel={t(`${P}.operationType`)} /></Field>
                <Field label={t(`${P}.stock`)}><AppDropdown value={form.stockId} onValueChange={(value) => { const selected = stocks.find(item => String(item.id) === value); setForm(current => ({ ...current, stockId: value, unitCode: selected?.unitCode ?? '' })); }} options={stocks.map((item) => ({ value: String(item.id), label: `${item.erpStockCode} - ${item.stockName}`, description: item.unitCode ? t(`${P}.unitLabel`, { unit: item.unitCode }) : t(`${P}.unitUndefined`) }))} placeholder={t(`${P}.selectStock`)} ariaLabel={t(`${P}.stock`)} searchable /></Field>
                <Field label={t(`${P}.quantity`)}><input type="number" min="0.000001" step="0.000001" value={form.quantity} onChange={e => setValue('quantity', e.target.value)} className="input" /></Field>
              </div>
              {needsSource && <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold text-red-600"><ArrowUpFromLine className="size-4" />{t(`${P}.sourceSection`)}</h3><div className="grid gap-4 sm:grid-cols-2"><Field label={t(`${P}.sourceWarehouse`)}><AppDropdown value={form.sourceWarehouseId} onValueChange={(value) => void selectWarehouse('source', value)} options={warehouses.map((item) => ({ value: String(item.id), label: `${item.warehouseCode} - ${item.warehouseName}` }))} placeholder={t(`${P}.selectWarehouse`)} ariaLabel={t(`${P}.sourceWarehouse`)} searchable /></Field><Field label={t(`${P}.sourceLocation`)}><AppDropdown value={form.sourceLocationId} onValueChange={(value) => setValue('sourceLocationId', value)} options={sourceLocations.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` }))} placeholder={t(`${P}.selectLocation`)} ariaLabel={t(`${P}.sourceLocation`)} searchable /></Field></div></section>}
              {needsTarget && <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-600"><ArrowDownToLine className="size-4" />{t(`${P}.targetSection`)}</h3><div className="grid gap-4 sm:grid-cols-2"><Field label={t(`${P}.targetWarehouse`)}><AppDropdown value={form.targetWarehouseId} onValueChange={(value) => void selectWarehouse('target', value)} options={warehouses.map((item) => ({ value: String(item.id), label: `${item.warehouseCode} - ${item.warehouseName}` }))} placeholder={t(`${P}.selectWarehouse`)} ariaLabel={t(`${P}.targetWarehouse`)} searchable /></Field><Field label={t(`${P}.targetLocation`)}><AppDropdown value={form.targetLocationId} onValueChange={(value) => setValue('targetLocationId', value)} options={targetLocations.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` }))} placeholder={t(`${P}.selectLocation`)} ariaLabel={t(`${P}.targetLocation`)} searchable /></Field></div></section>}
              <div className="grid gap-4 md:grid-cols-4">
                <Field label={t(`${P}.unit`)}><div className={`input flex items-center font-bold ${form.unitCode ? 'text-cyan-600' : 'text-amber-600'}`}>{form.unitCode || t(`${P}.selectStockFirst`)}</div></Field>
                <Field label={t(`${P}.lot`)}><input value={form.lotNo} maxLength={100} onChange={e => setValue('lotNo', e.target.value)} className="input" /></Field>
                <Field label={t(`${P}.serial`)}><input value={form.serialNo} maxLength={100} onChange={e => setValue('serialNo', e.target.value)} className="input" /></Field>
                <Field label={t(`${P}.stockStatus`)}><AppDropdown value={form.stockStatus} onValueChange={(value) => setValue('stockStatus', value)} options={stockStatusOptions} ariaLabel={t(`${P}.stockStatus`)} /></Field>
                <Field label={t(`${P}.referenceType`)}><input value={form.referenceType} maxLength={50} onChange={e => setValue('referenceType', e.target.value)} className="input" /></Field>
                <Field label={t(`${P}.referenceNo`)}><input value={form.referenceNo} maxLength={100} onChange={e => setValue('referenceNo', e.target.value)} className="input" /></Field>
                <Field label={t(`${P}.reason`)}><input value={form.reason} maxLength={500} onChange={e => setValue('reason', e.target.value)} className="input" /></Field>
                <Field label={t(`${P}.idempotency`)}><input readOnly value={form.idempotencyKey} className="input font-mono text-xs opacity-70" /></Field>
              </div>
              <Field label={t(`${P}.description`)}><textarea value={form.description} maxLength={1000} rows={3} onChange={e => setValue('description', e.target.value)} className="w-full rounded-xl border bg-transparent px-3 py-2" /></Field>
            </OpsDialogBody>
            <OpsDialogFooter>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border px-4 py-2">{t(`${P}.cancel`)}</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{t(`${P}.save`)}</button>
            </OpsDialogFooter>
          </form>
        </OpsDialogContent>
      </Dialog>
    )}
    {(detail || loadingDetail) && (
      <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}>
        <OpsDialogContent size="xl" className="data-no-auto-localize">
          {!detail ? (
            <OpsDialogBody>
              <div className="grid h-48 place-items-center"><Loader2 className="size-7 animate-spin" /></div>
            </OpsDialogBody>
          ) : (
            <>
              <OpsDialogHeader>
                <DialogTitle className="wms-ops-detail-dialog__title">{t(`${P}.detailTitle`, { id: detail.id })}</DialogTitle>
              </OpsDialogHeader>
              <OpsDialogBody>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Info label={t(`${P}.detailCode`)} value={detail.operationCode} />
                  <Info label={t(`${P}.detailType`)} value={typeLabel(detail.operationType)} />
                  <Info label={t(`${P}.detailReference`)} value={detail.referenceNo || '-'} />
                  <Info label={t(`${P}.detailTime`)} value={formatProjectDateTime(detail.occurredAt)} />
                </div>
                <div className="mt-5 overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead><tr className="bg-slate-100 dark:bg-white/[.05]"><th className="p-3 text-left">{t(`${P}.detailLine`)}</th><th className="p-3 text-left">{t(`${P}.detailStock`)}</th><th className="p-3 text-left">{t(`${P}.detailWarehouseLocation`)}</th><th className="p-3 text-left">{t(`${P}.detailLotSerial`)}</th><th className="p-3 text-right">{t(`${P}.detailQuantity`)}</th></tr></thead>
                    <tbody>{detail.entries.map(e => <tr key={e.id} className="border-t"><td className="p-3">{e.lineNo}</td><td className="p-3"><strong>{e.stockCode}</strong><small className="block text-slate-500">{e.stockName}</small></td><td className="p-3">{e.warehouseCode} / {e.locationCode}</td><td className="p-3">{e.lotNo || '-'} / {e.serialNo || '-'}</td><td className={`p-3 text-right font-bold ${e.quantityDelta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{e.quantityDelta > 0 ? '+' : ''}{formatProjectNumber(e.quantityDelta)} {e.unitCode}</td></tr>)}</tbody>
                  </table>
                </div>
              </OpsDialogBody>
            </>
          )}
        </OpsDialogContent>
      </Dialog>
    )}
    {reverseTarget && (
      <Dialog open onOpenChange={open => { if (!open && !saving) setReverseTarget(null); }}>
        <OpsDialogContent size="md" className="wms-ops-delete-dialog data-no-auto-localize">
          <OpsDialogHeader>
            <DialogTitle className="wms-ops-detail-dialog__title wms-ops-delete-dialog__title">{t(`${P}.reverseTitle`)}</DialogTitle>
          </OpsDialogHeader>
          <OpsDialogBody className="wms-ops-delete-dialog__body space-y-4">
            <p className="wms-ops-delete-dialog__message text-sm text-slate-500">{t(`${P}.reverseDescription`, { id: reverseTarget.id })}</p>
            <textarea autoFocus value={reverseReason} onChange={e => setReverseReason(e.target.value)} rows={3} maxLength={500} placeholder={t(`${P}.reverseReasonPlaceholder`)} className="w-full rounded-xl border bg-transparent p-3" />
          </OpsDialogBody>
          <OpsDialogFooter className="wms-ops-delete-dialog__footer">
            <button type="button" onClick={() => setReverseTarget(null)} className="rounded-xl border px-4 py-2">{t(`${P}.cancel`)}</button>
            <button type="button" disabled={saving} onClick={reverse} className="wms-ops-action-btn wms-ops-delete-btn rounded-xl bg-amber-600 px-4 py-2 text-white">{t(`${P}.reverseButton`)}</button>
          </OpsDialogFooter>
        </OpsDialogContent>
      </Dialog>
    )}
  </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 break-all text-sm">{value}</p></div> }
