import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Edit3, Loader2, PackageSearch, Plus, Save, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppInput } from '@/components/shared/AppInput';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type { CustomerOption, StockOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { formatProjectNumber } from '@/lib/project-format';
import { useAuthStore } from '@/stores/auth-store';
import { supplierStockMappingsApi } from './api';
import type { SaveSupplierStockMappingInput, SupplierStockMappingRow } from './types';

const MANAGE = 'WMS.GOODS_RECEIPT.SUPPLIER_STOCK_MAPPING.MANAGE';
const NS = 'goodsReceipt.supplierStockMappings';

export function SupplierStockMappingsPage(): ReactElement {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const { can } = usePermissionAccess();
  const canManage = can(MANAGE);
  const [editing, setEditing] = useState<SupplierStockMappingRow | 'new' | null>(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = useCallback(async (row: SupplierStockMappingRow): Promise<void> => {
    if (!window.confirm(t(`${NS}.confirmDelete`, {
      supplierCode: row.supplierCode,
      supplierStockCode: row.supplierStockCode,
    }))) return;
    setDeleting(row.id);
    try {
      await supplierStockMappingsApi.delete(row.id, branchCode);
      toast.success(t(`${NS}.toast.deleted`));
      setGridVersion((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${NS}.toast.deleteFailed`));
    } finally {
      setDeleting(null);
    }
  }, [branchCode, t]);

  const columns = useMemo<GridColumn<SupplierStockMappingRow>[]>(() => [
    ...systemColumns<SupplierStockMappingRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    {
      key: 'supplierCode',
      label: t(`${NS}.columns.supplier`),
      sortable: true,
      filterable: true,
      defaultSearch: true,
      contextValue: (row) => `${row.supplierCode} · ${row.supplierName}`,
      render: (row) => <div><strong>{row.supplierCode}</strong><p className="text-xs text-slate-500">{row.supplierName}</p></div>,
    },
    {
      key: 'supplierStockCode',
      label: t(`${NS}.columns.supplierStockCode`),
      sortable: true,
      filterable: true,
      defaultSearch: true,
      render: (row) => <span className="font-mono font-bold text-cyan-500">{row.supplierStockCode}</span>,
    },
    {
      key: 'supplierStockName',
      label: t(`${NS}.columns.supplierStockName`),
      sortable: true,
      filterable: true,
      defaultSearch: true,
      render: (row) => row.supplierStockName || '-',
    },
    {
      key: 'supplierUnitCode',
      label: t(`${NS}.columns.supplierUnit`),
      sortable: true,
      filterable: true,
      render: (row) => row.supplierUnitCode || '-',
    },
    {
      key: 'systemStockCode',
      label: t(`${NS}.columns.systemStock`),
      sortable: true,
      filterable: true,
      defaultSearch: true,
      contextValue: (row) => `${row.systemStockCode} · ${row.systemStockName}`,
      render: (row) => <div><strong>{row.systemStockCode}</strong><p className="text-xs text-slate-500">{row.systemStockName}</p></div>,
    },
    {
      key: 'systemUnitCode',
      label: t(`${NS}.columns.systemUnit`),
      sortable: true,
      filterable: true,
      render: (row) => row.systemUnitCode || '-',
    },
    {
      key: 'conversionFactor',
      label: t(`${NS}.columns.conversionFactor`),
      sortable: true,
      filterable: true,
      filterType: 'number',
      render: (row) => formatProjectNumber(row.conversionFactor, { maximumFractionDigits: 8 }),
    },
    {
      key: 'isActive',
      label: t(`${NS}.columns.status`),
      sortable: true,
      filterable: true,
      filterType: 'boolean',
      render: (row) => (
        <OpsStatusBadge tone={row.isActive ? 'done' : 'pending'}>
          {row.isActive ? t(`${NS}.status.active`) : t(`${NS}.status.inactive`)}
        </OpsStatusBadge>
      ),
    },
    {
      key: 'actions',
      label: t(`${NS}.columns.actions`),
      ...requiredActionColumn,
      render: (row) => canManage ? <div className="flex gap-1">
        <button type="button" aria-label={t(`${NS}.editMapping`)} title={t(`${NS}.edit`)} onClick={() => setEditing(row)} className="grid size-11 place-items-center rounded-xl text-cyan-600 hover:bg-cyan-500/10"><Edit3 className="size-4" /></button>
        <button type="button" aria-label={t(`${NS}.deleteMapping`)} title={t(`${NS}.delete`)} disabled={deleting === row.id} onClick={() => void remove(row)} className="grid size-11 place-items-center rounded-xl text-rose-500 hover:bg-rose-500/10 disabled:opacity-50">{deleting === row.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button>
      </div> : <span className="text-xs text-slate-500">{t(`${NS}.readOnly`)}</span>,
    },
  ], [canManage, deleting, language, remove, t]);

  return <>
    <AdvancedDataGrid<SupplierStockMappingRow>
      key={`${gridVersion}-${branchCode}-${language}`}
      pageKey="supplier-stock-mappings-v1"
      eyebrow={t(`${NS}.eyebrow`)}
      title={t(`${NS}.title`)}
      description={t(`${NS}.description`)}
      columns={columns}
      fetchPage={(request) => supplierStockMappingsApi.paged(branchCode, request)}
      toolbarAction={canManage ? { label: t(`${NS}.newMapping`), run: async () => setEditing('new') } : undefined}
    />
    {editing && <MappingDialog
      branchCode={branchCode}
      value={editing === 'new' ? null : editing}
      onClose={() => setEditing(null)}
      onSaved={() => {
        setEditing(null);
        setGridVersion((value) => value + 1);
      }}
    />}
  </>;
}

function MappingDialog({
  branchCode,
  value,
  onClose,
  onSaved,
}: {
  branchCode: string;
  value: SupplierStockMappingRow | null;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const { t } = useTranslation('common');
  const [form, setForm] = useState<SaveSupplierStockMappingInput>(() => value ? {
    branchCode,
    supplierId: value.supplierId,
    supplierStockCode: value.supplierStockCode,
    supplierStockName: value.supplierStockName,
    supplierUnitCode: value.supplierUnitCode,
    stockId: value.stockId,
    conversionFactor: value.conversionFactor,
    isActive: value.isActive,
    notes: value.notes,
    rowVersion: value.rowVersion,
  } : {
    branchCode,
    supplierId: 0,
    supplierStockCode: '',
    supplierStockName: null,
    supplierUnitCode: null,
    stockId: 0,
    conversionFactor: 1,
    isActive: true,
    notes: null,
    rowVersion: null,
  });
  const [supplierValue, setSupplierValue] = useState<string | null>(
    value ? String(value.supplierId) : null,
  );
  const [stockValue, setStockValue] = useState<string | null>(
    value ? String(value.stockId) : null,
  );
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveSupplierStockMappingInput>(
    key: K,
    next: SaveSupplierStockMappingInput[K],
  ): void => setForm((current) => ({ ...current, [key]: next }));

  const save = async (): Promise<void> => {
    if (!form.supplierId) {
      toast.error(t(`${NS}.validation.supplierRequired`));
      return;
    }
    if (!form.supplierStockCode.trim()) {
      toast.error(t(`${NS}.validation.supplierStockCodeRequired`));
      return;
    }
    if (!form.stockId) {
      toast.error(t(`${NS}.validation.systemStockRequired`));
      return;
    }
    if (!Number.isFinite(form.conversionFactor) || form.conversionFactor <= 0) {
      toast.error(t(`${NS}.validation.conversionFactorInvalid`));
      return;
    }
    setSaving(true);
    try {
      if (value) await supplierStockMappingsApi.update(value.id, form);
      else await supplierStockMappingsApi.create(form);
      toast.success(value ? t(`${NS}.toast.updated`) : t(`${NS}.toast.created`));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${NS}.toast.saveFailed`));
    } finally {
      setSaving(false);
    }
  };

  return <ResponsiveDialog
    onClose={onClose}
    title={value ? t(`${NS}.dialog.editTitle`) : t(`${NS}.dialog.createTitle`)}
    className="!max-w-4xl"
  >
    <header className="flex items-start justify-between gap-3">
      <div className="flex gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-500"><PackageSearch className="size-6" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-500">{t(`${NS}.dialog.stage`)}</p>
          <h2 className="mt-1 text-xl font-black">{value ? t(`${NS}.dialog.editHeading`) : t(`${NS}.dialog.createHeading`)}</h2>
          <p className="mt-1 text-sm text-slate-500">{t(`${NS}.dialog.description`)}</p>
        </div>
      </div>
      <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="size-5" /></button>
    </header>

    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <Field label={t(`${NS}.dialog.fields.supplier`)} required>
        <PagedAppDropdown<CustomerOption>
          queryKey={['supplier-stock-mapping-customers', branchCode]}
          fetchPage={(request) => goodsReceiptV2Api.customers(request, branchCode)}
          toOption={(item) => ({ value: String(item.id), label: `${item.customerCode} · ${item.customerName}` })}
          selectedOption={value ? { value: String(value.supplierId), label: `${value.supplierCode} · ${value.supplierName}` } : undefined}
          value={supplierValue}
          onValueChange={(next) => {
            setSupplierValue(next);
            set('supplierId', next ? Number(next) : 0);
          }}
          placeholder={t(`${NS}.dialog.placeholders.searchSupplier`)}
          searchable
          minSearchLength={2}
          portalContainer={null}
        />
      </Field>
      <Field label={t(`${NS}.dialog.fields.systemStock`)} required>
        <PagedAppDropdown<StockOption>
          queryKey={['supplier-stock-mapping-stocks', branchCode]}
          fetchPage={(request) => goodsReceiptV2Api.stocks(request, branchCode)}
          toOption={(item) => ({
            value: String(item.id),
            label: `${item.erpStockCode} · ${item.stockName || ''}`,
            description: item.unitCode ? t(`${NS}.dialog.unitLabel`, { unit: item.unitCode }) : undefined,
          })}
          selectedOption={value ? {
            value: String(value.stockId),
            label: `${value.systemStockCode} · ${value.systemStockName}`,
            description: value.systemUnitCode ? t(`${NS}.dialog.unitLabel`, { unit: value.systemUnitCode }) : undefined,
          } : undefined}
          value={stockValue}
          onValueChange={(next) => {
            setStockValue(next);
            set('stockId', next ? Number(next) : 0);
          }}
          placeholder={t(`${NS}.dialog.placeholders.searchSystemStock`)}
          searchable
          minSearchLength={2}
          portalContainer={null}
        />
      </Field>
      <Field label={t(`${NS}.dialog.fields.supplierStockCode`)} required><AppInput autoFocus={!value} maxLength={100} value={form.supplierStockCode} onChange={(event) => set('supplierStockCode', event.target.value)} placeholder={t(`${NS}.dialog.placeholders.supplierStockCode`)} /></Field>
      <Field label={t(`${NS}.dialog.fields.supplierStockName`)}><AppInput maxLength={500} value={form.supplierStockName ?? ''} onChange={(event) => set('supplierStockName', event.target.value || null)} placeholder={t(`${NS}.dialog.placeholders.supplierStockName`)} /></Field>
      <Field label={t(`${NS}.dialog.fields.supplierUnit`)}><AppInput maxLength={20} value={form.supplierUnitCode ?? ''} onChange={(event) => set('supplierUnitCode', event.target.value.toUpperCase() || null)} placeholder={t(`${NS}.dialog.placeholders.supplierUnit`)} /></Field>
      <Field label={t(`${NS}.dialog.fields.conversionFactor`)} required><AppInput type="number" min="0.00000001" step="0.00000001" value={form.conversionFactor} onChange={(event) => set('conversionFactor', Number(event.target.value))} /></Field>
      <div className="md:col-span-2"><Field label={t(`${NS}.dialog.fields.notes`)}><textarea className="input min-h-24 resize-y" maxLength={1000} value={form.notes ?? ''} onChange={(event) => set('notes', event.target.value || null)} placeholder={t(`${NS}.dialog.placeholders.notes`)} /></Field></div>
    </div>

    <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4">
      <input type="checkbox" checked={form.isActive} onChange={(event) => set('isActive', event.target.checked)} className="size-4 accent-cyan-500" />
      <span><strong>{t(`${NS}.dialog.mappingActive`)}</strong><small className="ml-2 text-slate-500">{t(`${NS}.dialog.mappingActiveHint`)}</small></span>
    </label>

    <footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--wms-app-border)] px-5 font-semibold">{t(`${NS}.dialog.cancel`)}</button>
      <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : value ? <Save className="size-4" /> : <Plus className="size-4" />}{t(`${NS}.dialog.save`)}</button>
    </footer>
  </ResponsiveDialog>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactElement;
}): ReactElement {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>{children}</label>;
}
