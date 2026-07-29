import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Building2, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, FileText, Loader2, PackagePlus, Plus, Printer, ScanBarcode, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OPS_FIELD_CLASS } from '@/components/shared/ops-field-styles';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { OpsListPageShell } from '@/components/shared/OpsListPageShell';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import { cn } from '@/lib/utils';
import { parseLocalizedNumber } from '@/lib/project-format';
import { useAuthStore } from '@/stores/auth-store';
import type { PagedResponse } from '@/types/api';
import { StockTrackingPolicyField } from '@/features/stock-tracking/StockTrackingPolicyField';
import type { EffectiveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import { buildOrderlessLinePayload, validateManualLineTracking } from '../goods-receipt-manual.utils';
import type { ActiveUserOption, CustomerOption, ManualGoodsReceiptResult, ManualReceiptLine, PutawayLocationSuggestion, SeriesOption } from '../types/goods-receipt.types';
import { printReceiptLabels } from '../utils/goods-receipt-label-output';
import { GoodsReceiptCreatePage } from './GoodsReceiptCreatePage';

const today = (): string => new Date().toLocaleDateString('en-CA');
const split = (value: string | null): string[] => value?.split('|') ?? [];
const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalCount: page.totalCount,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / page.pageSize) || 0),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: page.hasNextPage ?? page.pageNumber * page.pageSize < page.totalCount,
});
const encodeCustomerValue = (item: CustomerOption): string =>
  `${item.id}|${item.branchCode}|${item.customerCode}|${encodeURIComponent(item.customerName)}`;
const customerDisplayFromValue = (value: string | null): string => {
  const parts = split(value);
  if (!parts[2]) return '';
  return `${decodeURIComponent(parts[3] || '')} (${parts[2]})`.trim();
};
const normalizeReceiptNo = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
const validReceiptNo = (value: string): boolean =>
  /^[A-Z0-9]{15}$/.test(value);
const userLabel = (user: ActiveUserOption): string => `${user.firstName} ${user.lastName}`.trim() || user.username;
const encodeUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string): ActiveUserOption => JSON.parse(decodeURIComponent(value)) as ActiveUserOption;

