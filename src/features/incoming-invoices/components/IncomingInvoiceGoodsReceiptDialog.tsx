import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, PackageCheck, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type {
  ActiveUserOption,
  SeriesOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { formatProjectNumber } from '@/lib/project-format';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { incomingInvoiceApi } from '../api/incoming-invoice.api';
import type {
  IncomingInvoiceDetail,
  IncomingInvoiceGoodsReceiptResult,
} from '../types/incoming-invoice.types';

interface Props {
  branchCode: string;
  detail: IncomingInvoiceDetail;
  onClose: () => void;
  onCreated: (result: IncomingInvoiceGoodsReceiptResult) => Promise<void>;
}

const split = (value: string | null): string[] => value?.split('|') ?? [];
const userLabel = (user: ActiveUserOption): string =>
  `${user.firstName} ${user.lastName}`.trim() || user.username;
const encodeUser = (user: ActiveUserOption): string =>
  encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string): ActiveUserOption =>
  JSON.parse(decodeURIComponent(value)) as ActiveUserOption;
const normalizeWaybill = (value: string, electronic: boolean): string =>
  electronic
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    : value.replace(/\D/g, '').slice(0, 15);
const validWaybill = (value: string, electronic: boolean): boolean =>
  electronic
    ? /^[A-Z0-9]{3}[0-9]{13}$/.test(value)
    : /^[0-9]{15}$/.test(value);

