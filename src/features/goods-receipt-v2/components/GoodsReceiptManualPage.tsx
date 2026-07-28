import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Building2, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Loader2, PackagePlus, Plus, ScanBarcode, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppDateInput } from '@/components/shared/AppInput';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { parseLocalizedNumber } from '@/lib/project-format';
import { useAuthStore } from '@/stores/auth-store';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import type { ActiveUserOption, ManualGoodsReceiptResult, ManualReceiptLine, PutawayLocationSuggestion, SeriesOption } from '../types/goods-receipt.types';

const today = (): string => new Date().toLocaleDateString('en-CA');
const split = (value: string | null): string[] => value?.split('|') ?? [];
const normalizeReceiptNo = (value: string, electronic: boolean): string => electronic
  ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  : value.replace(/\D/g, '').slice(0, 15);
const validReceiptNo = (value: string, electronic: boolean): boolean => electronic
  ? /^[A-Z0-9]{3}[0-9]{13}$/.test(value)
  : /^[0-9]{15}$/.test(value);
const userLabel = (user: ActiveUserOption): string => `${user.firstName} ${user.lastName}`.trim() || user.username;
const encodeUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string): ActiveUserOption => JSON.parse(decodeURIComponent(value)) as ActiveUserOption;

export function GoodsReceiptManualPage({ direct }: { direct: boolean }): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<string | null>(null);
  const [receiptNo, setReceiptNo] = useState('');
  const [isElectronic, setIsElectronic] = useState(false);
  const [documentDate, setDocumentDate] = useState(today);
  const [plannedArrival, setPlannedArrival] = useState('');
  const [warehouse, setWarehouse] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [priority, setPriority] = useState('3');
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualGoodsReceiptResult | null>(null);
  const warehouseId = Number(split(warehouse)[0] || 0);
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const receiptNoValid = validReceiptNo(receiptNo, isElectronic);
  const steps = [
    { label: t('manual.steps.document'), icon: FileText },
    { label: t('manual.steps.operation'), icon: Building2 },
    { label: t('manual.steps.lines'), icon: PackagePlus },
    { label: t('manual.steps.review'), icon: ClipboardCheck },
  ];

  useEffect(() => {
    setLocationId(null); setLineLocation(null); setLocationSuggestions([]); setSeries([]); setSeriesId(null);
    if (!warehouseId) return;
    void goodsReceiptV2Api.series(warehouseId).then((items) => {
      setSeries(items); const preferred = items.find((item) => item.isDefault) ?? items[0]; setSeriesId(preferred ? String(preferred.id) : null);
    }).catch((cause: Error) => setError(cause.message));
    void goodsReceiptV2Api.receivingLocations({
      pageNumber: 1, pageSize: 100, search: undefined, filterLogic: 'and', filters: [], sortBy: 'code', sortDirection: 'asc', signal: new AbortController().signal,
    }, warehouseId).then((page) => {
      const preferred = page.items.find((item) => item.locationType === 'Receiving') ?? page.items[0];
      if (preferred) {
        setLocationId(String(preferred.id));
        setLineLocation(`${preferred.id}|${preferred.code}`);
      }
    }).catch(() => undefined);
  }, [warehouseId]);

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

  const showError = (message: string): false => { setError(message); toast.error(message); return false; };
  const canLeaveStep = (): boolean => {
    if (step === 0 && !customer) return showError(t('manual.validation.customer'));
    if (step === 0 && !receiptNoValid) return showError(isElectronic ? t('manual.validation.eReceiptNo') : t('manual.validation.receiptNo'));
    if (step === 0 && !documentDate) return showError(t('manual.validation.date'));
    if (step === 1 && (!warehouseId || !locationId || !seriesId)) return showError(t('manual.validation.operation'));
    if (step === 1 && !direct && assignees.length === 0) return showError('Emir için en az bir operasyon kullanıcısı atanmalıdır.');
    if (step === 2 && lines.length === 0) return showError(t('manual.validation.lines'));
    setError(null); return true;
  };
  const next = (): void => { if (canLeaveStep()) setStep((current) => Math.min(3, current + 1)); };

  const addLine = (): void => {
    const [stockId, stockCode, encodedName, encodedUnit] = split(stock); const numericQuantity = parseLocalizedNumber(quantity);
    if (!stockId || !Number.isFinite(numericQuantity) || numericQuantity <= 0) { showError(t('manual.validation.stock')); return; }
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
    const [yapCodeId, yapCode] = split(yap);
    const [receivingLocationId, receivingLocationCode] = split(lineLocation);
    const base = { stockId: Number(stockId), stockCode, stockName: encodedName ? decodeURIComponent(encodedName) : undefined,
      yapCodeId: yapCodeId ? Number(yapCodeId) : undefined, yapCode: yapCode || undefined, unitCode: stockUnitCode,
      targetWarehouseId: warehouseId, targetWarehouseCode: Number(split(warehouse)[2] || 0) || undefined,
      receivingLocationId: Number(receivingLocationId), receivingLocationCode,
      lotNo: lotNo.trim() || undefined, manufacturingDate: manufacturingDate || undefined,
      expirationDate: expirationDate || undefined };
    const nextLines: ManualReceiptLine[] = serials.length
      ? serials.map((serial) => ({ ...base, localId: crypto.randomUUID(), quantity: 1, serialNo: serial, scannedBarcode: serial }))
      : [{ ...base, localId: crypto.randomUUID(), quantity: numericQuantity, serialNo: serialNo.trim() || undefined, scannedBarcode: scannedBarcode.trim() || undefined }];
    setLines((current) => [...current, ...nextLines]);
    setStock(null); setUnitCode(''); setYap(null); setQuantity('1'); setLineLocation(null); setLocationSuggestions([]); setLotNo(''); setSerialNo(''); setSerialBatch(''); setManufacturingDate(''); setExpirationDate(''); setScannedBarcode(''); setError(null);
  };

  const submit = async (): Promise<void> => {
    const [supplierId, supplierBranch] = split(customer);
    if (!supplierId || !warehouseId || !locationId || !seriesId || !receiptNoValid || lines.length === 0) { showError(t('manual.validation.incomplete')); return; }
    setBusy(true); setError(null);
    try {
      const payload = { idempotencyKey: crypto.randomUUID(), branchCode: supplierBranch || branchCode, documentSeriesId: Number(seriesId), supplierId: Number(supplierId),
        targetWarehouseId: warehouseId, receivingLocationId: Number(locationId), documentDate,
        waybillNo: isElectronic ? null : receiptNo, waybillDate: documentDate, electronicWaybillNo: isElectronic ? receiptNo : null,
        shipmentReferenceNo: null, carrierCode: null, carrierName: null, vehiclePlate: null, trailerPlate: null, driverName: null, sealNo: null,
        plannedArrivalAtUtc: plannedArrival ? new Date(plannedArrival).toISOString() : null, occurredAtUtc: direct ? new Date().toISOString() : null,
        labelStrategy, executionMode, priority: Number(priority), deviceId: null, description: description.trim() || null,
        assignedUserIds: direct ? null : assignees.map((user) => user.id),
        lines: lines.map((line) => ({ stockId: line.stockId, yapCodeId: line.yapCodeId ?? null, quantity: line.quantity, unitCode: line.unitCode,
          lotNo: line.lotNo ?? null, serialNo: line.serialNo ?? null, manufacturingDate: line.manufacturingDate ?? null,
          expirationDate: line.expirationDate ?? null, scannedBarcode: line.scannedBarcode ?? null, goodsReceiptLabelId: null,
          description: line.description ?? null, targetWarehouseId: line.targetWarehouseId, receivingLocationId: line.receivingLocationId })) };
      const created = direct ? await goodsReceiptV2Api.createDirect(payload) : await goodsReceiptV2Api.createOrderless(payload);
      setResult(created); toast.success(t('manual.success'));
    } catch (cause) { const message = cause instanceof Error ? cause.message : t('manual.validation.submit'); setError(message); toast.error(message); }
    finally { setBusy(false); }
  };

  if (!moduleReady) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-7 animate-spin text-cyan-500"/></div>;
  if (result) return <Result result={result} direct={direct} reset={() => { setResult(null); setLines([]); setStep(0); setReceiptNo(''); }} t={t}/>;
  return <section className="mx-auto max-w-7xl space-y-5">
    <header className="overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm"><div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500"/><div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div className="flex gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500"><PackagePlus/></div><div><div className="text-xs font-bold uppercase tracking-[.18em] text-cyan-500">{t('manual.eyebrow')}</div><h1 className="mt-1 text-2xl font-bold">{direct ? t('manual.directTitle') : t('manual.orderlessTitle')}</h1><p className="mt-1 text-sm text-slate-500">{direct ? t('manual.directSubtitle') : t('manual.orderlessSubtitle')}</p></div></div><div className="rounded-xl border border-[var(--wms-app-border)] bg-black/5 px-4 py-2 text-sm dark:bg-white/5"><span className="text-slate-500">{t('manual.currentStep')}</span><strong className="ml-2">{step + 1}/4</strong></div></div></header>
    <Stepper steps={steps} current={step}/>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</div>}

    {step === 0 && <Panel title={t('manual.document.title')} description={t('manual.document.description')} icon={<FileText/>}><div className="grid gap-5 lg:grid-cols-2">
      <Field label={t('manual.customer')} required><PagedAppDropdown queryKey={['gr-manual-customers', branchCode]} fetchPage={(request) => goodsReceiptV2Api.customers(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.branchCode}|${x.customerCode}|${encodeURIComponent(x.customerName)}`, label: `${x.customerCode} · ${x.customerName}` })} value={customer} onValueChange={setCustomer} searchable minSearchLength={2}/></Field>
      <Field label={t('manual.documentDate')} required><AppDateInput value={documentDate} onChange={(e) => setDocumentDate(e.target.value)}/></Field>
      <div className="lg:col-span-2 rounded-2xl border border-[var(--wms-app-border)] bg-black/[.025] p-4 dark:bg-white/[.025]"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{t('manual.receiptNo')}</h3><p className="text-xs text-slate-500">{isElectronic ? t('manual.eReceiptHint') : t('manual.receiptHint')}</p></div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4 py-2"><input type="checkbox" checked={isElectronic} onChange={(e) => { setIsElectronic(e.target.checked); setReceiptNo(''); setError(null); }} className="size-4 accent-cyan-500"/><span className="text-sm font-semibold">{t('manual.isElectronic')}</span></label></div><div className="relative"><input autoFocus className={`input pr-24 font-mono tracking-wider ${receiptNo && !receiptNoValid ? '!border-red-500' : receiptNoValid ? '!border-emerald-500' : ''}`} inputMode={isElectronic ? 'text' : 'numeric'} maxLength={isElectronic ? 16 : 15} placeholder={isElectronic ? 'GIB2026000000001' : '000000000000001'} value={receiptNo} onChange={(e) => { setReceiptNo(normalizeReceiptNo(e.target.value, isElectronic)); setError(null); }}/><span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${receiptNoValid ? 'text-emerald-500' : 'text-slate-500'}`}>{receiptNo.length}/{isElectronic ? 16 : 15}</span></div>{receiptNo && <p className={`mt-2 flex items-center gap-1.5 text-xs ${receiptNoValid ? 'text-emerald-500' : 'text-red-500'}`}>{receiptNoValid && <Check className="size-3.5"/>}{receiptNoValid ? t('manual.validNumber') : (isElectronic ? t('manual.validation.eReceiptNo') : t('manual.validation.receiptNo'))}</p>}</div>
      {!direct && <Field label={t('manual.plannedArrival')}><AppDateInput type="datetime-local" value={plannedArrival} onChange={(e) => setPlannedArrival(e.target.value)}/></Field>}
    </div></Panel>}

    {step === 1 && <Panel title={t('manual.operation.title')} description={t('manual.operation.description')} icon={<Building2/>}><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Field label={t('manual.warehouse')} required><PagedAppDropdown queryKey={['gr-manual-warehouses', branchCode]} fetchPage={(request) => goodsReceiptV2Api.warehouses(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.branchCode}|${x.warehouseCode}|${encodeURIComponent(x.warehouseName)}`, label: `${x.warehouseCode} · ${x.warehouseName}` })} value={warehouse} onValueChange={setWarehouse} searchable/></Field>
      <Field label={t('manual.location')} required><PagedAppDropdown queryKey={['gr-manual-receiving-locations', warehouseId]} fetchPage={(request) => goodsReceiptV2Api.receivingLocations(request, warehouseId)} toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}`, description: x.locationType })} enabled={warehouseId > 0} dependencies={[warehouseId]} value={locationId} onValueChange={setLocationId} searchable placeholder="Receiving / Staging"/></Field>
      <Field label={t('manual.series')} required><AppDropdown value={seriesId} onValueChange={setSeriesId} options={series.map((x) => ({ value: String(x.id), label: `${x.code} · ${x.name}`, description: x.previewDocumentNumber }))}/></Field>
      <Field label={t('manual.priority')}><AppDropdown value={priority} onValueChange={setPriority} options={[1,2,3,4,5].map((value) => ({ value: String(value), label: String(value) }))}/></Field>
      <Field label={t('manual.labelStrategy')}><AppDropdown value={labelStrategy} onValueChange={setLabelStrategy} options={[{value:'None',label:t('manual.options.noLabel')},{value:'PreGenerate',label:t('manual.options.preGenerate')},{value:'SupplierLabel',label:t('manual.options.supplierLabel')},{value:'GenerateOnReceipt',label:t('manual.options.generateOnReceipt')}]}/></Field>
      {direct && <Field label={t('manual.executionMode')}><AppDropdown value={executionMode} onValueChange={setExecutionMode} options={[{value:'Manual',label:t('manual.options.manual')},{value:'BarcodeScan',label:t('manual.options.barcode')},{value:'PreGeneratedLabel',label:t('manual.options.preLabel')},{value:'SupplierLabel',label:t('manual.options.supplierLabel')}]}/></Field>}
    </div>{!direct&&<section className="mt-5 rounded-xl border border-[var(--wms-app-border)] p-4"><h3 className="font-bold">Emir sorumluları <span className="text-red-500">*</span></h3><p className="mb-3 text-xs text-slate-500">Siparişsiz emir seçilen kullanıcılara atanır ve “Bana Atanan Emirler” kuyruğuna düşer.</p><PagedAppDropdown queryKey={['gr-manual-active-users']} fetchPage={goodsReceiptV2Api.activeUsersPaged} toOption={user=>({value:encodeUser(user),label:userLabel(user),description:`${user.username} · ${user.email}`,disabled:assignees.some(selected=>selected.id===user.id)})} value={null} onValueChange={value=>{const user=decodeUser(value);setAssignees(current=>current.some(x=>x.id===user.id)?current:[...current,user])}} placeholder="Operasyon kullanıcısı ekle" searchable minSearchLength={2}/><div className="mt-3 flex flex-wrap gap-2">{assignees.map(user=><span key={user.id} className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm"><strong>{userLabel(user)}</strong><button type="button" onClick={()=>setAssignees(current=>current.filter(x=>x.id!==user.id))} className="text-red-500">×</button></span>)}</div></section>}</Panel>}

    {step === 2 && <Panel title={t('manual.lines.title')} description={t('manual.lines.description')} icon={<ScanBarcode/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label={t('manual.stock')} required><PagedAppDropdown queryKey={['gr-manual-stocks', branchCode]} fetchPage={(request) => goodsReceiptV2Api.stocks(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.erpStockCode}|${encodeURIComponent(x.stockName || '')}|${encodeURIComponent(x.unitCode || '')}`, label: `${x.erpStockCode} · ${x.stockName || ''}`, description: x.unitCode ? `Birim: ${x.unitCode}` : 'Birim tanımsız' })} value={stock} onValueChange={(value) => { setStock(value); setUnitCode(decodeURIComponent(split(value)[3] || '')); }} searchable minSearchLength={2}/></Field>
      <Field label={t('manual.yap')}><PagedAppDropdown queryKey={['gr-manual-yaps', branchCode]} fetchPage={(request) => goodsReceiptV2Api.yapCodes(request, branchCode)} toOption={(x) => ({ value: `${x.id}|${x.configurationCode}`, label: `${x.configurationCode} · ${x.description || ''}` })} value={yap} onValueChange={setYap} searchable minSearchLength={1}/></Field>
      <Field label={t('manual.quantity')} required><input className="input font-mono" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)}/></Field><Field label={t('manual.unit')}><div className={`input flex items-center font-bold ${unitCode ? 'text-cyan-600' : 'text-amber-600'}`}>{unitCode || 'Önce stok seçin'}</div></Field>
      <Field label="Kabul rafı (Receiving / Staging)" required><PagedAppDropdown queryKey={['gr-manual-line-receiving-locations', warehouseId]} fetchPage={(request) => goodsReceiptV2Api.receivingLocations(request, warehouseId)} toOption={(x) => ({ value: `${x.id}|${x.code}`, label: `${x.code} · ${x.name}`, description: x.locationType })} enabled={warehouseId > 0} dependencies={[warehouseId]} value={lineLocation} onValueChange={setLineLocation} searchable/></Field>
      <Field label={t('manual.lot')}><input className="input" maxLength={100} value={lotNo} onChange={(e) => setLotNo(e.target.value)}/></Field><Field label={t('manual.serial')}><input className="input" maxLength={100} value={serialNo} onChange={(e) => setSerialNo(e.target.value)}/></Field>
      <Field label={t('manual.manufacturingDate')}><AppDateInput value={manufacturingDate} onChange={(e) => setManufacturingDate(e.target.value)}/></Field><Field label={t('manual.expirationDate')}><AppDateInput value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}/></Field>
      {direct && <Field label={t('manual.scannedBarcode')}><input className="input" maxLength={250} value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)}/></Field>}
      <div className="flex items-end"><button type="button" onClick={addLine} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-semibold text-white"><Plus className="size-4"/>{t('manual.addLine')}</button></div>
    </div><section className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="flex items-start gap-3"><ScanBarcode className="mt-0.5 size-5 shrink-0 text-cyan-500"/><div><h3 className="font-bold">Toplu seri ve barkod okutma</h3><p className="text-xs leading-5 text-slate-500">Miktar 13 ise okuyucuyla 13 farklı seriyi satır satır okutun. Her seri API’ye 1 miktarlı ayrı izlenebilir kalem olarak gönderilir.</p></div></div><textarea className="input mt-3 min-h-28 font-mono" value={serialBatch} onChange={(event) => setSerialBatch(event.target.value)} placeholder={'SN-000001\\nSN-000002\\nSN-000003'} aria-label="Toplu seri barkodları"/><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span>Okutulan: <strong>{serialBatch.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean).length}</strong> / Miktar: <strong>{Number(quantity) || 0}</strong></span><button type="button" onClick={() => setSerialBatch('')} disabled={!serialBatch} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40">Listeyi temizle</button></div></section>
      {(suggestionsBusy || locationSuggestions.length > 0) && <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-500">{suggestionsBusy && <Loader2 className="size-4 animate-spin"/>}Önerilen putaway rafları (bilgi)</div><p className="mb-2 text-xs text-slate-500">Kabul rafı değildir; yalnızca Receiving/Staging seçin. Bu liste sonraki raflama için bilgi amaçlıdır.</p><div className="flex flex-wrap gap-2">{locationSuggestions.map((item, index) => <div key={item.id} className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-2 text-left text-xs"><strong>{index + 1}. {item.code}</strong><span className="ml-2 text-slate-500">{item.reason}</span>{item.remainingCapacity != null && <span className="ml-2 font-mono text-slate-500">Kalan: {item.remainingCapacity}</span>}</div>)}</div></div>}
      <LineTable lines={lines} remove={(id) => setLines((current) => current.filter((line) => line.localId !== id))} t={t}/></Panel>}

    {step === 3 && <Panel title={t('manual.review.title')} description={t('manual.review.description')} icon={<ClipboardCheck/>}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Summary label={t('manual.customer')} value={`${split(customer)[2] || '—'} · ${decodeURIComponent(split(customer)[3] || '')}`}/><Summary label={t('manual.receiptNo')} value={receiptNo}/><Summary label={t('manual.documentType')} value={isElectronic ? t('manual.eReceipt') : t('manual.normalReceipt')}/><Summary label={t('manual.documentDate')} value={documentDate}/><Summary label={t('manual.warehouse')} value={`${split(warehouse)[2] || '—'} · ${decodeURIComponent(split(warehouse)[3] || '')}`}/><Summary label={t('manual.lineCount')} value={String(lines.length)}/><Summary label={t('manual.totalQuantity')} value={String(total)}/><Summary label={t('manual.operationType')} value={direct ? t('manual.direct') : t('manual.orderless')}/>{!direct&&<Summary label="Emir sorumluları" value={assignees.map(userLabel).join(', ')||'—'}/>}</div><Field label={t('manual.description')}><textarea className="input mt-5 min-h-24" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)}/></Field></Panel>}

    <footer className="sticky bottom-3 z-20 flex items-center justify-between rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]/95 p-3 shadow-xl backdrop-blur"><button disabled={step === 0 || busy} onClick={() => { setError(null); setStep((current) => Math.max(0, current - 1)); }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-5 py-2.5 font-semibold disabled:opacity-30"><ChevronLeft className="size-4"/>{t('back')}</button><div className="hidden text-xs text-slate-500 sm:block">{steps[step]?.label}</div>{step < 3 ? <button onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white">{t('continue')}<ChevronRight className="size-4"/></button> : <button disabled={busy} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin"/> : <CheckCircle2 className="size-4"/>}{direct ? t('manual.postReceipt') : t('manual.createTask')}</button>}</footer>
  </section>;
}

export const GoodsReceiptOrderlessPage = (): ReactElement => <GoodsReceiptManualPage direct={false}/>;
export const GoodsReceiptDirectPage = (): ReactElement => <GoodsReceiptManualPage direct/>;
function Stepper({ steps, current }: { steps: Array<{label:string;icon:typeof FileText}>; current:number }): ReactElement { return <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">{steps.map(({label,icon:Icon},index)=><li key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${index===current?'border-cyan-500 bg-cyan-500/10 text-cyan-500':index<current?'border-emerald-500/30 bg-emerald-500/5 text-emerald-500':'border-[var(--wms-app-border)] text-slate-500'}`}><span className="grid size-8 shrink-0 place-items-center rounded-full border border-current">{index<current?<Check className="size-4"/>:<Icon className="size-4"/>}</span><span className="text-sm font-bold">{index+1}. {label}</span></li>)}</ol>; }
function Panel({title,description,icon,children}:{title:string;description:string;icon:ReactElement;children:ReactNode}):ReactElement{return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] shadow-sm"><header className="flex gap-3 border-b border-[var(--wms-app-border)] p-5"><span className="text-cyan-500">{icon}</span><div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-slate-500">{description}</p></div></header><div className="p-5">{children}</div></section>;}
function Field({label,required,children}:{label:string;required?:boolean;children:ReactNode}):ReactElement{return <label className="block space-y-1.5 text-sm"><span className="font-semibold">{label}{required&&<span className="text-red-500"> *</span>}</span>{children}</label>;}
function Summary({label,value}:{label:string;value:string}):ReactElement{return <div className="rounded-xl border border-[var(--wms-app-border)] bg-black/[.025] p-4 dark:bg-white/[.025]"><div className="text-xs text-slate-500">{label}</div><strong className="mt-1 block break-words text-sm">{value}</strong></div>;}
function LineTable({lines,remove,t}:{lines:ManualReceiptLine[];remove:(id:string)=>void;t:(key:string)=>string}):ReactElement{return <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]"><table className="w-full text-sm"><thead className="bg-black/5 text-left dark:bg-white/5"><tr><th className="p-3">{t('manual.stock')}</th><th className="p-3">{t('manual.yap')}</th><th className="p-3">Depo / Raf</th><th className="p-3">{t('manual.lot')} / {t('manual.serial')}</th><th className="p-3 text-right">{t('manual.quantity')}</th><th className="p-3">{t('manual.actions')}</th></tr></thead><tbody>{lines.map((line)=><tr key={line.localId} className="border-t border-[var(--wms-app-border)]"><td className="p-3"><strong>{line.stockCode}</strong><div className="text-xs text-slate-500">{line.stockName}</div></td><td className="p-3">{line.yapCode||'—'}</td><td className="p-3"><strong>{line.targetWarehouseCode ?? '—'}</strong><div className="text-xs text-cyan-500">{line.receivingLocationCode}</div></td><td className="p-3">{line.lotNo||'—'} / {line.serialNo||'—'}</td><td className="p-3 text-right font-mono">{line.quantity} {line.unitCode}</td><td className="p-3"><button aria-label={t('manual.removeLine')} onClick={()=>remove(line.localId)} className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"><Trash2 className="size-4"/></button></td></tr>)}</tbody></table>{lines.length===0&&<p className="p-6 text-center text-sm text-slate-500">{t('manual.noLines')}</p>}</div>;}
function Result({result,direct,reset,t}:{result:ManualGoodsReceiptResult;direct:boolean;reset:()=>void;t:(key:string)=>string}):ReactElement{
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
          {direct ? 'Mal kabul sonrası irsaliye oluşturuldu' : t('manual.resultOrderless')}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">
          {direct
            ? 'Fiziksel kabul kaydı tamamlandı. Belge numarası aşağıda; kalite gerekiyorsa inceleme listesine aktarılmıştır.'
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
            {result.qualityInspectionId ? 'Kaliteye gönderildi' : result.taskNo || result.status}
          </strong>
        </div>
      </div>
      <div className="border-t border-emerald-500/20 px-8 py-5 text-center">
        <button onClick={reset} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white">{t('manual.newRecord')}</button>
      </div>
    </section>
  );
}