export function GoodsReceiptManualPage({
  direct,
  embedded = false,
}: {
  direct: boolean;
  embedded?: boolean;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<string | null>(null);
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [receiptNo, setReceiptNo] = useState('');
  const [isElectronic, setIsElectronic] = useState(true);
  const [documentDate, setDocumentDate] = useState(today);
  const [plannedArrival, setPlannedArrival] = useState('');
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [allowAnyActiveLocation, setAllowAnyActiveLocation] = useState(false);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [labelStrategy, setLabelStrategy] = useState('None');
  const [executionMode, setExecutionMode] = useState('Manual');
  const [description, setDescription] = useState('');
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [stock, setStock] = useState<string | null>(null);
  const [yap, setYap] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitCode, setUnitCode] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [serialBatch, setSerialBatch] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [lineLocation, setLineLocation] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<PutawayLocationSuggestion[]>([]);
  const [suggestionsBusy, setSuggestionsBusy] = useState(false);
  const [lines, setLines] = useState<ManualReceiptLine[]>([]);
  const [trackingPolicy, setTrackingPolicy] = useState<EffectiveStockTrackingPolicy | null>(null);
  const [trackingPolicyBusy, setTrackingPolicyBusy] = useState(false);
  const [qualityCheckBusy, setQualityCheckBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [result, setResult] = useState<ManualGoodsReceiptResult | null>(null);
  const submitIdempotencyKey = useRef(crypto.randomUUID());
  const qualityRequirementCache = useRef(new Map<string, boolean>());
  const warehouseId = Number(split(warehouse)[0] || 0);
  const policyBranchCode = split(customer)[1] || branchCode;
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const receiptNoValid = validReceiptNo(receiptNo);
  const receiptNoInvalid = showFieldErrors && !receiptNoValid;
  const steps = [
    { label: t('manual.steps.document'), icon: FileText },
    { label: t('manual.steps.operation'), icon: Building2 },
    { label: t('manual.steps.lines'), icon: PackagePlus },
    { label: t('manual.steps.review'), icon: ClipboardCheck },
  ];

  useEffect(() => {
    setSeries([]);
    setSeriesId(null);
    void goodsReceiptV2Api.series().then((items) => {
      setSeries(items);
      const preferred = items.find((item) => item.isDefault) ?? items[0];
      setSeriesId(preferred ? String(preferred.id) : null);
    }).catch((cause: Error) => setError(cause.message));
    void goodsReceiptV2Api.policy(branchCode)
      .then((policy) => setAllowAnyActiveLocation(
        policy.locationSelectionPolicy === 'AnyActiveWarehouseLocation',
      ))
      .catch(() => setAllowAnyActiveLocation(false));
  }, [branchCode]);

  useEffect(() => {
    setLocationId(null); setLineLocation(null); setLocationSuggestions([]);
    if (!warehouseId) return;
    const locationQuery = allowAnyActiveLocation
      ? goodsReceiptV2Api.locations
      : goodsReceiptV2Api.receivingLocations;
    void locationQuery({
      pageNumber: 1, pageSize: 100, search: undefined, filterLogic: 'and', filters: [], sortBy: 'code', sortDirection: 'asc', signal: new AbortController().signal,
    }, warehouseId).then((page) => {
      const preferred = allowAnyActiveLocation
        ? undefined
        : page.items.find((item) => item.locationType === 'Receiving') ?? page.items[0];
      if (preferred) {
        setLocationId(String(preferred.id));
        setLineLocation(`${preferred.id}|${preferred.code}`);
      }
    }).catch(() => undefined);
  }, [allowAnyActiveLocation, warehouseId]);

  useEffect(() => {
    const stockId = Number(split(stock)[0] || 0);
    const yapCodeId = Number(split(yap)[0] || 0);
    const numericQuantity = Number(quantity);
    setLocationSuggestions([]);
    if (!warehouseId || !stockId || !Number.isFinite(numericQuantity) || numericQuantity <= 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSuggestionsBusy(true);
      void goodsReceiptV2Api.putawaySuggestions(warehouseId, {
        stockId,
        yapCodeId: yapCodeId || undefined,
        quantity: numericQuantity,
      }).then((items) => {
        if (!cancelled) setLocationSuggestions(items);
      }).catch(() => {
        if (!cancelled) setLocationSuggestions([]);
      }).finally(() => {
        if (!cancelled) setSuggestionsBusy(false);
      });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [warehouseId, stock, yap, quantity]);

  useEffect(() => {
    const stockId = Number(split(stock)[0] || 0);
    setTrackingPolicy(null);
    if (!stockId) return;
    let cancelled = false;
    setTrackingPolicyBusy(true);
    void goodsReceiptV2Api.trackingPolicy(policyBranchCode, stockId)
      .then((policy) => { if (!cancelled) setTrackingPolicy(policy); })
      .catch(() => { if (!cancelled) setTrackingPolicy(null); })
      .finally(() => { if (!cancelled) setTrackingPolicyBusy(false); });
    return () => { cancelled = true; };
  }, [stock, policyBranchCode]);

  const showError = (message: string): false => { setError(message); toast.error(message); return false; };
  const canLeaveStep = (): boolean => {
    if (step === 0 && !customer) return showError(t('manual.validation.customer'));
    if (step === 0 && !receiptNoValid) {
      setShowFieldErrors(true);
      return showError(isElectronic ? t('manual.validation.eReceiptNo') : t('manual.validation.receiptNo'));
    }
    if (step === 0 && !documentDate) return showError(t('manual.validation.date'));
    if (step === 0 && !seriesId) return showError('Bu işlem için aktif bir belge serisi seçilmelidir.');
    if (step === 1 && (!warehouseId || !locationId)) return showError(t('manual.validation.operation'));
    if (step === 1 && !direct && assignees.length === 0) return showError('Emir için en az bir operasyon kullanıcısı atanmalıdır.');
    if (step === 2 && lines.length === 0) return showError(t('manual.validation.lines'));
    setError(null);
    setShowFieldErrors(false);
    return true;
  };
  const next = async (): Promise<void> => {
    if (!canLeaveStep()) return;
    if (step === 2 && direct) {
      setQualityCheckBusy(true);
      try {
        const requirement = await goodsReceiptV2Api.qualityRequirements(
          policyBranchCode,
          lines.map((line) => line.stockId),
        );
        const qualityByStockId = new Map(
          requirement.stocks.map((stockRequirement) => [
            stockRequirement.stockId,
            stockRequirement.requiresQualityControl,
          ]),
        );
        setLines((current) => current.map((line) => ({
          ...line,
          requireQualityControl: qualityByStockId.get(line.stockId) === true,
        })));
      } catch (cause) {
        showError(cause instanceof Error
          ? cause.message
          : 'Kalite kontrol kuralları doğrulanamadı.');
        return;
      } finally {
        setQualityCheckBusy(false);
      }
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const addLine = async (): Promise<void> => {
    const [stockId, stockCode, encodedName, encodedUnit] = split(stock); const numericQuantity = parseLocalizedNumber(quantity);
    if (!stockId || !Number.isFinite(numericQuantity) || numericQuantity <= 0) { showError(t('manual.validation.stock')); return; }
    if (!trackingPolicy) { showError(`${stockCode} için stok takip politikası yüklenemedi.`); return; }
    const stockUnitCode = encodedUnit ? decodeURIComponent(encodedUnit) : '';
    if (!stockUnitCode) { showError(`${stockCode} stok kartının ölçü birimi tanımlı değil.`); return; }
    if (!warehouseId || !lineLocation) { showError('Kalem için hedef depo ve raf seçilmelidir.'); return; }
    const serials = serialBatch.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    if (serialNo.trim() && serials.length) { showError('Tek seri alanı ile toplu seri alanı birlikte kullanılamaz.'); return; }
    if (serialNo.trim() && numericQuantity !== 1) { showError(t('manual.validation.serialQuantity')); return; }
    if (serials.length && (!Number.isInteger(numericQuantity) || serials.length !== numericQuantity)) { showError(`Toplu seri sayısı (${serials.length}) kabul miktarına (${numericQuantity}) eşit olmalıdır.`); return; }
    const normalizedSerials = serials.map((value) => value.toLocaleUpperCase('tr-TR'));
    if (new Set(normalizedSerials).size !== normalizedSerials.length) { showError('Toplu seri listesinde aynı seri birden fazla kullanılamaz.'); return; }
    if (serials.some((value) => lines.some((line) => line.serialNo?.trim().toLocaleUpperCase('tr-TR') === value.toLocaleUpperCase('tr-TR')))) { showError('Serilerden biri bu kabul listesinde daha önce kullanılmış.'); return; }
    if (manufacturingDate && expirationDate && expirationDate < manufacturingDate) { showError(t('manual.validation.expiry')); return; }
    const trackingType = trackingPolicy.trackingType;
    const draftLine = {
      stockCode,
      trackingType,
      quantity: serials.length ? 1 : numericQuantity,
      lotNo: lotNo.trim() || undefined,
      serialNo: serialNo.trim() || undefined,
      manufacturingDate: manufacturingDate || undefined,
      expirationDate: expirationDate || undefined,
    };
    const trackingError = validateManualLineTracking(draftLine, trackingPolicy);
    if (trackingError) { showError(trackingError); return; }
    if (serials.length) {
      for (const serial of serials) {
        const serialLine = { ...draftLine, quantity: 1, serialNo: serial };
        const serialError = validateManualLineTracking(serialLine, trackingPolicy);
        if (serialError) { showError(serialError); return; }
      }
    }
    const qualityCacheKey = `${policyBranchCode}:${stockId}`;
    let requiresQualityControl = qualityRequirementCache.current.get(qualityCacheKey);
    if (requiresQualityControl == null) {
      setQualityCheckBusy(true);
      try {
        const requirement = await goodsReceiptV2Api.qualityRequirements(
          policyBranchCode,
          [Number(stockId)],
        );
        requiresQualityControl = requirement.requiresQualityControl;
        qualityRequirementCache.current.set(qualityCacheKey, requiresQualityControl);
      } catch (cause) {
        showError(cause instanceof Error
          ? cause.message
          : `${stockCode} için kalite kuralı kontrol edilemedi.`);
        return;
      } finally {
        setQualityCheckBusy(false);
      }
    }
    const [yapCodeId, yapCode] = split(yap);
    const [receivingLocationId, receivingLocationCode] = split(lineLocation);
    const base = { stockId: Number(stockId), stockCode, stockName: encodedName ? decodeURIComponent(encodedName) : undefined,
      yapCodeId: yapCodeId ? Number(yapCodeId) : undefined, yapCode: yapCode || undefined, unitCode: stockUnitCode,
      targetWarehouseId: warehouseId, targetWarehouseCode: Number(split(warehouse)[2] || 0) || undefined,
      receivingLocationId: Number(receivingLocationId), receivingLocationCode, trackingType,
      requireQualityControl: requiresQualityControl === true,
      lotNo: lotNo.trim() || undefined, manufacturingDate: manufacturingDate || undefined,
      expirationDate: expirationDate || undefined };
    const nextLines: ManualReceiptLine[] = serials.length
      ? serials.map((serial) => ({ ...base, localId: crypto.randomUUID(), quantity: 1, serialNo: serial, scannedBarcode: serial }))
      : [{ ...base, localId: crypto.randomUUID(), quantity: numericQuantity, serialNo: serialNo.trim() || undefined, scannedBarcode: scannedBarcode.trim() || undefined }];
    setLines((current) => [...current, ...nextLines]);
    setStock(null); setTrackingPolicy(null); setUnitCode(''); setYap(null); setQuantity('1'); setLineLocation(null); setLocationSuggestions([]); setLotNo(''); setSerialNo(''); setSerialBatch(''); setManufacturingDate(''); setExpirationDate(''); setScannedBarcode(''); setError(null);
  };

  const submit = async (): Promise<void> => {
    const [supplierId, supplierBranch] = split(customer);
    if (!supplierId || !warehouseId || !locationId || !seriesId || !receiptNoValid || lines.length === 0) {
      if (!receiptNoValid) setShowFieldErrors(true);
      showError(t('manual.validation.incomplete'));
      return;
    }
    for (const line of lines) {
      const trackingError = validateManualLineTracking(line);
      if (trackingError) { showError(trackingError); return; }
    }
    setBusy(true); setError(null);
    try {
      const payload = { idempotencyKey: submitIdempotencyKey.current, branchCode: supplierBranch || branchCode, documentSeriesId: Number(seriesId), supplierId: Number(supplierId),
        targetWarehouseId: warehouseId, receivingLocationId: Number(locationId), documentDate,
        waybillNo: isElectronic ? null : receiptNo, waybillDate: documentDate, electronicWaybillNo: isElectronic ? receiptNo : null,
        shipmentReferenceNo: null, carrierCode: null, carrierName: null, vehiclePlate: null, trailerPlate: null, driverName: null, sealNo: null,
        plannedArrivalAtUtc: plannedArrival ? new Date(plannedArrival).toISOString() : null, occurredAtUtc: direct ? new Date().toISOString() : null,
        labelStrategy, executionMode, priority: 1, deviceId: null, description: description.trim() || null,
        assignedUserIds: direct ? null : assignees.map((user) => user.id),
        lines: lines.map((line) => buildOrderlessLinePayload(line)) };
      const created = direct ? await goodsReceiptV2Api.createDirect(payload) : await goodsReceiptV2Api.createOrderless(payload);
      setResult(created); submitIdempotencyKey.current = crypto.randomUUID(); toast.success(t('manual.success'));
    } catch (cause) { const message = cause instanceof Error ? cause.message : t('manual.validation.submit'); setError(message); toast.error(message); }
    finally { setBusy(false); }
  };

  if (!moduleReady) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-7 animate-spin text-cyan-500"/></div>;
  if (result) return <Result result={result} direct={direct} reset={() => { submitIdempotencyKey.current = crypto.randomUUID(); setResult(null); setLines([]); setStep(0); setReceiptNo(''); }} t={t}/>;
  return <section className={cn('wms-ops-form space-y-5', !embedded && 'mx-auto max-w-7xl')}>
    <Stepper steps={steps} current={step}/>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</div>}

    {step === 0 && <Panel title={t('manual.document.title')} description={t('manual.document.description')} icon={<FileText/>}><div className="grid gap-5 lg:grid-cols-2">
      <Field
        label={t('manual.customer')}
        required
        errorTarget="customer"
        errorKeys="tedarikçi cari|tedarik carisi|supplier"
      >
        <PagedLookupDialog<CustomerOption>
          variant="ops"
          triggerMode="combobox"
          autoSearchMinLength={2}
          open={customerLookupOpen}
          onOpenChange={setCustomerLookupOpen}
          title={t('selectCustomer')}
          value={customerDisplayFromValue(customer)}
          placeholder={t('selectCustomer')}
          searchPlaceholder={t('searchCustomer')}
          emptyText={t('customerEmpty')}
          triggerClassName={OPS_FIELD_CLASS}
          queryKey={['gr-manual-customers-lookup', branchCode]}
          fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
            toPagedResponse(
              await goodsReceiptV2Api.customers(
                {
                  pageNumber,
                  pageSize,
                  search,
                  sortBy: 'customerCode',
                  sortDirection: 'asc',
                  signal: signal ?? new AbortController().signal,
                },
                branchCode,
              ),
            )
          }
          getKey={(item) => String(item.id)}
          getLabel={(item) => `${item.customerName} (${item.customerCode})`}
          onSelect={(item) => setCustomer(encodeCustomerValue(item))}
        />
      </Field>
      <Field
        label={t('manual.documentDate')}
        required
        errorTarget="documentDate"
        errorKeys="irsaliye tarihi|kabul tarihi|belge tarihi|dispatch date|waybill date"
      >
        <AppDateInput value={documentDate} onChange={(e) => setDocumentDate(e.target.value)}/>
      </Field>
      <Field
        label={t('manual.series')}
        required
        errorTarget="documentSeries"
        errorKeys="belge serisi|document series|aktif bir belge serisi"
      >
        <AppDropdown value={seriesId} onValueChange={setSeriesId} options={series.map((x) => ({ value: String(x.id), label: `${x.code} · ${x.name}`, description: x.previewDocumentNumber }))} placeholder="Belge serisi seçin"/>
      </Field>
      <div
        className="lg:col-span-2 rounded-2xl border border-[var(--wms-app-border)] bg-black/[.025] p-4 dark:bg-white/[.025]"
        data-wms-error-target="receiptNo"
        data-wms-error-keys="irsaliye numarası|e-irsaliye numarası|normal irsaliye|mal kabul no|gib numarası|15 alfanümerik|e-dispatch|dispatch number"
      ><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{t('manual.receiptNo')}</h3><p className="text-xs text-slate-500">{isElectronic ? t('manual.eReceiptHint') : t('manual.receiptHint')}</p></div><label className="flex items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4 py-2"><OpsSkinCheckbox checked={isElectronic} onCheckedChange={setIsElectronic} aria-label={t('manual.isElectronic')} /><span className="text-sm font-semibold">{t('manual.isElectronic')}</span></label></div><AppInput autoFocus className="font-mono tracking-wider" inputMode="text" maxLength={15} placeholder={isElectronic ? 'GIB2026AB000000' : 'IRS202600000001'} value={receiptNo} invalid={receiptNoInvalid} onChange={(e) => { setReceiptNo(normalizeReceiptNo(e.target.value)); setError(null); }} trailingContent={<span className={`pr-1 text-xs font-bold ${receiptNoValid ? 'text-emerald-500' : 'text-[var(--wms-ops-field-placeholder-fg)]'}`}>{receiptNo.length}/15</span>}/>{receiptNoInvalid ? <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500">{isElectronic ? t('manual.validation.eReceiptNo') : t('manual.validation.receiptNo')}</p> : receiptNoValid ? <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500"><Check className="size-3.5"/>{t('manual.validNumber')}</p> : null}</div>
      {!direct && <Field label={t('manual.plannedArrival')}><AppDateInput type="datetime-local" value={plannedArrival} onChange={(e) => setPlannedArrival(e.target.value)}/></Field>}
    </div></Panel>}

    {step === 1 && <Panel title={t('manual.operation.title')} description={t('manual.operation.description')} icon={<Building2/>}><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Field label={t('manual.warehouse')} required><PagedAppDropdown queryKey={['gr-manual-warehouses', branchCode]} fetchPage={(request) => goodsReceiptV2Api.warehouses(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.branchCode}|${x.warehouseCode}|${encodeURIComponent(x.warehouseName)}`, label: `${x.warehouseCode} · ${x.warehouseName}` })} value={warehouse} onValueChange={setWarehouse} searchable/></Field>
      <Field label={t('manual.location')} required><PagedAppDropdown queryKey={['gr-manual-locations', allowAnyActiveLocation ? 'all-active' : 'receiving', warehouseId]} fetchPage={(request) => (allowAnyActiveLocation ? goodsReceiptV2Api.locations : goodsReceiptV2Api.receivingLocations)(request, warehouseId)} toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}`, description: x.locationType })} enabled={warehouseId > 0} dependencies={[allowAnyActiveLocation, warehouseId]} value={locationId} onValueChange={setLocationId} searchable placeholder={allowAnyActiveLocation ? 'Aktif raf seçin' : 'Receiving / Staging'}/></Field>
      <Field label={t('manual.labelStrategy')}><AppDropdown value={labelStrategy} onValueChange={(value)=>{setLabelStrategy(value);if(direct)setExecutionMode(value==='SupplierLabel'?'SupplierLabel':'Manual')}} options={[{value:'None',label:t('manual.options.noLabel')},...(!direct?[{value:'PreGenerate',label:t('manual.options.preGenerate')}]:[]),{value:'SupplierLabel',label:t('manual.options.supplierLabel')},{value:'GenerateOnReceipt',label:t('manual.options.generateOnReceipt')}]}/></Field>
      {direct && <Field label={t('manual.executionMode')}><AppDropdown value={executionMode} onValueChange={setExecutionMode} options={[{value:'Manual',label:t('manual.options.manual')},{value:'BarcodeScan',label:t('manual.options.barcode')},{value:'SupplierLabel',label:t('manual.options.supplierLabel')}]}/></Field>}
    </div>{!direct&&<section className="mt-5 rounded-xl border border-[var(--wms-app-border)] p-4"><h3 className="font-bold">Emir sorumluları <span className="text-red-500">*</span></h3><p className="mb-3 text-xs text-slate-500">Siparişsiz emir seçilen kullanıcılara atanır ve “Bana Atanan Emirler” kuyruğuna düşer.</p><PagedAppDropdown queryKey={['gr-manual-active-users']} fetchPage={goodsReceiptV2Api.activeUsersPaged} toOption={user=>({value:encodeUser(user),label:userLabel(user),description:`${user.username} · ${user.email}`,disabled:assignees.some(selected=>selected.id===user.id)})} value={null} onValueChange={value=>{const user=decodeUser(value);setAssignees(current=>current.some(x=>x.id===user.id)?current:[...current,user])}} placeholder="Operasyon kullanıcısı ekle" searchable minSearchLength={2}/><div className="mt-3 flex flex-wrap gap-2">{assignees.map(user=><span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm"><strong>{userLabel(user)}</strong><button type="button" onClick={()=>setAssignees(current=>current.filter(x=>x.id!==user.id))} className="text-red-500">×</button></span>)}</div></section>}</Panel>}

    {step === 2 && <Panel title={t('manual.lines.title')} description={t('manual.lines.description')} icon={<ScanBarcode/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label={t('manual.stock')} required><PagedAppDropdown queryKey={['gr-manual-stocks', branchCode]} fetchPage={(request) => goodsReceiptV2Api.stocks(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.erpStockCode}|${encodeURIComponent(x.stockName || '')}|${encodeURIComponent(x.unitCode || '')}`, label: `${x.erpStockCode} · ${x.stockName || ''}`, description: x.unitCode ? `Birim: ${x.unitCode}` : 'Birim tanımsız' })} value={stock} onValueChange={(value) => { setStock(value); setUnitCode(decodeURIComponent(split(value)[3] || '')); }} searchable minSearchLength={2}/></Field>
      {stock && <div className="md:col-span-2 xl:col-span-4"><StockTrackingPolicyField policy={trackingPolicy ?? undefined} loading={trackingPolicyBusy} compact /></div>}
      <Field label={t('manual.yap')}><PagedAppDropdown queryKey={['gr-manual-yaps', branchCode]} fetchPage={(request) => goodsReceiptV2Api.yapCodes(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.configurationCode}`, label: `${x.configurationCode} · ${x.description || ''}` })} value={yap} onValueChange={setYap} searchable minSearchLength={1}/></Field>
      <Field label={t('manual.quantity')} required errorTarget="quantity" errorKeys="stok ve sıfırdan|seri takipli satırın miktarı|toplu seri sayısı|quantity"><AppInput className="font-mono" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)}/></Field><Field label={t('manual.unit')}><div className={cn(OPS_FIELD_CLASS, 'flex items-center font-bold', unitCode ? 'text-cyan-600' : 'text-amber-600')}>{unitCode || 'Önce stok seçin'}</div></Field>
      <Field label={allowAnyActiveLocation ? 'Hedef raf' : 'Kabul rafı (Receiving / Staging)'} required errorTarget="lineLocation" errorKeys="hedef depo ve raf|kabul rafı|target warehouse"><PagedAppDropdown queryKey={['gr-manual-line-locations', allowAnyActiveLocation ? 'all-active' : 'receiving', warehouseId]} fetchPage={(request) => (allowAnyActiveLocation ? goodsReceiptV2Api.locations : goodsReceiptV2Api.receivingLocations)(request, warehouseId)} toOption={(x) => ({ value: `${x.id}|${x.code}`, label: `${x.code} · ${x.name}`, description: x.locationType })} enabled={warehouseId > 0} dependencies={[allowAnyActiveLocation, warehouseId]} value={lineLocation} onValueChange={setLineLocation} searchable/></Field>
      <Field label={t('manual.lot')} errorTarget="lot" errorKeys="lot numarası|lot zorunludur"><AppInput maxLength={100} value={lotNo} onChange={(e) => setLotNo(e.target.value)}/></Field><Field label={t('manual.serial')} errorTarget="serial" errorKeys="seri numarası|seri takipli|toplu seri|tek seri alanı|serial"><AppInput maxLength={100} value={serialNo} onChange={(e) => setSerialNo(e.target.value)}/></Field>
      <Field label={t('manual.manufacturingDate')}><AppDateInput value={manufacturingDate} onChange={(e) => setManufacturingDate(e.target.value)}/></Field><Field label={t('manual.expirationDate')}><AppDateInput value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}/></Field>
      {direct && <Field label={t('manual.scannedBarcode')}><AppInput maxLength={250} value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)}/></Field>}
      <div className="flex items-end"><OpsActionButton type="button" variant="primary" disabled={qualityCheckBusy} onClick={() => void addLine()} className="w-full">{qualityCheckBusy?<Loader2 className="size-3.5 shrink-0 animate-spin"/>:<Plus className="size-3.5 shrink-0"/>}{t('manual.addLine')}</OpsActionButton></div>
    </div><section className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="flex items-start gap-3"><ScanBarcode className="mt-0.5 size-5 shrink-0 text-cyan-500"/><div><h3 className="font-bold">Toplu seri ve barkod okutma</h3><p className="text-xs leading-5 text-slate-500">Miktar 13 ise okuyucuyla 13 farklı seriyi satır satır okutun. Her seri API’ye 1 miktarlı ayrı izlenebilir kalem olarak gönderilir.</p></div></div><textarea className={cn(OPS_FIELD_CLASS, 'mt-3 min-h-28 w-full font-mono')} value={serialBatch} onChange={(event) => setSerialBatch(event.target.value)} placeholder={'SN-000001\\nSN-000002\\nSN-000003'} aria-label="Toplu seri barkodları"/><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span>Okutulan: <strong>{serialBatch.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean).length}</strong> / Miktar: <strong>{Number(quantity) || 0}</strong></span><button type="button" onClick={() => setSerialBatch('')} disabled={!serialBatch} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40">Listeyi temizle</button></div></section>
      {(suggestionsBusy || locationSuggestions.length > 0) && <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-500">{suggestionsBusy && <Loader2 className="size-4 animate-spin"/>}Önerilen putaway rafları</div><p className="mb-2 text-xs text-slate-500">{allowAnyActiveLocation ? 'Önerilen raflardan birini hedef raf olarak seçebilirsiniz.' : 'Kabul rafı değildir; yalnızca Receiving/Staging seçin. Bu liste sonraki raflama için bilgi amaçlıdır.'}</p><div className="flex flex-wrap gap-2">{locationSuggestions.map((item, index) => <div key={item.id} className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-2 text-left text-xs"><strong>{index + 1}. {item.code}</strong><span className="ml-2 text-slate-500">{item.reason}</span>{item.remainingCapacity != null && <span className="ml-2 font-mono text-slate-500">Kalan: {item.remainingCapacity}</span>}</div>)}</div></div>}
      <LineTable lines={lines} remove={(id) => setLines((current) => current.filter((line) => line.localId !== id))} t={t}/></Panel>}

    {step === 3 && <Panel title={t('manual.review.title')} description={t('manual.review.description')} icon={<ClipboardCheck/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Summary label={t('manual.customer')} value={`${decodeURIComponent(split(customer)[3] || '') || '—'} · ${split(customer)[2] || '—'}`}/><Summary label={t('manual.receiptNo')} value={receiptNo}/><Summary label={t('manual.documentType')} value={isElectronic ? t('manual.eReceipt') : t('manual.normalReceipt')}/><Summary label={t('manual.documentDate')} value={documentDate}/><Summary label={t('manual.warehouse')} value={`${split(warehouse)[2] || '—'} · ${decodeURIComponent(split(warehouse)[3] || '')}`}/><Summary label={t('manual.lineCount')} value={String(lines.length)}/><Summary label={t('manual.totalQuantity')} value={String(total)}/><Summary label={t('manual.operationType')} value={direct ? t('manual.direct') : t('manual.orderless')}/>{!direct&&<Summary label="Emir sorumluları" value={assignees.map(userLabel).join(', ')||'—'}/>}</div><Field label={t('manual.description')}><textarea className={cn(OPS_FIELD_CLASS, 'mt-2 min-h-24 w-full')} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)}/></Field></Panel>}

    <footer className="sticky bottom-3 z-20 flex items-center justify-between rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-xl backdrop-blur"><OpsActionButton type="button" variant="secondary" disabled={step === 0 || busy || qualityCheckBusy} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }}><ChevronLeft className="size-3.5 shrink-0"/>{t('back')}</OpsActionButton><div className="hidden text-xs text-slate-500 sm:block">{steps[step]?.label}</div>{step < 3 ? <OpsActionButton type="button" variant="primary" disabled={qualityCheckBusy} onClick={() => void next()}>{qualityCheckBusy?<Loader2 className="size-3.5 shrink-0 animate-spin"/>:null}{t('continue')}<ChevronRight className="size-3.5 shrink-0"/></OpsActionButton> : <OpsActionButton type="button" variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="size-3.5 shrink-0 animate-spin"/> : <CheckCircle2 className="size-3.5 shrink-0"/>}{direct ? (lines.some((line)=>line.requireQualityControl)?'Kaliteye Gönder':'İrsaliye Oluştur') : t('manual.createTask')}</OpsActionButton>}</footer>
  </section>;
}