export function IncomingInvoiceGoodsReceiptDialog({
  branchCode,
  detail,
  onClose,
  onCreated,
}: Props): ReactElement {
  const { t } = useModuleTranslation('incoming-invoices');
  const sourceWaybill = (detail.despatchReferenceNo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sourceIsElectronic = /^[A-Z0-9]{3}[0-9]{13}$/.test(sourceWaybill);
  const sourceIsNormal = /^[0-9]{15}$/.test(sourceWaybill);
  const eligibleLines = useMemo(
    () => detail.lines.filter((line) => line.stockId && line.remainingQuantity > 0),
    [detail.lines],
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [supplier, setSupplier] = useState<string | null>(null);
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [isElectronic, setIsElectronic] = useState(sourceIsElectronic);
  const [waybillNo, setWaybillNo] = useState(
    sourceIsElectronic || sourceIsNormal ? sourceWaybill : '',
  );
  const [waybillDate, setWaybillDate] = useState(detail.header.issueDate.slice(0, 10));
  const [plannedArrival, setPlannedArrival] = useState('');
  const [priority, setPriority] = useState('3');
  const [labelStrategy, setLabelStrategy] = useState('None');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(eligibleLines.map((line) => line.id)),
  );
  const [quantities, setQuantities] = useState<Record<number, string>>(
    () => Object.fromEntries(
      eligibleLines.map((line) => [line.id, String(line.remainingQuantity)]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const warehouseId = Number(split(warehouse)[0] || 0);
  const total = eligibleLines.reduce(
    (sum, line) => sum + (
      selectedIds.has(line.id) ? Number(quantities[line.id] || 0) : 0
    ),
    0,
  );

  useEffect(() => {
    setLocationId(null);
    setSeries([]);
    setSeriesId(null);
    if (!warehouseId) return;
    let active = true;
    void goodsReceiptV2Api.series(warehouseId)
      .then((items) => {
        if (!active) return;
        setSeries(items);
        const preferred = items.find((item) => item.isDefault) ?? items[0];
        setSeriesId(preferred ? String(preferred.id) : null);
      })
      .catch((error: Error) => toast.error(error.message));
    return () => { active = false; };
  }, [warehouseId]);

  const toggleLine = (id: number): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (): Promise<void> => {
    const supplierId = Number(split(supplier)[0] || 0);
    const selected = eligibleLines.filter((line) => selectedIds.has(line.id));
    if (!supplierId) { toast.error(t('receiptDialog.validation.supplier')); return; }
    if (!validWaybill(waybillNo, isElectronic) || !waybillDate) {
      toast.error(isElectronic
        ? t('receiptDialog.validation.eWaybill')
        : t('receiptDialog.validation.waybill'));
      return;
    }
    if (!warehouseId || !locationId || !seriesId) {
      toast.error(t('receiptDialog.validation.operation'));
      return;
    }
    if (!assignees.length) {
      toast.error(t('receiptDialog.validation.assignee'));
      return;
    }
    if (!selected.length) {
      toast.error(t('receiptDialog.validation.lines'));
      return;
    }
    for (const line of selected) {
      const quantity = Number(quantities[line.id]);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > line.remainingQuantity) {
        toast.error(t('receiptDialog.validation.quantity', {
          line: line.lineNo,
          remaining: formatProjectNumber(line.remainingQuantity),
        }));
        return;
      }
    }

    setSaving(true);
    try {
      const result = await incomingInvoiceApi.createGoodsReceipt(detail.header.id, {
        idempotencyKey,
        branchCode,
        supplierId,
        documentSeriesId: Number(seriesId),
        targetWarehouseId: warehouseId,
        receivingLocationId: Number(locationId),
        isElectronicWaybill: isElectronic,
        waybillNo,
        waybillDate,
        plannedArrivalAtUtc: plannedArrival
          ? new Date(plannedArrival).toISOString()
          : null,
        labelStrategy,
        priority: Number(priority),
        description: description.trim() || null,
        assignedUserIds: assignees.map((user) => user.id),
        lines: selected.map((line) => ({
          incomingInvoiceLineId: line.id,
          quantity: Number(quantities[line.id]),
        })),
      });
      toast.success(result.replayed
        ? t('receiptDialog.messages.replayed')
        : t('receiptDialog.messages.created', { documentNo: result.documentNo }));
      await onCreated(result);
    } catch (error) {
      toast.error(error instanceof Error
        ? error.message
        : t('receiptDialog.messages.failed'));
    } finally {
      setSaving(false);
    }
  };

  return <ResponsiveDialog
    onClose={onClose}
    title={t('receiptDialog.title')}
    className="max-h-[calc(100dvh-1rem)] !max-w-6xl"
  >
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-violet-500">
          {t('receiptDialog.eyebrow')}
        </p>
        <h2 className="mt-1 text-xl font-black sm:text-2xl">
          {t('receiptDialog.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('receiptDialog.description', { invoiceNo: detail.header.invoiceNo })}
        </p>
      </div>
      <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
        <X className="size-5" />
      </button>
    </header>

    <Panel icon={<ClipboardCheck />} title={t('receiptDialog.document.title')}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('receiptDialog.supplier')} required>
          <PagedAppDropdown
            queryKey={['invoice-gr-customers', branchCode]}
            fetchPage={(request) => goodsReceiptV2Api.customers(request, branchCode)}
            toOption={(item) => ({
              value: `${item.id}|${item.customerCode}|${encodeURIComponent(item.customerName)}`,
              label: `${item.customerCode} · ${item.customerName}`,
            })}
            value={supplier}
            onValueChange={setSupplier}
            searchable
            minSearchLength={2}
          />
        </Field>
        <Field label={t('receiptDialog.waybillDate')} required>
          <AppDateInput value={waybillDate} onChange={(event) => setWaybillDate(event.target.value)} />
        </Field>
        <div className="md:col-span-2 rounded-xl border border-[var(--wms-app-border)] p-4">
          <label className="mb-3 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isElectronic}
              onChange={(event) => {
                setIsElectronic(event.target.checked);
                setWaybillNo('');
              }}
              className="size-4 accent-cyan-500"
            />
            <span className="font-semibold">{t('receiptDialog.isElectronic')}</span>
          </label>
          <AppInput
            value={waybillNo}
            onChange={(event) => setWaybillNo(normalizeWaybill(event.target.value, isElectronic))}
            inputMode={isElectronic ? 'text' : 'numeric'}
            maxLength={isElectronic ? 16 : 15}
            placeholder={isElectronic ? 'GIB2026000000001' : '000000000000001'}
            invalid={Boolean(waybillNo) && !validWaybill(waybillNo, isElectronic)}
          />
          <p className="mt-2 text-xs text-slate-500">
            {detail.despatchReferenceNo
              ? t('receiptDialog.despatchReference', { value: detail.despatchReferenceNo })
              : t('receiptDialog.noDespatchReference')}
          </p>
        </div>
      </div>
    </Panel>

    <Panel icon={<PackageCheck />} title={t('receiptDialog.operation.title')}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label={t('receiptDialog.warehouse')} required>
          <PagedAppDropdown
            queryKey={['invoice-gr-warehouses', branchCode]}
            fetchPage={(request) => goodsReceiptV2Api.warehouses(request, branchCode)}
            toOption={(item) => ({
              value: `${item.id}|${item.warehouseCode}|${encodeURIComponent(item.warehouseName)}`,
              label: `${item.warehouseCode} · ${item.warehouseName}`,
            })}
            value={warehouse}
            onValueChange={setWarehouse}
            searchable
          />
        </Field>
        <Field label={t('receiptDialog.location')} required>
          <PagedAppDropdown
            queryKey={['invoice-gr-locations', warehouseId]}
            fetchPage={(request) => goodsReceiptV2Api.locations(request, warehouseId)}
            toOption={(item) => ({
              value: String(item.id),
              label: `${item.code} · ${item.name}`,
              description: item.locationType,
            })}
            enabled={warehouseId > 0}
            dependencies={[warehouseId]}
            value={locationId}
            onValueChange={setLocationId}
            searchable
          />
        </Field>
        <Field label={t('receiptDialog.series')} required>
          <AppDropdown
            value={seriesId}
            onValueChange={setSeriesId}
            options={series.map((item) => ({
              value: String(item.id),
              label: `${item.code} · ${item.name}`,
              description: item.previewDocumentNumber,
            }))}
          />
        </Field>
        <Field label={t('receiptDialog.priority')}>
          <AppDropdown
            value={priority}
            onValueChange={setPriority}
            options={[1, 2, 3, 4, 5].map((value) => ({
              value: String(value),
              label: String(value),
            }))}
          />
        </Field>
        <Field label={t('receiptDialog.labelStrategy')}>
          <AppDropdown
            value={labelStrategy}
            onValueChange={setLabelStrategy}
            options={[
              { value: 'None', label: t('receiptDialog.labels.none') },
              { value: 'PreGenerate', label: t('receiptDialog.labels.preGenerate') },
              { value: 'SupplierLabel', label: t('receiptDialog.labels.supplier') },
              { value: 'GenerateOnReceipt', label: t('receiptDialog.labels.onReceipt') },
            ]}
          />
        </Field>
        <Field label={t('receiptDialog.plannedArrival')}>
          <AppDateInput
            type="datetime-local"
            value={plannedArrival}
            onChange={(event) => setPlannedArrival(event.target.value)}
          />
        </Field>
      </div>
    </Panel>

    <Panel icon={<UsersRound />} title={t('receiptDialog.assignment.title')}>
      <PagedAppDropdown
        queryKey={['invoice-gr-active-users']}
        fetchPage={goodsReceiptV2Api.activeUsersPaged}
        toOption={(user) => ({
          value: encodeUser(user),
          label: userLabel(user),
          description: `${user.username} · ${user.email}`,
          disabled: assignees.some((selected) => selected.id === user.id),
        })}
        value={null}
        onValueChange={(value) => {
          const user = decodeUser(value);
          setAssignees((current) =>
            current.some((item) => item.id === user.id)
              ? current
              : [...current, user]);
        }}
        placeholder={t('receiptDialog.assignment.placeholder')}
        searchable
        minSearchLength={2}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {assignees.map((user) => <span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm">
          <strong>{userLabel(user)}</strong>
          <button type="button" onClick={() => setAssignees((current) => current.filter((item) => item.id !== user.id))} className="text-rose-500">×</button>
        </span>)}
      </div>
    </Panel>

    <Panel icon={<CheckCircle2 />} title={t('receiptDialog.lines.title')}>
      <div className="space-y-3">
        {eligibleLines.map((line) => <article key={line.id} className={`rounded-xl border p-4 ${selectedIds.has(line.id) ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-[var(--wms-app-border)] opacity-70'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(line.id)} onChange={() => toggleLine(line.id)} className="mt-1 size-4 accent-cyan-500" />
              <span className="min-w-0">
                <strong className="block truncate">{line.stockCode} · {line.stockName}</strong>
                <small className="text-slate-500">
                  {t('receiptDialog.lines.summary', {
                    invoice: formatProjectNumber(line.quantity),
                    linked: formatProjectNumber(line.linkedQuantity),
                    remaining: formatProjectNumber(line.remainingQuantity),
                    unit: line.unitCode,
                  })}
                </small>
              </span>
            </label>
            <label className="w-full sm:w-44">
              <span className="mb-1 block text-xs font-semibold text-slate-500">{t('receiptDialog.lines.quantity')}</span>
              <AppInput
                type="number"
                min="0.000001"
                max={line.remainingQuantity}
                step="0.000001"
                disabled={!selectedIds.has(line.id)}
                value={quantities[line.id] ?? ''}
                onChange={(event) => setQuantities((current) => ({
                  ...current,
                  [line.id]: event.target.value,
                }))}
              />
            </label>
          </div>
        </article>)}
      </div>
      <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm text-amber-700 dark:text-amber-300">
        {t('receiptDialog.lines.trackingNotice')}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--wms-app-border)] p-4">
        <span className="text-sm text-slate-500">{t('receiptDialog.lines.total')}</span>
        <strong className="text-lg">{formatProjectNumber(total)}</strong>
      </div>
      <Field label={t('receiptDialog.descriptionLabel')}>
        <textarea className="input mt-4 min-h-24" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
    </Panel>

    <footer className="sticky bottom-0 mt-5 flex flex-col-reverse gap-2 border-t border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] pt-4 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--wms-app-border)] px-5 font-semibold">
        {t('actions.cancel')}
      </button>
      <button type="button" disabled={saving} onClick={() => void submit()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 font-bold text-white disabled:opacity-50">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
        {t('receiptDialog.create')}
      </button>
    </footer>
  </ResponsiveDialog>;
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: ReactElement;
  title: string;
  children: ReactNode;
}): ReactElement {
  return <section className="mt-5 rounded-2xl border border-[var(--wms-app-border)]">
    <header className="flex items-center gap-2 border-b border-[var(--wms-app-border)] p-4 text-cyan-600">
      {icon}<h3 className="font-black text-[var(--wms-app-text)]">{title}</h3>
    </header>
    <div className="p-4">{children}</div>
  </section>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}): ReactElement {
  return <label className="block">
    <span className="mb-1.5 block text-sm font-bold">
      {label}{required && <span className="ml-1 text-rose-500">*</span>}
    </span>
    {children}
  </label>;
}
