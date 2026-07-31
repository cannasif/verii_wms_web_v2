import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppDateInput } from '@/components/shared/AppInput';
import { OperationFlowTabs } from '@/components/shared/OperationFlowTabs';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { TrackingPlanEditor, type TrackingPlanRow } from '@/components/shared/TrackingPlanEditor';
import {
  StockTrackingPolicyField,
} from '@/features/stock-tracking/effective-stock-tracking';
import type {
  EffectiveStockTrackingPolicy,
  StockTrackingType,
} from '@/features/stock-tracking/effective-stock-tracking.service';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { useAuthStore } from '@/stores/auth-store';
import type {
  ActiveUserOption,
  CustomerOption,
  LocationOption,
  SeriesOption,
  StockOption,
  YapCodeOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { shippingApi } from './shipping-api';
import type {
  ShipmentMode,
  ShipmentOrderHeader,
  ShipmentPolicy,
  ShipmentResult,
} from './types';

type ShipmentLine = {
  key: string;
  stockId?: number;
  stockCode?: string;
  stockName?: string;
  yapCodeId?: number;
  yapCode?: string;
  quantity: number;
  unitCode: string;
  trackingType: StockTrackingType;
  trackingPolicy?: EffectiveStockTrackingPolicy;
  trackingPolicyLoading?: boolean;
  requireHandlingUnit: boolean;
  sourceLocationId?: number;
  sourceLocationValue?: string | null;
  trackings: TrackingPlanRow[];
  source?: {
    orderNumber: string;
    externalLineId: string;
    externalLineNo?: number;
    externalStockCode: string;
    externalYapCode?: string;
    orderDate?: string;
    orderedQuantity: number;
    previouslyShippedQuantity: number;
    availableQuantity: number;
  };
};

const blankLine = (): ShipmentLine => ({
  key: crypto.randomUUID(),
  quantity: 1,
  unitCode: '',
  trackingType: 'None',
  requireHandlingUnit: false,
  trackings: [],
});
const today = () => new Date().toLocaleDateString('en-CA');
const encoded = (value: unknown) => encodeURIComponent(JSON.stringify(value));

export function ShippingCreatePage() {
  const { t } = useModuleTranslation('shipping-v2');
  const { t: tCommon } = useTranslation('common');
  const branch = useAuthStore((x) => x.branch?.code ?? '0');
  const [policy, setPolicy] = useState<ShipmentPolicy | null>(null);
  const [source, setSource] = useState<'Order' | 'Stock'>('Stock');
  const [execution, setExecution] = useState<'Task' | 'Direct'>('Task');
  const [customer, setCustomer] = useState<CustomerOption>();
  const [customerValue, setCustomerValue] = useState<string | null>(null);
  const [orders, setOrders] = useState<ShipmentOrderHeader[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [warehouseValue, setWarehouseValue] = useState<string | null>(null);
  const warehouseId = Number(warehouseValue?.split('|')[0] ?? 0);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [documentDate, setDocumentDate] = useState(today);
  const [plannedAt, setPlannedAt] = useState('');
  const [priority, setPriority] = useState('3');
  const [stagingLocationId, setStagingLocationId] = useState<string | null>(null);
  const [loadingLocationId, setLoadingLocationId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [carrierCode, setCarrierCode] = useState('');
  const [isEDispatch, setIsEDispatch] = useState(false);
  const [externalReference, setExternalReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<ShipmentLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShipmentResult>();
  const orderLineRequest = useRef(0);

  useEffect(() => {
    void shippingApi.policy(branch).then(setPolicy).catch((error: Error) => toast.error(error.message));
  }, [branch]);

  useEffect(() => {
    setSeries([]);
    setSeriesId(null);
    setStagingLocationId(null);
    setLoadingLocationId(null);
    setLines((current) => current.map((line) => ({
      ...line,
      sourceLocationId: undefined,
      sourceLocationValue: null,
    })));
    if (!warehouseId) return;
    void shippingApi.series()
      .then((items) => {
        setSeries(items);
        const preferred = items.find((x) => x.isDefault) ?? items[0];
        setSeriesId(preferred ? String(preferred.id) : null);
      })
      .catch((error: Error) => toast.error(error.message));
  }, [warehouseId]);

  const totalQuantity = useMemo(
    () => lines.reduce((total, line) => total + Number(line.quantity || 0), 0),
    [lines],
  );
  const mode = (): ShipmentMode => source === 'Order'
    ? (execution === 'Task' ? 'OrderBasedTask' : 'OrderBasedDirect')
    : (execution === 'Task' ? 'StockBasedTask' : 'StockBasedDirect');
  const patchLine = (key: string, patch: Partial<ShipmentLine>) =>
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));

  const changeSource = (value: 'Order' | 'Stock') => {
    setSource(value);
    setLines(value === 'Stock' ? [blankLine()] : []);
    setOrders([]);
    setSelectedOrders([]);
  };

  const loadOrders = async () => {
    if (!customer) return;
    setBusy(true);
    try {
      setOrders(await shippingApi.orderHeaders(customer.customerCode, branch));
      setSelectedOrders([]);
      setLines([]);
    } catch (error) {
      toast.error(message(error, t('create.errors.orderLoadFailed')));
    } finally {
      setBusy(false);
    }
  };

  const loadOrderLines = async (orderNumbers: string[]) => {
    const requestId = ++orderLineRequest.current;
    if (!orderNumbers.length) {
      setLines([]);
      return;
    }
    setBusy(true);
    try {
      const rows = await shippingApi.orderLines(orderNumbers, branch);
      const stockRequests = new Map<string, Promise<StockOption>>();
      const policyRequests = new Map<number, Promise<EffectiveStockTrackingPolicy>>();
      const mapped = await Promise.all(rows.map(async (row): Promise<ShipmentLine> => {
        if (!row.stockCode)
          throw new Error(t('create.errors.stockNotFound', { order: `${row.orderNumber}/${row.orderId}` }));

        const stockCode = row.stockCode.toUpperCase();
        if (!stockRequests.has(stockCode)) {
          stockRequests.set(stockCode, (async () => {
            const stockPage = await shippingApi.stocks({
              pageNumber: 1,
              pageSize: 20,
              search: row.stockCode,
              sortBy: 'erpStockCode',
              sortDirection: 'asc',
              signal: new AbortController().signal,
            }, branch);
            const stock = stockPage.items.find(
              (x) => x.erpStockCode.toUpperCase() === stockCode,
            );
            if (!stock) throw new Error(t('create.errors.stockMirrorNotFound', { stockCode: row.stockCode }));
            return stock;
          })());
        }
        const stock = await stockRequests.get(stockCode)!;
        if (!policyRequests.has(stock.id))
          policyRequests.set(stock.id, shippingApi.trackingPolicy(branch, stock.id));
        const trackingPolicy = await policyRequests.get(stock.id)!;

        let yap: YapCodeOption | undefined;
        if (row.yapCode) {
          const yapPage = await shippingApi.yaps({
            pageNumber: 1,
            pageSize: 20,
            search: row.yapCode,
            sortBy: 'configurationCode',
            sortDirection: 'asc',
            signal: new AbortController().signal,
          }, branch);
          yap = yapPage.items.find(
            (x) => x.configurationCode.toUpperCase() === row.yapCode!.toUpperCase(),
          );
          if (!yap)
            throw new Error(t('create.errors.yapNotFound', { yapCode: row.yapCode }));
        }

        return {
          key: crypto.randomUUID(),
          stockId: stock.id,
          stockCode: stock.erpStockCode,
          stockName: stock.stockName,
          yapCodeId: yap?.id,
          yapCode: yap?.configurationCode,
          quantity: row.availableQuantity ?? 0,
          unitCode: stock.unitCode || '',
          trackingType: trackingPolicy.trackingType,
          trackingPolicy,
          requireHandlingUnit: false,
          trackings: [],
          source: {
            orderNumber: row.orderNumber,
            externalLineId: String(row.orderId),
            externalLineNo: row.orderId,
            externalStockCode: row.stockCode,
            externalYapCode: row.yapCode,
            orderDate: row.orderDate?.slice(0, 10),
            orderedQuantity: row.orderedQuantity ?? 0,
            previouslyShippedQuantity: row.deliveredQuantity ?? 0,
            availableQuantity: row.availableQuantity ?? 0,
          },
        };
      }));
      if (requestId === orderLineRequest.current) setLines(mapped);
    } catch (error) {
      toast.error(message(error, t('create.errors.orderLinesFailed')));
    } finally {
      if (requestId === orderLineRequest.current) setBusy(false);
    }
  };

  const toggleOrder = (orderNumber: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...selectedOrders, orderNumber])]
      : selectedOrders.filter((value) => value !== orderNumber);
    setSelectedOrders(next);
    void loadOrderLines(next);
  };

  const validate = (): string | null => {
    if (!policy) return t('create.errors.policyLoadFailed');
    if (!customer || !warehouseId || !seriesId)
      return t('create.errors.requiredHeader');
    if (!lines.length) return t('create.errors.requiredLines');
    const selectedMode = mode();
    const allowed = selectedMode === 'OrderBasedTask'
      ? policy.allowOrderBasedTask
      : selectedMode === 'OrderBasedDirect'
        ? policy.allowOrderBasedDirect
        : selectedMode === 'StockBasedTask'
          ? policy.allowStockBasedTask
          : policy.allowStockBasedDirect;
    if (!allowed) return t('create.errors.flowNotAllowed');
    if (execution === 'Task' && policy.requireAssigneeForTask && !assignees.length)
      return t('create.errors.assigneeRequired');
    if (!policy.allowMultipleAssignees && assignees.length > 1)
      return t('create.errors.singleAssigneeOnly');
    if (policy.requireShipmentInformation && !vehiclePlate.trim() && !carrierCode.trim())
      return t('create.errors.shipmentInfoRequired');

    for (const [index, line] of lines.entries()) {
      const lineNo = index + 1;
      if (!line.stockId || line.quantity <= 0 || !line.unitCode.trim())
        return t('create.errors.lineRequiredFields', { line: lineNo });
      if (!line.trackingPolicy)
        return t('create.errors.lineTrackingPolicyMissing', { line: lineNo });
      if (source === 'Order' && !line.source)
        return t('create.errors.lineOrderLinkMissing', { line: lineNo });
      if (line.source && line.quantity > line.source.availableQuantity)
        return t('create.errors.lineExceedsOrder', { line: lineNo });
      if (policy.requireSourceLocation && !line.sourceLocationId)
        return t('create.errors.lineSourceLocationRequired', { line: lineNo });
      if (line.trackingType !== 'None') {
        if (!line.trackings.length) return t('create.errors.lineTrackingPlanRequired', { line: lineNo });
        const tracked = line.trackings.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (Math.abs(tracked - line.quantity) > 0.000001) return t('create.errors.lineTrackingSumMismatch', { line: lineNo });
        if ((line.trackingType === 'Serial' || line.trackingType === 'LotAndSerial') && line.trackings.some((item) => !item.serialNo?.trim() || item.quantity !== 1))
          return t('create.errors.lineSerialInvalid', { line: lineNo });
        if ((line.trackingType === 'Lot' || line.trackingType === 'LotAndSerial') && line.trackings.some((item) => !item.lotNo?.trim()))
          return t('create.errors.lineLotRequired', { line: lineNo });
        if (line.requireHandlingUnit && line.trackings.some((item) => !item.handlingUnitNo?.trim()))
          return t('create.errors.lineHandlingUnitRequired', { line: lineNo });
        const serials = line.trackings.map((item) => item.serialNo?.trim().toLocaleUpperCase('tr-TR')).filter(Boolean);
        if (new Set(serials).size !== serials.length) return t('create.errors.lineDuplicateSerial', { line: lineNo });
      }
    }
    return null;
  };

  const create = async () => {
    const validation = validate();
    if (validation) {
      toast.error(validation);
      return;
    }

    setBusy(true);
    try {
      const created = await shippingApi.create({
        idempotencyKey: crypto.randomUUID(),
        branchCode: branch,
        documentSeriesId: Number(seriesId),
        documentDate,
        initiationMode: mode(),
        customerId: customer!.id,
        sourceWarehouseId: warehouseId,
        stagingLocationId: stagingLocationId ? Number(stagingLocationId) : null,
        loadingLocationId: loadingLocationId ? Number(loadingLocationId) : null,
        plannedShipmentAtUtc: plannedAt ? new Date(plannedAt).toISOString() : null,
        priority: Number(priority),
        externalReferenceNo: externalReference.trim() || null,
        isEDispatch,
        carrierCode: carrierCode.trim() || null,
        carrierName: null,
        vehiclePlate: vehiclePlate.trim() || null,
        trailerPlate: null,
        driverName: null,
        sealNo: null,
        description: description.trim() || null,
        assignedUserIds: execution === 'Task' ? assignees.map((x) => x.id) : [],
        lines: lines.map((line) => ({
          stockId: line.stockId,
          yapCodeId: line.yapCodeId ?? null,
          quantity: line.quantity,
          unitCode: line.unitCode.trim(),
          trackingType: line.trackingType,
          requireHandlingUnit: line.requireHandlingUnit,
          sourceLocationId: line.sourceLocationId ?? null,
          description: null,
          trackings: line.trackings.map((item) => ({
            quantity: item.quantity,
            handlingUnitNo: item.handlingUnitNo?.trim() || null,
            containerNo: null,
            lotNo: item.lotNo?.trim() || null,
            serialNo: item.serialNo?.trim() || null,
            manufacturingDate: item.manufacturingDate || null,
            expirationDate: item.expirationDate || null,
            sourceLocationId: line.sourceLocationId ?? null,
          })),
          source: line.source ?? null,
        })),
      });
      setResult(created);
      toast.success(t('create.success', { documentNo: created.documentNo }));
    } catch (error) {
      toast.error(message(error, t('create.errors.createFailed')));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-black">{t('create.resultTitle')}</h1>
        <p className="font-mono text-xl">{result.documentNo}</p>
        {result.taskNo && <p>{t('create.resultTask', { taskNo: result.taskNo })}</p>}
        <Link to="/warehouse/shipments/list" className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-white">
          {t('create.resultLink')}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-500">{t('create.eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-black">{t('create.title')}</h1>
        <p className="text-sm text-slate-500">
          {t('create.description')}
        </p>
      </header>

      <OperationFlowTabs source={source === 'Order' ? 'order' : 'stock'} execution={execution === 'Task' ? 'task' : 'direct'}
        onSourceChange={(value) => changeSource(value === 'order' ? 'Order' : 'Stock')}
        onExecutionChange={(value) => { setExecution(value === 'task' ? 'Task' : 'Direct'); if (value === 'direct') setAssignees([]); }}
        orderLabel={tCommon('transferDraft.sourceLabels.salesOrder')} stockLabel={tCommon('transferDraft.sourceLabels.warehouseStock')}
        isAllowed={(sourceMode, executionMode) => {
          if (!policy) return false;
          return sourceMode === 'order'
            ? (executionMode === 'task' ? policy.allowOrderBasedTask : policy.allowOrderBasedDirect)
            : (executionMode === 'task' ? policy.allowStockBasedTask : policy.allowStockBasedDirect);
        }}>
        {execution === 'Task' ? tCommon('transferDraft.operationFlow.shipmentTaskDescription') : tCommon('transferDraft.operationFlow.shipmentDirectDescription')}
      </OperationFlowTabs>

      <Panel title={t('create.sections.customerDocument')}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label={t('create.fields.customer')}>
            <PagedAppDropdown queryKey={['sh-customer', branch]} fetchPage={(request) => shippingApi.customers(request, branch)}
              toOption={(item) => ({ value: encoded(item), label: `${item.customerCode} · ${item.customerName}` })}
              value={customerValue} onValueChange={(value) => {
                setCustomerValue(value);
                setCustomer(JSON.parse(decodeURIComponent(value)) as CustomerOption);
                setOrders([]);
                setSelectedOrders([]);
                if (source === 'Order') setLines([]);
              }} searchable minSearchLength={2} />
          </Field>
          <Field label={t('create.fields.sourceWarehouse')}>
            <PagedAppDropdown queryKey={['sh-warehouse', branch]} fetchPage={(request) => shippingApi.warehouses(request, branch)}
              toOption={(item) => ({ value: `${item.id}|${item.warehouseCode}`, label: `${item.warehouseCode} · ${item.warehouseName}` })}
              value={warehouseValue} onValueChange={setWarehouseValue} searchable />
          </Field>
          <Field label={t('create.fields.series')}>
            <AppDropdown value={seriesId} onValueChange={setSeriesId}
              options={series.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.previewDocumentNumber}` }))} />
          </Field>
          <Field label={t('create.fields.documentDate')}><AppDateInput value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></Field>
          <Field label={t('create.fields.plannedShipment')}><AppDateInput type="datetime-local" value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} /></Field>
          <Field label={t('create.fields.stagingLocation')}>
            <PagedAppDropdown queryKey={['sh-stage', warehouseId]} fetchPage={(request) => shippingApi.locations(request, warehouseId)}
              toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })}
              enabled={Boolean(warehouseId)} value={stagingLocationId} onValueChange={setStagingLocationId} searchable />
          </Field>
          <Field label={t('create.fields.loadingLocation')}>
            <PagedAppDropdown queryKey={['sh-load', warehouseId]} fetchPage={(request) => shippingApi.locations(request, warehouseId)}
              toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })}
              enabled={Boolean(warehouseId)} value={loadingLocationId} onValueChange={setLoadingLocationId} searchable />
          </Field>
          <Field label={t('create.fields.priority')}>
            <AppDropdown value={priority} onValueChange={setPriority}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ value: String(x), label: String(x) }))} />
          </Field>
          <Field label={t('create.fields.vehiclePlate')}><input className="input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} /></Field>
          <Field label={t('create.fields.carrierCode')}><input className="input" value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)} /></Field>
          <Field label={t('create.fields.externalReference')}><input className="input" value={externalReference} onChange={(e) => setExternalReference(e.target.value)} /></Field>
          <Field label={t('create.fields.description')}><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isEDispatch} onChange={(e) => setIsEDispatch(e.target.checked)} />{t('create.fields.eDispatch')}</label>
        </div>
      </Panel>

      {source === 'Order' && (
        <Panel title={t('create.sections.orderSelection')}>
          <button disabled={!customer || busy} onClick={() => void loadOrders()} className="rounded-xl bg-cyan-600 px-4 py-2 text-white disabled:opacity-50">
            {t('create.loadOrders')}
          </button>
          <div className="mt-3 space-y-2">
            {orders.map((order) => (
              <label key={order.orderNumber} className="flex justify-between rounded-xl border p-3">
                <span>
                  <input type="checkbox" checked={selectedOrders.includes(order.orderNumber)}
                    onChange={(e) => toggleOrder(order.orderNumber, e.target.checked)} />{' '}
                  <b className="font-mono">{order.orderNumber}</b> · {order.projectCode}
                </span>
                <span>{order.availableQuantity}</span>
              </label>
            ))}
          </div>
          {selectedOrders.length > 0 && (
            <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm">
              <b>{t('create.ordersSummary', { count: selectedOrders.length, lineCount: lines.length })}</b>
              <p className="mt-1 text-xs text-slate-500">
                {t('create.ordersHint')}
              </p>
            </div>
          )}
        </Panel>
      )}

      {execution === 'Task' && (
        <Panel title={t('create.sections.assignees')}>
          <PagedAppDropdown queryKey={['sh-users']} fetchPage={shippingApi.users}
            toOption={(item) => ({
              value: encoded(item),
              label: `${item.firstName} ${item.lastName}`.trim() || item.username,
              disabled: assignees.some((x) => x.id === item.id),
            })}
            value={null} onValueChange={(value) => {
              const user = JSON.parse(decodeURIComponent(value)) as ActiveUserOption;
              setAssignees((current) => current.some((x) => x.id === user.id) ? current : [...current, user]);
            }} searchable minSearchLength={2} />
          <div className="mt-2 flex flex-wrap gap-2">
            {assignees.map((user) => (
              <button key={user.id} onClick={() => setAssignees((current) => current.filter((x) => x.id !== user.id))}
                className="rounded-full bg-cyan-500/10 px-3 py-1">
                {user.username} ×
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={t('create.linesTitle', { count: lines.length, quantity: totalQuantity })}>
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <strong>#{index + 1} {line.source && <span className="font-mono text-cyan-500">{line.source.orderNumber}</span>}</strong>
                  <p className="mt-1 text-sm font-semibold">{line.stockCode ?? t('create.lineStockUnselected')} · {line.stockName ?? '—'}</p>
                  {line.source && <p className="text-xs text-slate-500">{t('create.lineOrderShortfall', { quantity: line.source.availableQuantity, unit: line.unitCode })}</p>}
                </div>
                <button type="button" onClick={() => setLines((current) => current.filter((x) => x.key !== line.key))} className="text-red-500">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label={t('create.fields.stock')}>
                  <PagedAppDropdown queryKey={['sh-stock', line.key, branch]} fetchPage={(request) => shippingApi.stocks(request, branch)}
                    toOption={(item) => ({ value: encoded(item), label: `${item.erpStockCode} · ${item.stockName}` })}
                    selectedOption={line.stockId ? { value: String(line.stockId), label: `${line.stockCode} · ${line.stockName}` } : undefined}
                    value={line.stockId ? String(line.stockId) : null} onValueChange={(value) => {
                      void (async () => {
                        const stock = JSON.parse(decodeURIComponent(value)) as StockOption;
                        patchLine(line.key, {
                          stockId: stock.id,
                          stockCode: stock.erpStockCode,
                          stockName: stock.stockName,
                          unitCode: stock.unitCode || '',
                          trackingPolicy: undefined,
                          trackingPolicyLoading: true,
                          trackingType: 'None',
                          trackings: [],
                        });
                        try {
                          const trackingPolicy = await shippingApi.trackingPolicy(branch, stock.id);
                          patchLine(line.key, {
                            trackingPolicy,
                            trackingPolicyLoading: false,
                            trackingType: trackingPolicy.trackingType,
                          });
                        } catch (error) {
                          patchLine(line.key, { trackingPolicyLoading: false });
                          toast.error(message(error, t('create.errors.trackingPolicyFailed')));
                        }
                      })();
                    }} searchable minSearchLength={2} />
                </Field>
                <Field label={t('create.fields.configurationCode')}>
                  <PagedAppDropdown queryKey={['sh-yap', line.key, branch]} fetchPage={(request) => shippingApi.yaps(request, branch)}
                    toOption={(item) => ({ value: encoded(item), label: `${item.configurationCode} · ${item.description ?? ''}` })}
                    selectedOption={line.yapCodeId ? { value: String(line.yapCodeId), label: line.yapCode ?? '' } : undefined}
                    value={line.yapCodeId ? String(line.yapCodeId) : null} onValueChange={(value) => {
                      const yap = JSON.parse(decodeURIComponent(value)) as YapCodeOption;
                      patchLine(line.key, { yapCodeId: yap.id, yapCode: yap.configurationCode });
                    }} searchable />
                </Field>
                <Field label={t('create.fields.quantity')}>
                  <input className="input" type="number" min="0.000001" step="0.000001"
                    max={line.source?.availableQuantity} value={line.quantity}
                    onChange={(e) => patchLine(line.key, { quantity: Number(e.target.value) })} />
                </Field>
                <Field label={t('create.fields.unit')}><div className={`input flex items-center font-bold ${line.unitCode ? 'text-cyan-600' : 'text-amber-600'}`}>{line.unitCode || t('create.fields.unitPlaceholder')}</div></Field>
                <Field label={t('create.fields.sourceLocation')}>
                  <PagedAppDropdown queryKey={['sh-location', line.key, warehouseId]} fetchPage={(request) => shippingApi.locations(request, warehouseId)}
                    toOption={(item: LocationOption) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })}
                    enabled={Boolean(warehouseId)} value={line.sourceLocationValue ?? null}
                    onValueChange={(value) => patchLine(line.key, { sourceLocationId: Number(value), sourceLocationValue: value })} searchable />
                </Field>
                <Field label={t('create.fields.trackingPolicy')}>
                  <StockTrackingPolicyField policy={line.trackingPolicy} loading={line.trackingPolicyLoading} />
                </Field>
                <label className="flex h-11 items-center gap-2 self-end rounded-xl border px-3 text-sm">
                  <input type="checkbox" checked={line.requireHandlingUnit}
                    onChange={(e) => patchLine(line.key, { requireHandlingUnit: e.target.checked })} />
                  {t('create.fields.requireHandlingUnit')}
                </label>
              </div>
              <TrackingPlanEditor mode={line.trackingType} quantity={line.quantity} value={line.trackings}
                onChange={(trackings) => patchLine(line.key, { trackings })} requireHandlingUnit={line.requireHandlingUnit}
                showDates={Boolean(line.trackingPolicy?.requireManufacturingDate || line.trackingPolicy?.requireExpirationDate)} />
            </div>
          ))}
        </div>
        {source === 'Stock' && (
          <button onClick={() => setLines((current) => [...current, blankLine()])} className="mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2">
            <Plus className="size-4" />{t('create.addLine')}
          </button>
        )}
      </Panel>

      <div className="flex justify-end">
        <button disabled={busy} onClick={() => void create()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}{t('create.submit')}
        </button>
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5"><h2 className="mb-4 text-lg font-black text-cyan-500">{title}</h2>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-semibold">{label}</span>{children}</label>;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