function GoodsReceiptOpsPageShell({
  title,
  hint,
  hintAria,
  children,
}: {
  title: string;
  hint: string;
  hintAria: string;
  children: ReactNode;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const pageEyebrow = (
    <>
      <span>{t('list.eyebrowParent')}</span>
      <span className="mx-2 opacity-60">/</span>
      <span>{t('list.eyebrowModule')}</span>
    </>
  );

  if (!moduleReady) {
    return (
      <div className="grid min-h-[20rem] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </div>
    );
  }

  return (
    <OpsListPageShell
      eyebrow={pageEyebrow}
      title={
        <span className="inline-flex items-center gap-2">
          {title}
          <TooltipProvider delayDuration={160}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="wms-ops-gr-page-hero__hint"
                  aria-label={hintAria}
                >
                  <CircleHelp className="size-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={10}
                className={cn(
                  'wms-ops-page-hint-tooltip max-w-[22rem] overflow-hidden rounded-xl border p-0 text-left shadow-[0_12px_40px_color-mix(in_oklab,black_45%,transparent),0_0_0_1px_color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)]',
                  '!bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)]',
                  'border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-app-border))]',
                  '!text-[var(--wms-app-text)]',
                )}
              >
                <div className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] px-3.5 py-2">
                  <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-ops-accent)]">
                    <span
                      className="size-1.5 rounded-full bg-[var(--wms-ops-accent)] shadow-[0_0_8px_var(--wms-ops-accent)]"
                      aria-hidden
                    />
                    {t('createFlow.howItWorks')}
                  </span>
                </div>
                <p className="px-3.5 py-3 text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">
                  {hint}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      }
    >
      {children}
    </OpsListPageShell>
  );
}

