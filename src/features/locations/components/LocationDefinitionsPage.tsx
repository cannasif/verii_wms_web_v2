import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Boxes, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { locationsApi } from '../api/locations.api';
import type { LocationLookupRow, LocationRow, LocationUpsertPayload, WarehouseOption } from '../types/location.types';
import './location-definitions.css';

type FormMode = 'create' | 'edit';
type FormState = {
  id?: number; warehouseId: string; parentLocationId: string; code: string; name: string; locationType: string;
  barcodeEntryMode: string; barcode: string; zoneCode: string; aisleNo: string; rackNo: string; levelNo: string; binNo: string;
  capacityQuantity: string; capacityWeight: string; capacityVolume: string; capacityUnit: string; description: string;
  allowMixedStock: boolean; allowMixedLot: boolean; allowMixedStatus: boolean; allowCycleCount: boolean;
  isPickable: boolean; isPutaway: boolean; isQuarantine: boolean; isActive: boolean;
};

const emptyForm: FormState = {
  warehouseId: '', parentLocationId: '', code: '', name: '', locationType: 'Zone', barcodeEntryMode: 'Auto', barcode: '', zoneCode: '',
  aisleNo: '', rackNo: '', levelNo: '', binNo: '', capacityQuantity: '', capacityWeight: '', capacityVolume: '', capacityUnit: '', description: '',
  allowMixedStock: false, allowMixedLot: false, allowMixedStatus: false, allowCycleCount: true,
  isPickable: true, isPutaway: true, isQuarantine: false, isActive: true,
};

const locationTypeValues = ['Zone', 'Aisle', 'Rack', 'Shelf', 'Cell', 'Receiving', 'Staging', 'Shipping', 'Quarantine', 'Virtual'] as const;

const toNullableNumber = (value: string): number | null => value.trim() === '' ? null : Number(value);
const toText = (value: string): string | null => value.trim() === '' ? null : value.trim();

function toPayload(form: FormState): LocationUpsertPayload {
  return {
    warehouseId: Number(form.warehouseId), parentLocationId: form.parentLocationId ? Number(form.parentLocationId) : null,
    code: form.code.trim().toUpperCase(), name: form.name.trim(), locationType: form.locationType,
    barcodeEntryMode: form.barcodeEntryMode, barcode: toText(form.barcode), zoneCode: toText(form.zoneCode),
    aisleNo: toNullableNumber(form.aisleNo), rackNo: toNullableNumber(form.rackNo), levelNo: toNullableNumber(form.levelNo), binNo: toNullableNumber(form.binNo),
    capacityQuantity: toNullableNumber(form.capacityQuantity), capacityWeight: toNullableNumber(form.capacityWeight), capacityVolume: toNullableNumber(form.capacityVolume),
    capacityUnit: toText(form.capacityUnit), allowMixedStock: form.allowMixedStock, allowMixedLot: form.allowMixedLot,
    allowMixedStatus: form.allowMixedStatus, allowCycleCount: form.allowCycleCount, isPickable: form.isPickable,
    isPutaway: form.isPutaway, isQuarantine: form.isQuarantine, isActive: form.isActive, description: toText(form.description),
  };
}

function fromRow(row: LocationRow): FormState {
  const value = (input?: number | null) => input == null ? '' : String(input);
  return {
    id: row.id, warehouseId: String(row.warehouseId), parentLocationId: value(row.parentLocationId), code: row.code, name: row.name,
    locationType: row.locationType, barcodeEntryMode: row.barcodeEntryMode, barcode: row.barcode || '', zoneCode: row.zoneCode || '',
    aisleNo: value(row.aisleNo), rackNo: value(row.rackNo), levelNo: value(row.levelNo), binNo: value(row.binNo),
    capacityQuantity: value(row.capacityQuantity), capacityWeight: value(row.capacityWeight), capacityVolume: value(row.capacityVolume), capacityUnit: row.capacityUnit || '',
    description: row.description || '', allowMixedStock: row.allowMixedStock, allowMixedLot: row.allowMixedLot, allowMixedStatus: row.allowMixedStatus,
    allowCycleCount: row.allowCycleCount, isPickable: row.isPickable, isPutaway: row.isPutaway, isQuarantine: row.isQuarantine, isActive: row.isActive,
  };
}

