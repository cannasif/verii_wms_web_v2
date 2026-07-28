import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Eye,
  Factory,
  ListChecks,
  Loader2,
  Plus,
  Rocket,
  Trash2,
  UserRoundCog,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDateInput } from '@/components/shared/AppInput';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { formatProjectDate, formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { useAuthStore } from '@/stores/auth-store';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type {
  ActiveUserOption,
  SeriesOption,
  StockOption,
  WarehouseOption,
  YapCodeOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { productionApi } from './api';
import type {
  CreateProductionPlanResult,
  ProductionExecutionMode,
  ProductionPlanDetail,
  ProductionPlanGridRow,
  ProductionPlanType,
} from './types';

const today = () => new Date().toLocaleDateString('en-CA');
const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const decode = <T,>(value: string | null): T | null => value ? JSON.parse(decodeURIComponent(value)) as T : null;
const warehouseOption = (x: WarehouseOption) => ({ value: encode(x), label: `${x.warehouseCode} · ${x.warehouseName}` });
const stockOption = (x: StockOption) => ({ value: encode(x), label: `${x.erpStockCode} · ${x.stockName}`, description: x.unitCode });
const yapOption = (x: YapCodeOption) => ({ value: encode(x), label: `${x.configurationCode} · ${x.description ?? ''}` });
const userOption = (x: ActiveUserOption) => ({
  value: encode(x),
  label: `${x.firstName} ${x.lastName}`.trim() || x.username,
  description: x.username,
});

interface MaterialForm {
  localId: string;
  stockValue: string | null;
  yapValue: string | null;
  quantity: number;
  issueMode: 'Manual' | 'Backflush';
  isMandatory: boolean;
}
const blankMaterial = (): MaterialForm => ({
  localId: crypto.randomUUID(),
  stockValue: null,
  yapValue: null,
  quantity: 1,
  issueMode: 'Manual',
  isMandatory: true,
});

export function ProductionHubPage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('production');
  if (!moduleReady) return <ModuleLoading />;
  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[image:var(--wms-brand-gradient-soft)] p-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">{t('hub.eyebrow')}</p>
      <h1 className="mt-1 text-2xl font-black">{t('hub.title')}</h1>
      <p className="mt-2 max-w-4xl text-sm text-[var(--wms-app-text-muted)]">{t('hub.description')}</p>
    </header>
    <div className="grid gap-4 md:grid-cols-2">
      <HubCard href="/warehouse/production/new" icon={<Factory />} title={t('hub.create.title')} text={t('hub.create.text')} />
      <HubCard href="/warehouse/production/list" icon={<ListChecks />} title={t('hub.list.title')} text={t('hub.list.text')} />
    </div>
    <section className="rounded-2xl border border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] p-5">
      <h2 className="font-black text-[var(--wms-brand-primary)]">{t('hub.boundary.title')}</h2>
      <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{t('hub.boundary.text')}</p>
    </section>
  </section>;
}

export function ProductionCreatePage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('production');
  const branchCode = useAuthStore((x) => x.branch?.code ?? '0');
  const [sourceWarehouseValue, setSourceWarehouseValue] = useState<string | null>(null);
  const [targetWarehouseValue, setTargetWarehouseValue] = useState<string | null>(null);
  const sourceWarehouse = decode<WarehouseOption>(sourceWarehouseValue);
  const targetWarehouse = decode<WarehouseOption>(targetWarehouseValue);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState(today);
  const [planType, setPlanType] = useState<ProductionPlanType>('MakeToStock');
  const [executionMode, setExecutionMode] = useState<ProductionExecutionMode>('Serial');
  const [priority, setPriority] = useState('3');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [description, setDescription] = useState('');
  const [stockValue, setStockValue] = useState<string | null>(null);
  const [yapValue, setYapValue] = useState<string | null>(null);
  const producedStock = decode<StockOption>(stockValue);
  const producedYap = decode<YapCodeOption>(yapValue);
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [externalOrderNo, setExternalOrderNo] = useState('');
  const [workCenterCode, setWorkCenterCode] = useState('');
  const [bomReference, setBomReference] = useState('');
  const [routingReference, setRoutingReference] = useState('');
  const [assigneeValue, setAssigneeValue] = useState<string | null>(null);
  const assignee = decode<ActiveUserOption>(assigneeValue);
  const [materials, setMaterials] = useState<MaterialForm[]>([blankMaterial()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateProductionPlanResult | null>(null);

  useEffect(() => {
    setSeries([]);
    setSeriesId(null);
    if (!sourceWarehouse?.id) return;
    void warehouseTransferApi.series('ProductionOrder')
      .then((rows) => {
        setSeries(rows);
        const preferred = rows.find((x) => x.isDefault) ?? rows[0];
        setSeriesId(preferred ? String(preferred.id) : null);
      })
      .catch((error: Error) => toast.error(error.message));
  }, [sourceWarehouse?.id]);

  const patchMaterial = (id: string, value: Partial<MaterialForm>) =>
    setMaterials((rows) => rows.map((row) => row.localId === id ? { ...row, ...value } : row));

  const save = async () => {
    if (!sourceWarehouse || !targetWarehouse || !seriesId || !producedStock) {
      toast.error(t('create.validation.header'));
      return;
    }
    if (plannedQuantity <= 0) {
      toast.error(t('create.validation.quantity'));
      return;
    }
    if (!assignee && !workCenterCode.trim()) {
      toast.error(t('create.validation.assignment'));
      return;
    }
    const materialPayload = materials.filter((row) => row.stockValue).map((row) => {
      const stock = decode<StockOption>(row.stockValue)!;
      const yap = decode<YapCodeOption>(row.yapValue);
      return {
        stockId: stock.id,
        yapCodeId: yap?.id ?? null,
        requiredQuantity: row.quantity,
        sourceWarehouseId: sourceWarehouse.id,
        preferredSourceLocationId: null,
        issueMode: row.issueMode,
        isMandatory: row.isMandatory,
      };
    });
    if (materialPayload.some((row) => row.requiredQuantity <= 0)) {
      toast.error(t('create.validation.materialQuantity'));
      return;
    }
    setBusy(true);
    try {
      const created = await productionApi.create({
        idempotencyKey: crypto.randomUUID(),
        branchCode,
        documentSeriesId: Number(seriesId),
        documentDate,
        planType,
        executionMode,
        priority: Number(priority),
        customerId: null,
        plannedStartAtUtc: plannedStart ? new Date(plannedStart).toISOString() : null,
        plannedEndAtUtc: plannedEnd ? new Date(plannedEnd).toISOString() : null,
        description: description.trim() || null,
        orders: [{
          localKey: crypto.randomUUID(),
          externalOrderNo: externalOrderNo.trim() || null,
          sequenceNo: 1,
          parallelGroupNo: null,
          bomReference: bomReference.trim() || null,
          routingReference: routingReference.trim() || null,
          workCenterCode: workCenterCode.trim() || null,
          producedStockId: producedStock.id,
          producedYapCodeId: producedYap?.id ?? null,
          plannedQuantity,
          sourceWarehouseId: sourceWarehouse.id,
          targetWarehouseId: targetWarehouse.id,
          requireMaterialTransferBeforeStart: materialPayload.length > 0,
          plannedStartAtUtc: plannedStart ? new Date(plannedStart).toISOString() : null,
          plannedEndAtUtc: plannedEnd ? new Date(plannedEnd).toISOString() : null,
          description: description.trim() || null,
          assignedUserIds: assignee ? [assignee.id] : [],
          materials: materialPayload,
          outputs: [{
            stockId: producedStock.id,
            yapCodeId: producedYap?.id ?? null,
            plannedQuantity,
            targetWarehouseId: targetWarehouse.id,
            preferredTargetLocationId: null,
            isPrimary: true,
          }],
        }],
        dependencies: [],
      });
      setResult(created);
      toast.success(t('create.success'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('create.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!moduleReady) return <ModuleLoading />;

  if (result) return <section className="mx-auto max-w-3xl rounded-2xl border border-[color-mix(in_oklab,var(--wms-brand-secondary)_30%,transparent)] bg-[color-mix(in_oklab,var(--wms-brand-secondary)_10%,transparent)] p-8 text-center">
    <CheckCircle2 className="mx-auto size-12 text-[var(--wms-brand-secondary)]" />
    <h1 className="mt-3 text-2xl font-black">{t('create.result.title')}</h1>
    <p className="mt-2 font-mono text-xl">{result.documentNo}</p>
    <p className="mt-2 text-sm text-[var(--wms-app-text-muted)]">{t('create.result.summary', {
      orderCount: result.orderCount,
      materialCount: result.materialCount,
      outputCount: result.outputCount,
    })}</p>
    <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
      <button type="button" onClick={() => setResult(null)} className="min-h-11 rounded-xl border border-[var(--wms-app-border)] px-5">{t('create.result.new')}</button>
      <Link to="/warehouse/production/list" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--wms-brand-primary)] px-5 font-bold text-[var(--wms-brand-on-primary)]">{t('create.result.list')}</Link>
    </div>
  </section>;

  return <section className="space-y-5">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--wms-brand-primary)]">{t('create.eyebrow')}</p>
      <h1 className="mt-1 text-2xl font-black">{t('create.title')}</h1>
      <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{t('create.description')}</p>
    </header>
    <Panel title={t('create.sections.plan')} icon={<Factory className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t('create.fields.sourceWarehouse')}>
          <PagedAppDropdown queryKey={['production-source', branchCode]} fetchPage={(request) => warehouseTransferApi.warehouses(request, branchCode)} toOption={warehouseOption} value={sourceWarehouseValue} onValueChange={setSourceWarehouseValue} searchable />
        </Field>
        <Field label={t('create.fields.targetWarehouse')}>
          <PagedAppDropdown queryKey={['production-target', branchCode]} fetchPage={(request) => warehouseTransferApi.warehouses(request, branchCode)} toOption={warehouseOption} value={targetWarehouseValue} onValueChange={setTargetWarehouseValue} searchable />
        </Field>
        <Field label={t('create.fields.series')}>
          <AppDropdown value={seriesId} onValueChange={setSeriesId} options={series.map((x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` }))} disabled={!sourceWarehouse} />
        </Field>
        <Field label={t('create.fields.documentDate')}><AppDateInput value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></Field>
        <Field label={t('create.fields.planType')}><AppDropdown value={planType} onValueChange={(value) => setPlanType(value as ProductionPlanType)} options={(['MakeToStock', 'MakeToOrder', 'Rework', 'Disassembly'] as const).map((value) => ({ value, label: t(`enum.planType.${value}`) }))} /></Field>
        <Field label={t('create.fields.executionMode')}><AppDropdown value={executionMode} onValueChange={(value) => setExecutionMode(value as ProductionExecutionMode)} options={(['Serial', 'Parallel'] as const).map((value) => ({ value, label: t(`enum.executionMode.${value}`) }))} /></Field>
        <Field label={t('create.fields.priority')}><input className="input" type="number" min={1} max={9} value={priority} onChange={(event) => setPriority(event.target.value)} /></Field>
        <Field label={t('create.fields.plannedStart')}><AppDateInput type="datetime-local" value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} /></Field>
        <Field label={t('create.fields.plannedEnd')}><AppDateInput type="datetime-local" value={plannedEnd} onChange={(event) => setPlannedEnd(event.target.value)} /></Field>
      </div>
    </Panel>
    <Panel title={t('create.sections.order')} icon={<Boxes className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t('create.fields.producedStock')}>
          <PagedAppDropdown queryKey={['production-stock', branchCode]} fetchPage={(request) => warehouseTransferApi.stocks(request, branchCode)} toOption={stockOption} value={stockValue} onValueChange={(value) => { setStockValue(value); setYapValue(null); }} searchable minSearchLength={2} />
        </Field>
        <Field label={t('create.fields.configurationCode')}>
          <PagedAppDropdown queryKey={['production-yap', branchCode, producedStock?.id]} fetchPage={(request) => warehouseTransferApi.yapCodes(request, branchCode)} toOption={yapOption} value={yapValue} onValueChange={setYapValue} searchable minSearchLength={1} disabled={!producedStock} />
        </Field>
        <Field label={t('create.fields.quantity')}><input className="input" type="number" min={0.000001} step="any" value={plannedQuantity} onChange={(event) => setPlannedQuantity(Number(event.target.value))} /></Field>
        <Field label={t('create.fields.unit')}><input className="input" readOnly value={producedStock?.unitCode ?? ''} /></Field>
        <Field label={t('create.fields.externalOrderNo')}><input className="input" maxLength={100} value={externalOrderNo} onChange={(event) => setExternalOrderNo(event.target.value)} /></Field>
        <Field label={t('create.fields.workCenter')}><input className="input" maxLength={100} value={workCenterCode} onChange={(event) => setWorkCenterCode(event.target.value.toUpperCase())} /></Field>
        <Field label={t('create.fields.bom')}><input className="input" maxLength={100} value={bomReference} onChange={(event) => setBomReference(event.target.value)} /></Field>
        <Field label={t('create.fields.routing')}><input className="input" maxLength={100} value={routingReference} onChange={(event) => setRoutingReference(event.target.value)} /></Field>
        <Field label={t('create.fields.assignee')}>
          <PagedAppDropdown queryKey={['production-assignee']} fetchPage={warehouseTransferApi.activeUsers} toOption={userOption} value={assigneeValue} onValueChange={setAssigneeValue} searchable minSearchLength={1} />
        </Field>
      </div>
    </Panel>
    <Panel title={t('create.sections.materials')} icon={<Boxes className="size-5" />}>
      <div className="space-y-3">
        {materials.map((row, index) => <article key={row.localId} className="rounded-xl border border-[var(--wms-app-border)] p-4">
          <div className="mb-3 flex items-center justify-between"><strong>{t('create.material', { number: index + 1 })}</strong><button type="button" onClick={() => setMaterials((rows) => rows.filter((x) => x.localId !== row.localId))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="size-4" /></button></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label={t('create.fields.materialStock')}><PagedAppDropdown queryKey={['production-material-stock', row.localId, branchCode]} fetchPage={(request) => warehouseTransferApi.stocks(request, branchCode)} toOption={stockOption} value={row.stockValue} onValueChange={(value) => patchMaterial(row.localId, { stockValue: value, yapValue: null })} searchable minSearchLength={2} /></Field>
            <Field label={t('create.fields.configurationCode')}><PagedAppDropdown queryKey={['production-material-yap', row.localId, branchCode]} fetchPage={(request) => warehouseTransferApi.yapCodes(request, branchCode)} toOption={yapOption} value={row.yapValue} onValueChange={(value) => patchMaterial(row.localId, { yapValue: value })} searchable minSearchLength={1} disabled={!row.stockValue} /></Field>
            <Field label={t('create.fields.requiredQuantity')}><input className="input" type="number" min={0.000001} step="any" value={row.quantity} onChange={(event) => patchMaterial(row.localId, { quantity: Number(event.target.value) })} /></Field>
            <Field label={t('create.fields.issueMode')}><AppDropdown value={row.issueMode} onValueChange={(value) => patchMaterial(row.localId, { issueMode: value as MaterialForm['issueMode'] })} options={(['Manual', 'Backflush'] as const).map((value) => ({ value, label: t(`enum.issueMode.${value}`) }))} /></Field>
            <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-[var(--wms-app-border)] px-3 text-sm"><input type="checkbox" checked={row.isMandatory} onChange={(event) => patchMaterial(row.localId, { isMandatory: event.target.checked })} />{t('create.fields.mandatory')}</label>
          </div>
        </article>)}
        <button type="button" onClick={() => setMaterials((rows) => [...rows, blankMaterial()])} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-brand-ring)] px-4 font-bold text-[var(--wms-brand-primary)]"><Plus className="size-4" />{t('create.addMaterial')}</button>
      </div>
    </Panel>
    <Panel title={t('create.sections.notes')} icon={<UserRoundCog className="size-5" />}>
      <textarea className="input h-auto py-3" rows={4} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
    </Panel>
    <div className="flex justify-end"><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-6 font-black text-[var(--wms-brand-on-primary)] disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Factory className="size-4" />}{busy ? t('create.saving') : t('create.save')}</button></div>
  </section>;
}

export function ProductionListPage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('production');
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ProductionPlanDetail | null>(null);
  const [lifecycle, setLifecycle] = useState<{ row: ProductionPlanGridRow; kind: 'release' | 'delete' } | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const load = useCallback(async (id: number) => {
    setLoadingId(id);
    try { setDetail(await productionApi.detail(id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('list.loadFailed')); }
    finally { setLoadingId(null); }
  }, [t]);
  const columns = useMemo<GridColumn<ProductionPlanGridRow>[]>(() => moduleReady ? [
    ...systemColumns<ProductionPlanGridRow>(),
    { key: 'documentNo', label: t('list.columns.documentNo'), sortable: true, filterable: true, render: (row) => <span className="font-mono font-bold">{row.documentNo}</span> },
    { key: 'documentDate', label: t('list.columns.documentDate'), sortable: true, filterable: true, render: (row) => formatProjectDate(row.documentDate) },
    { key: 'planType', label: t('list.columns.planType'), sortable: true, filterable: true, render: (row) => t(`enum.planType.${row.planType}`) },
    { key: 'executionMode', label: t('list.columns.executionMode'), sortable: true, filterable: true, render: (row) => t(`enum.executionMode.${row.executionMode}`) },
    { key: 'status', label: t('list.columns.status'), sortable: true, filterable: true, render: (row) => t(`enum.status.${row.status}`) },
    { key: 'orderCount', label: t('list.columns.orders'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.orderCount) },
    { key: 'materialCount', label: t('list.columns.materials'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.materialCount) },
    { key: 'plannedQuantity', label: t('list.columns.planned'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.plannedQuantity) },
    { key: 'completedQuantity', label: t('list.columns.completed'), sortable: true, filterable: true, render: (row) => formatProjectNumber(row.completedQuantity) },
    {
      key: 'actions', label: t('list.columns.actions'), ...requiredActionColumn,
      render: (row) => <div className="flex items-center gap-1">
        {row.status === 'Draft' && <button type="button" title={t('list.release')} onClick={() => setLifecycle({ row, kind: 'release' })} className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-500/10"><Rocket className="size-4" /></button>}
        {row.status === 'Draft' && <button type="button" title={t('list.delete')} onClick={() => setLifecycle({ row, kind: 'delete' })} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 className="size-4" /></button>}
        <button type="button" title={t('list.detail')} onClick={() => void load(row.id)} className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10">{loadingId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}</button>
      </div>,
    },
  ] : [], [load, loadingId, moduleReady, t]);
  if (!moduleReady) return <ModuleLoading />;
  return <>
    <AdvancedDataGrid refreshKey={revision} pageKey="production-plans" title={t('list.title')} description={t('list.description')} columns={columns} fetchPage={productionApi.paged} toolbarAction={{ label: t('list.create'), run: async () => navigate('/warehouse/production/new') }} />
    {detail && <ProductionDetailDialog detail={detail} close={() => setDetail(null)} />}
    {lifecycle && <ProductionLifecycleDialog value={lifecycle} close={() => setLifecycle(null)} completed={() => { setLifecycle(null); setRevision((value) => value + 1); }} />}
  </>;
}

function ModuleLoading(): ReactElement {
  return <div aria-busy="true" className="space-y-4">
    <div className="h-28 animate-pulse rounded-2xl bg-[var(--wms-brand-soft)]" />
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-36 animate-pulse rounded-2xl bg-[var(--wms-brand-soft)]" />
      <div className="h-36 animate-pulse rounded-2xl bg-[var(--wms-brand-soft)]" />
    </div>
  </div>;
}

function ProductionDetailDialog({ detail, close }: { detail: ProductionPlanDetail; close: () => void }) {
  const { t } = useModuleTranslation('production');
  return <ResponsiveDialog onClose={close} framed={false} title={detail.header.documentNo} className="max-h-[calc(100dvh-1rem)] !max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-3 pr-12"><div><p className="font-mono text-xl font-black">{detail.header.documentNo}</p><p className="text-sm text-[var(--wms-app-text-muted)]">{t(`enum.status.${detail.header.status}`)} · {formatProjectDateTime(detail.header.createdDate)}</p></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={t('list.columns.orders')} value={detail.header.orderCount} />
      <Stat label={t('list.columns.materials')} value={detail.header.materialCount} />
      <Stat label={t('list.columns.planned')} value={formatProjectNumber(detail.header.plannedQuantity)} />
      <Stat label={t('list.columns.completed')} value={formatProjectNumber(detail.header.completedQuantity)} />
    </div>
    <div className="mt-5 space-y-4">{detail.orders.map((order) => <article key={order.id} className="rounded-xl border border-[var(--wms-app-border)] p-4">
      <div className="flex flex-wrap justify-between gap-2"><div><strong className="font-mono">{order.orderNo}</strong><p className="text-sm text-[var(--wms-app-text-muted)]">{order.producedStockCode} · {order.producedStockName}</p></div><span className="text-sm font-bold text-[var(--wms-brand-primary)]">{formatProjectNumber(order.plannedQuantity)} {order.unitCode}</span></div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <DetailList title={t('detail.materials')} rows={order.materials.map((row) => `${row.stockCode} · ${formatProjectNumber(row.requiredQuantity)} ${row.unitCode}`)} />
        <DetailList title={t('detail.outputs')} rows={order.outputs.map((row) => `${row.stockCode} · ${formatProjectNumber(row.plannedQuantity)} ${row.unitCode}`)} />
      </div>
      <p className="mt-3 text-xs text-[var(--wms-app-text-muted)]">{t('detail.assignees')}: {order.assignments.map((x) => x.displayName).join(', ') || '—'} · {t('detail.workCenter')}: {order.workCenterCode || '—'}</p>
    </article>)}</div>
  </ResponsiveDialog>;
}

function ProductionLifecycleDialog({ value, close, completed }: { value: { row: ProductionPlanGridRow; kind: 'release' | 'delete' }; close: () => void; completed: () => void }) {
  const { t } = useModuleTranslation('production');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      if (value.kind === 'delete') await productionApi.deleteDraft(value.row.id);
      else {
        const detail = await productionApi.detail(value.row.id);
        await productionApi.release(value.row.id, detail.rowVersion);
      }
      toast.success(t(`lifecycle.${value.kind}.success`));
      completed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('lifecycle.failed'));
    } finally { setBusy(false); }
  };
  return <ResponsiveDialog onClose={close} title={t(`lifecycle.${value.kind}.title`)} className="!max-w-lg">
    <h2 className="text-xl font-black">{t(`lifecycle.${value.kind}.title`)}</h2>
    <p className="mt-2 text-sm text-[var(--wms-app-text-muted)]">{t(`lifecycle.${value.kind}.text`, { documentNo: value.row.documentNo })}</p>
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="min-h-11 rounded-xl border px-4">{t('common.cancel')}</button><button type="button" disabled={busy} onClick={() => void run()} className={`min-h-11 rounded-xl px-5 font-bold text-white disabled:opacity-50 ${value.kind === 'delete' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{busy ? t('common.processing') : t(`lifecycle.${value.kind}.action`)}</button></div>
  </ResponsiveDialog>;
}

function HubCard({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return <Link to={href} className="group rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]"><div className="flex items-center justify-between text-[var(--wms-brand-primary)]">{icon}<ArrowRight className="size-5 transition group-hover:translate-x-1" /></div><h2 className="mt-4 font-black">{title}</h2><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{text}</p></Link>;
}
function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 flex items-center gap-2 font-black text-[var(--wms-brand-primary)]">{icon}{title}</h2>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm"><span className="font-semibold text-[var(--wms-app-text)]">{label}</span>{children}</label>;
}
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-xl border border-[var(--wms-app-border)] p-3"><p className="text-xs text-[var(--wms-app-text-muted)]">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
function DetailList({ title, rows }: { title: string; rows: string[] }) {
  return <div><h3 className="text-sm font-black">{title}</h3><ul className="mt-2 space-y-1 text-sm text-[var(--wms-app-text-muted)]">{rows.length ? rows.map((row) => <li key={row} className="rounded-lg border border-[var(--wms-app-border)] px-3 py-2">{row}</li>) : <li>—</li>}</ul></div>;
}