export function GoodsReceiptOrderlessPage(): ReactElement {
  const { t } = useModuleTranslation('goods-receipt-v2');
  return (
    <GoodsReceiptOpsPageShell
      title={t('createFlow.orderlessPageTitle')}
      hint={t('createFlow.orderlessSubtitle')}
      hintAria={t('createFlow.orderlessPageHintAria')}
    >
      <GoodsReceiptManualPage direct={false} embedded />
    </GoodsReceiptOpsPageShell>
  );
}

export function GoodsReceiptDirectPage(): ReactElement {
  const { t } = useModuleTranslation('goods-receipt-v2');
  return (
    <GoodsReceiptOpsPageShell
      title={t('createFlow.directPageTitle')}
      hint={t('createFlow.directSubtitle')}
      hintAria={t('createFlow.directPageHintAria')}
    >
      <GoodsReceiptCreatePage direct embedded />
    </GoodsReceiptOpsPageShell>
  );
}
function Stepper({ steps, current }: { steps: Array<{label:string;icon:typeof FileText}>; current:number }): ReactElement {
  return (
    <nav className="wms-ops-create-steps wms-ops-create-steps--four" aria-label="Oluşturma adımları">
      {steps.map(({ label, icon: Icon }, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div
            key={label}
            role="tab"
            aria-selected={active}
            className={cn(
              'wms-ops-create-steps__tab',
              active && 'wms-ops-create-steps__tab--active',
              done && 'wms-ops-create-steps__tab--done',
            )}
          >
            <span className="wms-ops-create-steps__index">
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            <span className="wms-ops-create-steps__label inline-flex items-center gap-1.5">
              <Icon className="size-3.5 opacity-70" aria-hidden />
              {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
function Panel({title,description,icon,children}:{title:string;description:string;icon:ReactElement;children:ReactNode}):ReactElement{return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm"><header className="flex gap-3 border-b border-[var(--wms-app-border)] p-5"><span className="text-cyan-500">{icon}</span><div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-slate-500">{description}</p></div></header><div className="p-5">{children}</div></section>;}
function Field({label,required,children,errorTarget,errorKeys}:{label:string;required?:boolean;children:ReactNode;errorTarget?:string;errorKeys?:string}):ReactElement{return <label className="block space-y-1.5 text-sm" data-wms-error-target={errorTarget || undefined} data-wms-error-keys={errorKeys || undefined}><span className="font-semibold">{label}{required&&<span className="text-red-500"> *</span>}</span>{children}</label>;}
function Summary({label,value}:{label:string;value:string}):ReactElement{return <div className="rounded-xl border border-[var(--wms-app-border)] bg-black/[.025] p-4 dark:bg-white/[.025]"><div className="text-xs text-slate-500">{label}</div><strong className="mt-1 block break-words text-sm">{value}</strong></div>;}
function LineTable({lines,remove,t}:{lines:ManualReceiptLine[];remove:(id:string)=>void;t:(key:string)=>string}):ReactElement{return <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]"><table className="w-full text-sm"><thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">{t('manual.stock')}</th><th className="p-3">{t('manual.yap')}</th><th className="p-3">Depo / Raf</th><th className="p-3">{t('manual.lot')} / {t('manual.serial')}</th><th className="p-3 text-right">{t('manual.quantity')}</th><th className="p-3">{t('manual.actions')}</th></tr></thead><tbody>{lines.map((line)=><tr key={line.localId} className="border-t border-[var(--wms-app-border)]"><td className="p-3"><strong>{line.stockCode}</strong><div className="text-xs text-slate-500">{line.stockName}</div></td><td className="p-3">{line.yapCode||'—'}</td><td className="p-3"><strong>{line.targetWarehouseCode ?? '—'}</strong><div className="text-xs text-cyan-500">{line.receivingLocationCode}</div></td><td className="p-3">{line.lotNo||'—'} / {line.serialNo||'—'}</td><td className="p-3 text-right font-mono">{line.quantity} {line.unitCode}</td><td className="p-3"><button aria-label={t('manual.removeLine')} onClick={()=>remove(line.localId)} className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"><Trash2 className="size-4"/></button></td></tr>)}</tbody></table>{lines.length===0&&<p className="p-6 text-center text-sm text-slate-500">{t('manual.noLines')}</p>}</div>;}
function Result({result,direct,reset,t}:{result:ManualGoodsReceiptResult;direct:boolean;reset:()=>void;t:(key:string)=>string}):ReactElement{
  const navigate = useNavigate();
  const [printing,setPrinting]=useState(false);
  const hasQuality = Boolean(result.qualityInspectionId);
  const printGenerated=async():Promise<void>=>{
    setPrinting(true);
    try{
      const labels=await goodsReceiptV2Api.receiptLabels(result.id);
      printReceiptLabels(labels,`${result.documentNo} kabul etiketleri`);
      const unprinted=labels.filter(label=>label.printCount===0).map(label=>label.id);
      if(unprinted.length)await goodsReceiptV2Api.markLabelsPrinted(unprinted);
      toast.success('Mal kabulde oluşan etiketler yazdırıldı.');
    }catch(error){toast.error(error instanceof Error?error.message:'Etiketler yazdırılamadı.');}
    finally{setPrinting(false);}
  };
  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 via-[var(--wms-app-panel)] to-transparent shadow-sm">
      <div className="border-b border-emerald-500/20 px-8 py-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-9"/>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
          Mal kabul sonrası
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          {direct ? (hasQuality ? 'Kaliteye gönderildi' : 'İrsaliye oluştu') : t('manual.resultOrderless')}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {direct
            ? (hasQuality
              ? 'Kaliteye gönderilen ürünler için kalite onayından sonra irsaliye oluşturulacaktır.'
              : 'İrsaliye oluşturma işlemi tamamlandı.')
            : 'Siparişsiz mal kabul emri oluşturuldu ve operasyon kuyruğuna düştü.'}
        </p>
        <div className="mx-auto mt-5 inline-flex rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Belge No</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">{result.documentNo}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 px-8 py-6 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center">
          <div className="text-xs text-slate-500">{t('manual.linesText')}</div>
          <strong className="mt-1 block text-lg">{result.lineCount}</strong>
        </div>
        <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center">
          <div className="text-xs text-slate-500">Miktar</div>
          <strong className="mt-1 block text-lg">{result.quantity}</strong>
        </div>
        <div className="rounded-xl border border-[var(--wms-app-border)] p-3 text-center">
          <div className="text-xs text-slate-500">Durum</div>
          <strong className="mt-1 block text-sm">
            {hasQuality ? 'Kaliteye gönderildi' : 'İrsaliye oluştu'}
          </strong>
        </div>
      </div>
      <div className="border-t border-emerald-500/20 px-8 py-5 text-center">
        {direct && (result.generatedLabelIds?.length ?? 0) > 0 && (
          <button disabled={printing} onClick={()=>void printGenerated()} className="mr-3 inline-flex items-center gap-2 rounded-xl border border-violet-500/40 px-5 py-2.5 font-semibold text-violet-500 disabled:opacity-40">
            {printing?<Loader2 className="size-4 animate-spin"/>:<Printer className="size-4"/>}
            Kabul Etiketlerini Yazdır
          </button>
        )}
        <button onClick={reset} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white">{t('manual.newRecord')}</button>
        {direct && (
          <button
            type="button"
            onClick={() =>
              navigate(
                hasQuality
                  ? "/warehouse/quality/inspections"
                  : "/warehouse/goods-receipts/list",
              )
            }
            className="ml-3 rounded-xl border border-emerald-500/40 px-5 py-2.5 font-semibold text-emerald-700 dark:text-emerald-300"
          >
            {hasQuality ? "Kalite listesi" : "Mal kabul listesi"}
          </button>
        )}
      </div>
    </section>
  );
}