export function LocationDefinitionsPage() {
  const { t, moduleReady } = useModuleTranslation('locations');
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading, isError: permissionsFailed } = usePermissionAccess();
  const [mode, setMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [parents, setParents] = useState<LocationLookupRow[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);
  const locationTypes = useMemo(
    () => moduleReady ? locationTypeValues.map((value) => [value, t(`types.${value}`)] as const) : [],
    [moduleReady, t],
  );

  // API remains the authority. While the permission cache is loading/unavailable,
  // keep actions discoverable and let the endpoint return 403 when access is denied.
  const canCreate = permissionsLoading || permissionsFailed || can('WMS.LOCATIONS.CREATE');
  const canUpdate = permissionsLoading || permissionsFailed || can('WMS.LOCATIONS.UPDATE');
  const canDelete = permissionsLoading || permissionsFailed || can('WMS.LOCATIONS.DELETE');

  const loadParents = useCallback(async (warehouseId: string, currentId?: number) => {
    if (!warehouseId) { setParents([]); return; }
    const rows = await locationsApi.getLookup(Number(warehouseId));
    setParents(rows.filter((row) => row.id !== currentId));
  }, []);

  const openCreate = useCallback(async () => {
    setMode('create'); setForm(emptyForm); setParents([]); setFormError(null); setLoadingForm(true);
    try {
      const options = await locationsApi.getWarehouses(); setWarehouses(options);
      if (options.length > 0) { const warehouseId = String(options[0].id); setForm((current) => ({ ...current, warehouseId })); await loadParents(warehouseId); }
    } catch (error) { toast.error(error instanceof Error ? error.message : t('messages.warehousesLoadFailed')); setMode(null); }
    finally { setLoadingForm(false); }
  }, [loadParents, t]);

  const openEdit = useCallback(async (row: LocationRow) => {
    setMode('edit'); setFormError(null); setLoadingForm(true);
    try {
      const [detail, options] = await Promise.all([locationsApi.getById(row.id), locationsApi.getWarehouses()]);
      setWarehouses(options); setForm(fromRow(detail)); await loadParents(String(detail.warehouseId), detail.id);
    } catch (error) { toast.error(error instanceof Error ? error.message : t('messages.detailLoadFailed')); setMode(null); }
    finally { setLoadingForm(false); }
  }, [loadParents, t]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError(null);
  };
  const changeWarehouse = async (warehouseId: string) => {
    setForm((current) => ({ ...current, warehouseId, parentLocationId: '' }));
    try { await loadParents(warehouseId, form.id); } catch (error) { toast.error(error instanceof Error ? error.message : t('messages.parentsLoadFailed')); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const requiresParent = ['Aisle', 'Rack', 'Shelf', 'Cell'].includes(form.locationType);
    const hasCapacity = [form.capacityQuantity, form.capacityWeight, form.capacityVolume].some((value) => value.trim() !== '');
    let validationError: string | null = null;
    if (!form.warehouseId || !form.code.trim() || !form.name.trim()) validationError = t('validation.requiredBasic');
    else if (requiresParent && !form.parentLocationId) validationError = t('validation.parentRequired');
    else if (form.barcodeEntryMode === 'Manual' && !form.barcode.trim()) validationError = t('validation.barcodeRequired');
    else if (hasCapacity && !form.capacityUnit.trim()) validationError = t('validation.capacityUnitRequired');
    if (validationError) { setFormError(validationError); toast.error(validationError); return; }
    setFormError(null);
    setSaving(true);
    try {
      if (mode === 'create') { await locationsApi.create(toPayload(form)); toast.success(t('messages.createSuccess')); }
      else if (form.id) { await locationsApi.update(form.id, toPayload(form)); toast.success(t('messages.updateSuccess')); }
      setMode(null); await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'warehouse-location-definitions-v2'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.saveFailed');
      setFormError(message); toast.error(message);
    }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await locationsApi.delete(deleteTarget.id); toast.success(t('messages.deleteSuccess')); setDeleteTarget(null); await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'warehouse-location-definitions-v2'] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('messages.deleteFailed')); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<LocationRow>[]>(() => {
    if (!moduleReady) return [];
    return [
      ...systemColumns<LocationRow>(),
    { key: 'branchCode', label: t('columns.branch'), render: (row) => row.branchCode },
    { key: 'warehouseCode', label: t('columns.warehouseCode'), render: (row) => row.warehouseCode },
    { key: 'warehouseName', label: t('columns.warehouseName'), render: (row) => row.warehouseName },
    { key: 'code', label: t('columns.code'), render: (row) => <span className="font-semibold">{row.code}</span> },
    { key: 'name', label: t('columns.name'), render: (row) => row.name },
    { key: 'locationType', label: t('columns.locationType'), render: (row) => t(`types.${row.locationType}`, { defaultValue: row.locationType }) },
    { key: 'parentCode', label: t('columns.parentLocation'), render: (row) => row.parentCode || '-' },
    { key: 'barcode', label: t('columns.barcode'), render: (row) => row.barcode || '-' },
    { key: 'zoneCode', label: t('columns.zone'), render: (row) => row.zoneCode || '-' },
    { key: 'isActive', label: t('columns.status'), render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.isActive ? t('status.active') : t('status.passive')}</span> },
      { key: 'actions', label: t('columns.actions'), sortable: false, filterable: false, render: (row) => <div className="flex items-center gap-1">{canUpdate && <button type="button" aria-label={`${row.code} ${t('actions.edit')}`} title={t('actions.edit')} onClick={() => openEdit(row)} className="rounded-lg border p-2 text-blue-600 hover:bg-blue-50"><Pencil className="size-4"/></button>}{canDelete && <button type="button" aria-label={`${row.code} ${t('actions.delete')}`} title={t('actions.delete')} onClick={() => setDeleteTarget(row)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50"><Trash2 className="size-4"/></button>}</div> },
    ];
  }, [canDelete, canUpdate, moduleReady, openEdit, t]);

  if (!moduleReady) {
    return <section aria-busy="true" className="grid min-h-[calc(100vh-8rem)] place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]"/></section>;
  }

  return <>
    <AdvancedDataGrid<LocationRow> pageKey="warehouse-location-definitions-v2" title={t('page.title')} description={t('page.description')} columns={columns} fetchPage={locationsApi.getPaged} toolbarAction={canCreate ? { label: t('page.newAction'), run: openCreate } : undefined}/>

    {mode && <Dialog open onOpenChange={(open) => { if (!open && !saving) setMode(null); }}><DialogContent showCloseButton={false} className="max-h-[calc(100%-2rem)] w-full !max-w-5xl overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-0 shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--wms-app-border)] px-6 py-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">{mode === 'create' ? <Plus className="size-5"/> : <Pencil className="size-5"/>}</div><div><DialogTitle className="text-xl font-bold">{mode === 'create' ? t('form.createTitle') : t('form.editTitle')}</DialogTitle><p className="text-sm text-slate-500">{t('form.description')}</p></div></div><button type="button" aria-label={t('form.close')} disabled={saving} onClick={() => setMode(null)} className="rounded-lg border p-2 disabled:opacity-50"><X className="size-4"/></button></div>
      {loadingForm ? <div className="grid h-80 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]"/></div> : <form onSubmit={submit} className="space-y-6 p-6">{formError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{formError}</div>}<section><h3 className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="size-4 text-[var(--wms-brand-primary)]"/>{t('form.basicInformation')}</h3><div className="grid gap-4 md:grid-cols-3"><Field label={t('form.warehouse')} required><PagedAppDropdown<WarehouseOption> value={form.warehouseId} onValueChange={(value) => void changeWarehouse(value)} queryKey="location-definition-warehouses" fetchPage={locationsApi.getWarehousesPaged} toOption={(item) => ({ value: String(item.id), label: `${item.warehouseCode} - ${item.warehouseName}` })} selectedOption={warehouses.filter((item) => String(item.id) === form.warehouseId).map((item) => ({ value: String(item.id), label: `${item.warehouseCode} - ${item.warehouseName}` }))[0]} placeholder={t('form.warehousePlaceholder')} ariaLabel={t('form.warehouse')} /></Field><Field label={t('form.locationType')} required><AppDropdown value={form.locationType} onValueChange={(value) => { update('locationType', value); if (value === 'Zone') update('parentLocationId', ''); }} options={locationTypes.map(([value, label]) => ({ value, label }))} ariaLabel={t('form.locationType')} /></Field><Field label={t('form.parentLocation')}><PagedAppDropdown<LocationLookupRow> value={form.parentLocationId} onValueChange={(value) => update('parentLocationId', value)} queryKey="location-definition-parents" fetchPage={(request) => locationsApi.getLocationsPaged(request, Number(form.warehouseId))} dependencies={[form.warehouseId]} enabled={Boolean(form.warehouseId)} toOption={(item) => ({ value: String(item.id), label: `${item.code} - ${item.name}`, disabled: item.id === form.id })} staticOptions={[{ value: '', label: t('form.rootLocation') }]} selectedOption={parents.filter((item) => String(item.id) === form.parentLocationId).map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` }))[0]} placeholder={t('form.rootLocation')} ariaLabel={t('form.parentLocation')} /></Field><Field label={t('form.code')} required><input autoFocus value={form.code} maxLength={50} onChange={(e) => update('code', e.target.value.toUpperCase())} className="input" placeholder="A01-R01-G01"/></Field><Field label={t('form.name')} required><input value={form.name} maxLength={150} onChange={(e) => update('name', e.target.value)} className="input"/></Field><Field label={t('form.zoneCode')}><input value={form.zoneCode} maxLength={50} onChange={(e) => update('zoneCode', e.target.value)} className="input"/></Field></div></section>
      <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><Boxes className="size-4 text-[var(--wms-brand-primary)]"/>{t('form.addressAndBarcode')}</h3><div className="grid gap-4 md:grid-cols-3"><Field label={t('form.aisleNo')}><NumberInput value={form.aisleNo} set={(v) => update('aisleNo', v)}/></Field><Field label={t('form.rackNo')}><NumberInput value={form.rackNo} set={(v) => update('rackNo', v)}/></Field><Field label={t('form.levelNo')}><NumberInput value={form.levelNo} set={(v) => update('levelNo', v)}/></Field><Field label={t('form.binNo')}><NumberInput value={form.binNo} set={(v) => update('binNo', v)}/></Field><Field label={t('form.barcodeMode')}><AppDropdown value={form.barcodeEntryMode} onValueChange={(value) => update('barcodeEntryMode', value)} options={[{ value: 'Auto', label: t('barcodeModes.Auto') }, { value: 'Manual', label: t('barcodeModes.Manual') }]} ariaLabel={t('form.barcodeMode')} /></Field><Field label={t('form.barcode')} required={form.barcodeEntryMode === 'Manual'}><input disabled={form.barcodeEntryMode === 'Auto'} value={form.barcode} maxLength={100} onChange={(e) => update('barcode', e.target.value)} className="input disabled:opacity-50" placeholder={form.barcodeEntryMode === 'Auto' ? t('form.barcodeAutoPlaceholder') : ''}/></Field></div></section>
      <section><h3 className="mb-3 font-semibold">{t('form.capacity')}</h3><div className="grid gap-4 md:grid-cols-4"><Field label={t('form.quantity')}><DecimalInput value={form.capacityQuantity} set={(v) => update('capacityQuantity', v)}/></Field><Field label={t('form.weight')}><DecimalInput value={form.capacityWeight} set={(v) => update('capacityWeight', v)}/></Field><Field label={t('form.volume')}><DecimalInput value={form.capacityVolume} set={(v) => update('capacityVolume', v)}/></Field><Field label={t('form.unit')}><input value={form.capacityUnit} maxLength={20} onChange={(e) => update('capacityUnit', e.target.value)} className="input" placeholder="ADET / KG / M3"/></Field></div></section>
      <section><h3 className="mb-3 font-semibold">{t('form.usageRules')}</h3><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Check label={t('rules.mixedStock')} checked={form.allowMixedStock} set={(v) => update('allowMixedStock', v)}/><Check label={t('rules.mixedLot')} checked={form.allowMixedLot} set={(v) => update('allowMixedLot', v)}/><Check label={t('rules.mixedStatus')} checked={form.allowMixedStatus} set={(v) => update('allowMixedStatus', v)}/><Check label={t('rules.cycleCount')} checked={form.allowCycleCount} set={(v) => update('allowCycleCount', v)}/><Check label={t('rules.pickable')} checked={form.isPickable} set={(v) => update('isPickable', v)}/><Check label={t('rules.putaway')} checked={form.isPutaway} set={(v) => update('isPutaway', v)}/><Check label={t('rules.quarantine')} checked={form.isQuarantine} set={(v) => { update('isQuarantine', v); if (v) update('isPickable', false); }}/><Check label={t('rules.active')} checked={form.isActive} set={(v) => update('isActive', v)}/></div></section>
      <Field label={t('form.descriptionLabel')}><textarea value={form.description} maxLength={500} rows={3} onChange={(e) => update('description', e.target.value)} className="w-full rounded-xl border bg-transparent px-3 py-2"/></Field>
      <div className="flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-5"><button type="button" disabled={saving} onClick={() => setMode(null)} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">{t('form.cancel')}</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin"/>}{mode === 'create' ? t('form.create') : t('form.save')}</button></div></form>}</DialogContent></Dialog>}

    {deleteTarget && <Dialog open onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}><DialogContent showCloseButton={false} className="w-full !max-w-md rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl"><div className="grid size-11 place-items-center rounded-full bg-red-100 text-red-600"><Trash2 className="size-5"/></div><DialogTitle className="mt-4 text-xl font-bold">{t('deleteDialog.title')}</DialogTitle><p className="mt-2 text-sm text-slate-500">{t('deleteDialog.description', { name: `${deleteTarget.code} - ${deleteTarget.name}` })}</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2">{t('form.cancel')}</button><button type="button" disabled={saving} onClick={remove} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin"/>}{t('actions.delete')}</button></div></DialogContent></Dialog>}
  </>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>; }
function NumberInput({ value, set }: { value: string; set: (value: string) => void }) { return <input type="number" min="0" max="9999" value={value} onChange={(e) => set(e.target.value)} className="input"/>; }
function DecimalInput({ value, set }: { value: string; set: (value: string) => void }) { return <input type="number" min="0" step="0.000001" value={value} onChange={(e) => set(e.target.value)} className="input"/>; }
function Check({ label, checked, set }: { label: string; checked: boolean; set: (value: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="size-4"/></label>; }
