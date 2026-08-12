import { useCallback, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ClipboardCheck,
  Eye,
  Loader2,
  MapPin,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { locationsApi } from '@/features/locations/api/locations.api';
import type { LocationLookupRow, WarehouseOption } from '@/features/locations/types/location.types';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { useAuthStore } from '@/stores/auth-store';
import { inventoryCountApi } from './api';
import type {
  CreateInventoryCountDraftRequest,
  InventoryCountGridRow,
  InventoryCountMode,
  InventoryCountMovementPolicy,
  InventoryCountPreviewResult,
  InventoryCountStatus,
  InventoryCountType,
} from './types';

type FormState = {
  warehouseId: string;
  countType: InventoryCountType;
  countMode: InventoryCountMode;
  movementPolicy: InventoryCountMovementPolicy;
  priority: string;
  plannedStart: string;
  plannedEnd: string;
  quantityTolerance: string;
  percentageTolerance: string;
  maxCountAttempts: string;
  requireIndependentRecount: boolean;
  allowUnexpectedStock: boolean;
  autoApproveWithinTolerance: boolean;
  includeEmptyLocations: boolean;
  includeDescendants: boolean;
  locations: LocationLookupRow[];
  description: string;
};

const emptyForm = (): FormState => ({
  warehouseId: '',
  countType: 'Cycle',
  countMode: 'Blind',
  movementPolicy: 'SnapshotWithMovementReconciliation',
  priority: '3',
  plannedStart: '',
  plannedEnd: '',
  quantityTolerance: '0',
  percentageTolerance: '0',
  maxCountAttempts: '2',
  requireIndependentRecount: true,
  allowUnexpectedStock: true,
  autoApproveWithinTolerance: true,
  includeEmptyLocations: false,
  includeDescendants: true,
  locations: [],
  description: '',
});

const canPrepare = (status: InventoryCountStatus): boolean => status === 'Draft' || status === 'Planned';

export function InventoryCountPage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('inventory-count');
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locationValue, setLocationValue] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<InventoryCountGridRow | null>(null);
  const [preview, setPreview] = useState<InventoryCountPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryCountGridRow | null>(null);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'inventory-count-v2'] });
  }, [queryClient]);

  const typeOptions = useMemo(() => (['FullPhysical', 'Cycle', 'Spot', 'ZeroCheck', 'Partial'] as InventoryCountType[])
    .map((value) => ({ value, label: t(`types.${value}`) })), [t]);
  const modeOptions = useMemo(() => (['Blind', 'Open', 'DoubleBlind'] as InventoryCountMode[])
    .map((value) => ({ value, label: t(`modes.${value}`) })), [t]);
  const movementOptions = useMemo(() => (['Snapshot', 'SnapshotWithMovementReconciliation', 'LocationFreeze'] as InventoryCountMovementPolicy[])
    .map((value) => ({ value, label: t(`movementPolicies.${value}`) })), [t]);

  const openCreate = useCallback(async () => {
    setForm(emptyForm());
    setLocationValue(null);
    setFormError(null);
    setFormOpen(true);
  }, []);

  const addLocation = async (value: string): Promise<void> => {
    setLocationValue(value);
    const id = Number(value);
    if (!id || form.locations.some((item) => item.id === id)) return;
    try {
      const location = await locationsApi.getById(id);
      setForm((current) => ({
        ...current,
        locations: [...current.locations, {
          id: location.id,
          warehouseId: location.warehouseId,
          code: location.code,
          name: location.name,
          locationType: location.locationType,
          barcode: location.barcode,
          parentLocationId: location.parentLocationId,
        }],
      }));
      setLocationValue(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('messages.locationLoadFailed'));
    }
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const warehouseId = Number(form.warehouseId);
    const priority = Number(form.priority);
    const maxCountAttempts = Number(form.maxCountAttempts);
    const quantityTolerance = Number(form.quantityTolerance);
    const percentageTolerance = Number(form.percentageTolerance);
    if (!warehouseId) { setFormError(t('validation.warehouse')); return; }
    if (form.countType === 'Partial' && form.locations.length === 0) { setFormError(t('validation.partialScope')); return; }
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) { setFormError(t('validation.priority')); return; }
    if (!Number.isInteger(maxCountAttempts) || maxCountAttempts < 1 || maxCountAttempts > 10) { setFormError(t('validation.attempts')); return; }
    if (quantityTolerance < 0 || percentageTolerance < 0 || percentageTolerance > 100) { setFormError(t('validation.tolerance')); return; }
    if (form.plannedEnd && form.plannedStart && new Date(form.plannedEnd) < new Date(form.plannedStart)) {
      setFormError(t('validation.dateRange')); return;
    }

    const payload: CreateInventoryCountDraftRequest = {
      branchCode,
      warehouseId,
      documentSeriesId: null,
      countType: form.countType,
      countMode: form.countMode,
      movementPolicy: form.movementPolicy,
      priority,
      plannedStartUtc: form.plannedStart ? new Date(form.plannedStart).toISOString() : null,
      plannedEndUtc: form.plannedEnd ? new Date(form.plannedEnd).toISOString() : null,
      quantityTolerance,
      percentageTolerance,
      maxCountAttempts,
      requireIndependentRecount: form.requireIndependentRecount,
      allowUnexpectedStock: form.allowUnexpectedStock,
      autoApproveWithinTolerance: form.autoApproveWithinTolerance,
      includeEmptyLocations: form.includeEmptyLocations,
      description: form.description.trim() || null,
      scopes: form.locations.map((location) => ({
        locationId: location.id,
        stockId: null,
        yapCodeId: null,
        stockGroupCode: null,
        includeDescendantLocations: form.includeDescendants,
        includeEmptyLocations: form.includeEmptyLocations,
      })),
    };

    setSaving(true); setFormError(null);
    try {
      await inventoryCountApi.createDraft(payload);
      toast.success(t('messages.draftCreated'));
      setFormOpen(false);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.saveFailed');
      setFormError(message); toast.error(message);
    } finally { setSaving(false); }
  };

  const openPreview = useCallback(async (row: InventoryCountGridRow) => {
    setPreviewRow(row); setPreview(null); setPreviewLoading(true);
    try { setPreview(await inventoryCountApi.preview(row.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('messages.previewFailed')); setPreviewRow(null); }
    finally { setPreviewLoading(false); }
  }, [t]);

  const release = async (): Promise<void> => {
    if (!previewRow) return;
    setPreviewLoading(true);
    try {
      const result = await inventoryCountApi.release(previewRow.id, previewRow.concurrencyToken);
      toast.success(t('messages.released', { taskCount: result.taskCount, lineCount: result.lineCount }));
      setPreviewRow(null); setPreview(null); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('messages.releaseFailed')); }
    finally { setPreviewLoading(false); }
  };

  const remove = async (): Promise<void> => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await inventoryCountApi.deleteDraft(deleteTarget.id); toast.success(t('messages.deleted')); setDeleteTarget(null); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('messages.deleteFailed')); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<InventoryCountGridRow>[]>(() => moduleReady ? [
    ...systemColumns<InventoryCountGridRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    { key: 'documentNo', label: t('columns.documentNo'), searchable: true, defaultSearch: true, render: (row) => <span className="font-mono font-semibold text-[var(--wms-brand-primary)]">{row.documentNo}</span> },
    { key: 'warehouseCode', label: t('columns.warehouseCode'), searchable: true, defaultSearch: true, render: (row) => row.warehouseCode },
    { key: 'warehouseName', label: t('columns.warehouseName'), searchable: true, defaultSearch: true, render: (row) => row.warehouseName },
    { key: 'countType', label: t('columns.countType'), filterType: 'enum', filterOptions: typeOptions, contextValue: (row) => t(`types.${row.countType}`), render: (row) => t(`types.${row.countType}`) },
    { key: 'countMode', label: t('columns.countMode'), filterType: 'enum', filterOptions: modeOptions, contextValue: (row) => t(`modes.${row.countMode}`), render: (row) => t(`modes.${row.countMode}`) },
    { key: 'status', label: t('columns.status'), filterType: 'enum', filterOptions: statusOptions(t), contextValue: (row) => t(`statuses.${row.status}`), render: (row) => <StatusBadge status={row.status} text={t(`statuses.${row.status}`)} /> },
    { key: 'priority', label: t('columns.priority'), filterType: 'number', render: (row) => row.priority },
    { key: 'taskCount', label: t('columns.tasks'), filterType: 'number', render: (row) => `${row.completedTaskCount}/${row.taskCount}` },
    { key: 'lineCount', label: t('columns.lines'), filterType: 'number', render: (row) => `${row.countedLineCount}/${row.lineCount}` },
    { key: 'varianceLineCount', label: t('columns.variances'), filterType: 'number', render: (row) => row.varianceLineCount },
    { key: 'plannedStartUtc', label: t('columns.plannedStart'), filterType: 'datetime', contextValue: (row) => row.plannedStartUtc ? formatProjectDateTime(row.plannedStartUtc) : '-', render: (row) => row.plannedStartUtc ? formatProjectDateTime(row.plannedStartUtc) : '-' },
    { key: 'snapshotAtUtc', label: t('columns.snapshotAt'), filterType: 'datetime', contextValue: (row) => row.snapshotAtUtc ? formatProjectDateTime(row.snapshotAtUtc) : '-', render: (row) => row.snapshotAtUtc ? formatProjectDateTime(row.snapshotAtUtc) : '-' },
    { key: 'description', label: t('columns.description'), searchable: true, defaultSearch: false, render: (row) => row.description || '-' },
    { key: 'actions', label: t('columns.actions'), ...requiredActionColumn, render: (row) => <div className="flex items-center gap-1">
      {canPrepare(row.status) && can('WMS.INVENTORY_COUNT.CREATE') ? <button type="button" title={t('actions.preview')} onClick={() => void openPreview(row)} className="rounded-lg border p-2 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"><Eye className="size-4" /></button> : null}
      {canPrepare(row.status) && can('WMS.INVENTORY_COUNT.UPDATE') ? <button type="button" title={t('actions.delete')} onClick={() => setDeleteTarget(row)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="size-4" /></button> : null}
    </div> },
  ] : [], [can, modeOptions, moduleReady, openPreview, t, typeOptions]);

  if (!moduleReady) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>;

  return <>
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <WorkflowCard icon={<ClipboardCheck className="size-5" />} title={t('workflow.snapshotTitle')} text={t('workflow.snapshotText')} />
        <WorkflowCard icon={<ShieldCheck className="size-5" />} title={t('workflow.blindTitle')} text={t('workflow.blindText')} />
        <WorkflowCard icon={<AlertTriangle className="size-5" />} title={t('workflow.varianceTitle')} text={t('workflow.varianceText')} />
      </div>
      <AdvancedDataGrid<InventoryCountGridRow>
        pageKey="inventory-count-v2"
        title={t('page.title')}
        description={t('page.description')}
        columns={columns}
        fetchPage={inventoryCountApi.paged}
        emptyMessage={t('page.empty')}
        toolbarAction={can('WMS.INVENTORY_COUNT.CREATE') ? { label: t('page.newAction'), run: openCreate, icon: <Plus className="size-4" /> } : undefined}
      />
    </section>

    <Dialog open={formOpen} onOpenChange={(open) => { if (!open && !saving) setFormOpen(false); }}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white"><ClipboardCheck className="size-5" /></div><div><DialogTitle>{t('form.title')}</DialogTitle><DialogDescription>{t('form.description')}</DialogDescription></div></div></OpsDialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <OpsDialogBody className="space-y-5">
            {formError ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{formError}</div> : null}
            <FormSection title={t('form.sections.identity')}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label={t('form.warehouse')} required><PagedAppDropdown<WarehouseOption> value={form.warehouseId || null} onValueChange={(value) => setForm((current) => ({ ...current, warehouseId: value, locations: [] }))} queryKey={['inventory-count-warehouses', branchCode]} fetchPage={(request) => inventoryCountApi.warehouses(request, branchCode)} toOption={(item) => ({ value: String(item.id), label: `${item.warehouseCode} · ${item.warehouseName}` })} searchFields={['warehouseCode', 'warehouseName']} placeholder={t('form.warehousePlaceholder')} portalContainer={null} /></Field>
                <Field label={t('form.countType')} required><AppDropdown value={form.countType} onValueChange={(value) => setForm((current) => ({ ...current, countType: value }))} options={typeOptions} portalContainer={null} /></Field>
                <Field label={t('form.priority')} required><AppInput type="number" min={1} max={5} value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} /></Field>
                <Field label={t('form.plannedStart')}><AppDateInput type="datetime-local" value={form.plannedStart} onChange={(event) => setForm((current) => ({ ...current, plannedStart: event.target.value }))} /></Field>
                <Field label={t('form.plannedEnd')}><AppDateInput type="datetime-local" value={form.plannedEnd} onChange={(event) => setForm((current) => ({ ...current, plannedEnd: event.target.value }))} /></Field>
              </div>
            </FormSection>
            <FormSection title={t('form.sections.scope')}>
              <p className="text-sm text-slate-500">{form.locations.length === 0 ? t('form.wholeWarehouseHint') : t('form.selectedLocationHint', { count: form.locations.length })}</p>
              <PagedAppDropdown<LocationLookupRow> value={locationValue} onValueChange={(value) => void addLocation(value)} queryKey={['inventory-count-locations', form.warehouseId]} fetchPage={(request) => inventoryCountApi.locations(request, Number(form.warehouseId))} enabled={Boolean(form.warehouseId)} dependencies={[form.warehouseId]} toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}`, description: item.locationType })} searchFields={['code', 'name', 'barcode']} placeholder={t('form.locationPlaceholder')} portalContainer={null} />
              {form.locations.length > 0 ? <div className="flex flex-wrap gap-2">{form.locations.map((location) => <span key={location.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm"><MapPin className="size-3.5" />{location.code} · {location.name}<button type="button" onClick={() => setForm((current) => ({ ...current, locations: current.locations.filter((item) => item.id !== location.id) }))} aria-label={t('actions.removeLocation')}><X className="size-3.5" /></button></span>)}</div> : null}
              <Toggle label={t('form.includeDescendants')} checked={form.includeDescendants} onChange={(value) => setForm((current) => ({ ...current, includeDescendants: value }))} />
            </FormSection>
            <FormSection title={t('form.sections.controls')}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label={t('form.countMode')}><AppDropdown value={form.countMode} onValueChange={(value) => setForm((current) => ({ ...current, countMode: value }))} options={modeOptions} portalContainer={null} /></Field>
                <Field label={t('form.movementPolicy')}><AppDropdown value={form.movementPolicy} onValueChange={(value) => setForm((current) => ({ ...current, movementPolicy: value }))} options={movementOptions} portalContainer={null} /></Field>
                <Field label={t('form.maxCountAttempts')}><AppInput type="number" min={1} max={10} value={form.maxCountAttempts} onChange={(event) => setForm((current) => ({ ...current, maxCountAttempts: event.target.value }))} /></Field>
                <Field label={t('form.quantityTolerance')}><AppInput type="number" min={0} step="0.001" value={form.quantityTolerance} onChange={(event) => setForm((current) => ({ ...current, quantityTolerance: event.target.value }))} /></Field>
                <Field label={t('form.percentageTolerance')}><AppInput type="number" min={0} max={100} step="0.01" value={form.percentageTolerance} onChange={(event) => setForm((current) => ({ ...current, percentageTolerance: event.target.value }))} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2"><Toggle label={t('form.requireIndependentRecount')} checked={form.requireIndependentRecount} onChange={(value) => setForm((current) => ({ ...current, requireIndependentRecount: value }))} /><Toggle label={t('form.allowUnexpectedStock')} checked={form.allowUnexpectedStock} onChange={(value) => setForm((current) => ({ ...current, allowUnexpectedStock: value }))} /><Toggle label={t('form.autoApproveWithinTolerance')} checked={form.autoApproveWithinTolerance} onChange={(value) => setForm((current) => ({ ...current, autoApproveWithinTolerance: value }))} /><Toggle label={t('form.includeEmptyLocations')} checked={form.includeEmptyLocations} onChange={(value) => setForm((current) => ({ ...current, includeEmptyLocations: value }))} /></div>
            </FormSection>
            <Field label={t('form.notes')}><textarea className="input min-h-24 resize-y" maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
          </OpsDialogBody>
          <OpsDialogFooter><button type="button" className="rounded-xl border px-5 py-2.5" disabled={saving} onClick={() => setFormOpen(false)}>{t('actions.cancel')}</button><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{t('actions.saveDraft')}</button></OpsDialogFooter>
        </form>
      </OpsDialogContent>
    </Dialog>

    <Dialog open={Boolean(previewRow)} onOpenChange={(open) => { if (!open && !previewLoading) { setPreviewRow(null); setPreview(null); } }}>
      <OpsDialogContent size="xl">
        <OpsDialogHeader><div><DialogTitle>{t('preview.title', { documentNo: previewRow?.documentNo })}</DialogTitle><DialogDescription>{t('preview.description')}</DialogDescription></div></OpsDialogHeader>
        <OpsDialogBody>
          {previewLoading && !preview ? <div className="grid min-h-48 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div> : preview ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label={t('preview.locations')} value={preview.locationCount} /><Metric label={t('preview.emptyLocations')} value={preview.emptyLocationCount} /><Metric label={t('preview.lines')} value={preview.balanceLineCount} /><Metric label={t('preview.stocks')} value={preview.distinctStockCount} /><Metric label={t('preview.serials')} value={preview.distinctSerialCount} /><Metric label={t('preview.totalQuantity')} value={formatProjectNumber(preview.totalQuantity)} /></div>{preview.warnings.length > 0 ? <div className="space-y-2">{preview.warnings.map((warning) => <div key={warning} className="flex gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />{warning}</div>)}</div> : <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{t('preview.ready')}</div>}</div> : null}
        </OpsDialogBody>
        <OpsDialogFooter><button type="button" className="rounded-xl border px-5 py-2.5" disabled={previewLoading} onClick={() => { setPreviewRow(null); setPreview(null); }}>{t('actions.close')}</button>{can('WMS.INVENTORY_COUNT.RELEASE') && preview ? <button type="button" onClick={() => void release()} disabled={previewLoading || preview.locationCount === 0} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">{previewLoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}{t('actions.release')}</button> : null}</OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>

    <DeleteConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }} title={t('delete.title')} description={t('delete.description', { documentNo: deleteTarget?.documentNo })} confirmLabel={t('actions.delete')} isPending={saving} onConfirm={() => void remove()} />
  </>;
}

function statusOptions(t: (key: string) => string) {
  return (['Draft', 'Planned', 'Released', 'InProgress', 'AwaitingReview', 'RecountRequired', 'AwaitingApproval', 'Posting', 'Completed', 'Cancelled'] as InventoryCountStatus[]).map((value) => ({ value, label: t(`statuses.${value}`) }));
}

function StatusBadge({ status, text }: { status: InventoryCountStatus; text: string }): ReactElement {
  const tone = status === 'Completed' ? 'bg-emerald-500/15 text-emerald-600' : status === 'Cancelled' ? 'bg-red-500/15 text-red-600' : status === 'RecountRequired' || status === 'AwaitingReview' ? 'bg-amber-500/15 text-amber-600' : 'bg-cyan-500/15 text-cyan-600';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
}

function WorkflowCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }): ReactElement {
  return <article className="rounded-2xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-panel)] p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-[var(--wms-brand-primary)]">{icon}<span>{title}</span></div><p className="text-sm leading-6 text-slate-500">{text}</p></article>;
}
function FormSection({ title, children }: { title: string; children: ReactNode }): ReactElement { return <section className="space-y-3 rounded-2xl border border-[var(--wms-ops-card-border)] p-4"><h3 className="font-semibold">{title}</h3>{children}</section>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }): ReactElement { return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }): ReactElement { return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--wms-ops-card-border)] p-3 text-sm"><span>{label}</span><input type="checkbox" className="size-4" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function Metric({ label, value }: { label: string; value: ReactNode }): ReactElement { return <div className="rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-panel)] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>; }
