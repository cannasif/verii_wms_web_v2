import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileDigit, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { formatProjectDateTime } from '@/lib/project-format';
import { documentSeriesApi } from '../api/document-series.api';
import type { DocumentSeriesRow, DocumentSeriesUpsertPayload, DocumentYearFormat, WarehouseOption, WmsDocumentType } from '../types/document-series.types';

type FormState = Omit<DocumentSeriesUpsertPayload, 'warehouseId' | 'numberLength' | 'startNumber' | 'nextNumber' | 'incrementBy'> & {
  warehouseId: string; numberLength: string; startNumber: string; nextNumber: string; incrementBy: string;
};

const emptyForm = (): FormState => ({
  branchCode: '0', warehouseId: '', code: '', name: '', documentType: 'GoodsReceipt', prefix: 'MK', separator: '-',
  yearFormat: 'FourDigit', numberLength: '8', startNumber: '1', nextNumber: '1', incrementBy: '1',
  isDefault: false, isActive: true, description: null,
});

export function DocumentSeriesPage() {
  const { t, moduleReady } = useModuleTranslation('document-series');
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<DocumentSeriesRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSeriesRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = can('WMS.DOCUMENT_SERIES.CREATE');
  const canUpdate = can('WMS.DOCUMENT_SERIES.UPDATE');
  const canDelete = can('WMS.DOCUMENT_SERIES.DELETE');
  const locked = Boolean(editing?.hasIssuedNumbers);

  const documentTypes = useMemo(
    () => moduleReady
      ? (['GoodsReceipt', 'InterWarehouseTransfer', 'Shipment', 'WarehouseReceipt', 'WarehouseIssue', 'ProductionOrder', 'ProductionTransfer', 'SubcontractingIssue', 'SubcontractingReceipt'] as WmsDocumentType[])
        .map((value) => ({ value, label: t(`types.${value}`) }))
      : [],
    [moduleReady, t],
  );
  const yearFormats = useMemo(
    () => moduleReady
      ? (['None', 'TwoDigit', 'FourDigit'] as DocumentYearFormat[])
        .map((value) => ({ value, label: t(`yearFormats.${value}`) }))
      : [],
    [moduleReady, t],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const openCreate = async () => { setEditing(null); setForm(emptyForm()); setFormError(null); setMode('create'); };
  const openEdit = useCallback(async (row: DocumentSeriesRow) => {
    setEditing(row);
    setForm({
      branchCode: row.branchCode, warehouseId: row.warehouseId ? String(row.warehouseId) : '', code: row.code, name: row.name,
      documentType: row.documentType, prefix: row.prefix, separator: row.separator, yearFormat: row.yearFormat,
      numberLength: String(row.numberLength), startNumber: String(row.startNumber), nextNumber: String(row.nextNumber), incrementBy: String(row.incrementBy),
      isDefault: row.isDefault, isActive: row.isActive, description: row.description ?? null,
    });
    setFormError(null); setMode('edit');
  }, []);

  const preview = useMemo(() => {
    const year = form.yearFormat === 'TwoDigit' ? String(new Date().getFullYear()).slice(-2) : form.yearFormat === 'FourDigit' ? String(new Date().getFullYear()) : '';
    const number = String(Math.max(Number(form.nextNumber) || 0, 0)).padStart(Math.max(Number(form.numberLength) || 0, 0), '0');
    return [form.prefix.trim().toUpperCase(), year, number].filter(Boolean).join(form.separator);
  }, [form.nextNumber, form.numberLength, form.prefix, form.separator, form.yearFormat]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.prefix.trim()) { setFormError(t('validation.required')); return; }
    const numberLength = Number(form.numberLength), startNumber = Number(form.startNumber), nextNumber = Number(form.nextNumber), incrementBy = Number(form.incrementBy);
    if (numberLength < 3 || numberLength > 18 || startNumber < 1 || nextNumber < startNumber || incrementBy < 1) { setFormError(t('validation.numbers')); return; }
    const payload: DocumentSeriesUpsertPayload = {
      ...form, branchCode: form.branchCode || '0', warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
      code: form.code.trim().toUpperCase(), name: form.name.trim(), prefix: form.prefix.trim().toUpperCase(), separator: form.separator.trim(),
      numberLength, startNumber, nextNumber, incrementBy, description: form.description?.trim() || null,
    };
    setSaving(true); setFormError(null);
    try {
      if (mode === 'create') { await documentSeriesApi.create(payload); toast.success(t('messages.createSuccess')); }
      else if (editing) { await documentSeriesApi.update(editing.id, payload); toast.success(t('messages.updateSuccess')); }
      setMode(null); await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'document-series-v2'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.saveFailed'); setFormError(message); toast.error(message);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await documentSeriesApi.delete(deleteTarget.id); toast.success(t('messages.deleteSuccess')); setDeleteTarget(null); await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'document-series-v2'] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('messages.deleteFailed')); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<DocumentSeriesRow>[]>(() => moduleReady ? [
    ...systemColumns<DocumentSeriesRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    { key: 'branchCode', label: t('columns.branch'), searchable: true, defaultSearch: false, render: (row) => row.branchCode },
    { key: 'warehouseCode', label: t('columns.warehouseCode'), searchable: true, defaultSearch: false, contextValue: (row) => row.warehouseCode ?? '-', render: (row) => row.warehouseCode ?? '-' },
    { key: 'warehouseName', label: t('columns.warehouseName'), searchable: true, defaultSearch: false, contextValue: (row) => row.warehouseName ?? t('form.allWarehouses'), render: (row) => row.warehouseName ?? t('form.allWarehouses') },
    { key: 'code', label: t('columns.code'), searchable: true, defaultSearch: true, render: (row) => <span className="font-mono font-semibold">{row.code}</span> },
    { key: 'name', label: t('columns.name'), searchable: true, defaultSearch: true, render: (row) => row.name },
    { key: 'documentType', label: t('columns.documentType'), searchable: true, defaultSearch: false, contextValue: (row) => t(`types.${row.documentType}`), render: (row) => t(`types.${row.documentType}`) },
    { key: 'prefix', label: t('columns.prefix'), searchable: true, defaultSearch: false, render: (row) => row.prefix },
    { key: 'previewDocumentNumber', label: t('columns.preview'), sortable: false, filterable: false, render: (row) => <span className="font-mono text-[var(--wms-brand-primary)]">{row.previewDocumentNumber}</span> },
    { key: 'nextNumber', label: t('columns.nextNumber'), searchable: true, defaultSearch: false, render: (row) => row.nextNumber },
    { key: 'isDefault', label: t('columns.default'), contextValue: (row) => row.isDefault ? t('status.yes') : t('status.no'), render: (row) => row.isDefault ? t('status.yes') : t('status.no') },
    { key: 'isActive', label: t('columns.active'), contextValue: (row) => row.isActive ? t('status.active') : t('status.passive'), render: (row) => <Status active={row.isActive} activeText={t('status.active')} passiveText={t('status.passive')} /> },
    { key: 'hasIssuedNumbers', label: t('columns.issued'), contextValue: (row) => row.hasIssuedNumbers ? t('status.yes') : t('status.no'), render: (row) => row.hasIssuedNumbers ? t('status.yes') : t('status.no') },
    { key: 'lastIssuedAt', label: t('columns.lastIssuedAt'), contextValue: (row) => row.lastIssuedAt ? formatProjectDateTime(row.lastIssuedAt) : '-', render: (row) => row.lastIssuedAt ? formatProjectDateTime(row.lastIssuedAt) : '-' },
    { key: 'actions', label: t('columns.actions'), ...requiredActionColumn, render: (row) => <div className="flex items-center gap-1">{canUpdate && <button type="button" title={t('actions.edit')} onClick={() => void openEdit(row)} className="rounded-lg border p-2 text-blue-600 hover:bg-blue-50"><Pencil className="size-4"/></button>}{canDelete && <button type="button" title={t('actions.delete')} disabled={row.hasIssuedNumbers} onClick={() => setDeleteTarget(row)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="size-4"/></button>}</div> },
  ] : [], [canDelete, canUpdate, moduleReady, openEdit, t]);

  if (!moduleReady) return <section className="grid min-h-[calc(100vh-8rem)] place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]"/></section>;

  return <>
    <AdvancedDataGrid<DocumentSeriesRow> pageKey="document-series-v2" title={t('page.title')} description={t('page.description')} columns={columns} fetchPage={documentSeriesApi.getPaged} toolbarAction={canCreate ? { label: t('page.newAction'), run: openCreate } : undefined}/>

    {mode && <Dialog open onOpenChange={(open) => { if (!open && !saving) setMode(null); }}><DialogContent showCloseButton={false} className="max-h-[calc(100%-2rem)] w-full !max-w-4xl overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-0 shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--wms-app-border)] px-6 py-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white"><FileDigit className="size-5"/></div><div><DialogTitle className="text-xl font-bold">{mode === 'create' ? t('form.createTitle') : t('form.editTitle')}</DialogTitle><DialogDescription className="text-sm text-slate-500">{t('form.description')}</DialogDescription></div></div><button type="button" aria-label={t('form.close')} disabled={saving} onClick={() => setMode(null)} className="rounded-lg border p-2"><X className="size-4"/></button></div>
      <form onSubmit={submit} className="space-y-5 p-6">
        {formError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{formError}</div>}
        {locked && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{t('form.lockedNotice')}</div>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label={t('form.documentType')} required><AppDropdown value={form.documentType} onValueChange={(value) => update('documentType', value)} options={documentTypes} searchable disabled={locked}/></Field>
          <Field label={t('form.warehouse')}><PagedAppDropdown<WarehouseOption> value={form.warehouseId} onValueChange={(value) => update('warehouseId', value)} queryKey="document-series-warehouses" fetchPage={documentSeriesApi.getWarehousesPaged} toOption={(item) => ({ value: String(item.id), label: `${item.warehouseCode} - ${item.warehouseName}` })} staticOptions={[{ value: '', label: t('form.allWarehouses') }]} selectedOption={editing?.warehouseId ? { value: String(editing.warehouseId), label: `${editing.warehouseCode} - ${editing.warehouseName ?? ''}` } : undefined} disabled={locked}/></Field>
          <Field label={t('form.code')} required><input value={form.code} maxLength={20} disabled={locked} onChange={(event) => update('code', event.target.value.toUpperCase())} className="input disabled:opacity-50"/></Field>
          <Field label={t('form.name')} required><input value={form.name} maxLength={150} onChange={(event) => update('name', event.target.value)} className="input"/></Field>
          <Field label={t('form.prefix')} required><input value={form.prefix} maxLength={10} disabled={locked} onChange={(event) => update('prefix', event.target.value.toUpperCase())} className="input disabled:opacity-50"/></Field>
          <Field label={t('form.separator')}><input value={form.separator} maxLength={3} disabled={locked} onChange={(event) => update('separator', event.target.value)} className="input disabled:opacity-50"/></Field>
          <Field label={t('form.yearFormat')}><AppDropdown value={form.yearFormat} onValueChange={(value) => update('yearFormat', value)} options={yearFormats} searchable disabled={locked}/></Field>
          <Field label={t('form.numberLength')}><NumberField value={form.numberLength} min={3} max={18} disabled={locked} onChange={(value) => update('numberLength', value)}/></Field>
          <Field label={t('form.startNumber')}><NumberField value={form.startNumber} min={1} disabled={locked} onChange={(value) => update('startNumber', value)}/></Field>
          <Field label={t('form.nextNumber')}><NumberField value={form.nextNumber} min={1} disabled={locked} onChange={(value) => update('nextNumber', value)}/></Field>
          <Field label={t('form.incrementBy')}><NumberField value={form.incrementBy} min={1} max={1000} disabled={locked} onChange={(value) => update('incrementBy', value)}/></Field>
          <Field label={t('form.preview')}><div className="input flex items-center font-mono font-semibold text-[var(--wms-brand-primary)]">{preview}</div></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2"><Toggle label={t('form.default')} checked={form.isDefault} onChange={(value) => update('isDefault', value)}/><Toggle label={t('form.active')} checked={form.isActive} onChange={(value) => update('isActive', value)}/></div>
        <Field label={t('form.descriptionLabel')}><textarea value={form.description ?? ''} maxLength={500} rows={3} onChange={(event) => update('description', event.target.value)} className="w-full rounded-xl border bg-transparent px-3 py-2"/></Field>
        <div className="flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-5"><button type="button" disabled={saving} onClick={() => setMode(null)} className="rounded-xl border px-5 py-2.5">{t('form.cancel')}</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin"/> : mode === 'create' ? <Plus className="size-4"/> : <Pencil className="size-4"/>}{mode === 'create' ? t('form.create') : t('form.save')}</button></div>
      </form>
    </DialogContent></Dialog>}

    {deleteTarget && <Dialog open onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}><DialogContent showCloseButton={false} className="w-full !max-w-md rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl"><div className="grid size-11 place-items-center rounded-full bg-red-100 text-red-600"><Trash2 className="size-5"/></div><DialogTitle className="mt-4 text-xl font-bold">{t('deleteDialog.title')}</DialogTitle><DialogDescription className="mt-2 text-sm text-slate-500">{t('deleteDialog.description', { name: `${deleteTarget.code} - ${deleteTarget.name}` })}</DialogDescription><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2">{t('form.cancel')}</button><button type="button" disabled={saving} onClick={() => void remove()} className="rounded-xl bg-red-600 px-4 py-2 text-white">{t('actions.delete')}</button></div></DialogContent></Dialog>}
  </>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>; }
function NumberField({ value, min, max, disabled, onChange }: { value: string; min: number; max?: number; disabled?: boolean; onChange: (value: string) => void }) { return <input type="number" value={value} min={min} max={max} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="input disabled:opacity-50"/>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4"/></label>; }
function Status({ active, activeText, passiveText }: { active: boolean; activeText: string; passiveText: string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active ? activeText : passiveText}</span>; }
