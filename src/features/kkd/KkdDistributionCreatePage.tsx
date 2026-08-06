import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  MapPin,
  PackageCheck,
  Printer,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
  Warehouse,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDropdownOption } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsQrCaptureField } from '@/components/shared/OpsQrCaptureField';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { useTheme } from '@/components/theme-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  ActiveUserOption,
  LocationOption,
  WarehouseOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { warehouseOutboundApi } from '@/features/warehouse-outbound/warehouseOutbound-api';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import { cn } from '@/lib/utils';
import type { PagedResponse } from '@/types/api';
import { KkdEmployeeLookupField } from './KkdEmployeeLookupField';
import {
  KKD_CELL,
  KKD_HEAD_CELL,
  KkdCallout,
  KkdField,
  KkdFlowSteps,
  KkdMetric,
  KkdPage,
  KkdPanel,
  KkdRowCheckbox,
  KkdSelectableCard,
  KkdTableShell,
  KkdTextarea,
} from './kkd-ops-ui';
import { kkdApi, type KkdDistributionCreateResult, type KkdOpenOrderLine, type KkdStockLookup } from './kkd-api';
import { KkdDistributionReceiptDialog } from './KkdDistributionReceiptDialog';
import {
  formatExcessApprovalStatus,
  isExcessApprovalPending,
  KKD_QUOTA_FREQUENCY_HINT,
  KKD_QUOTA_FULL_MESSAGE,
  KKD_QUOTA_FULL_TITLE,
} from './kkd-quota-copy';

const MATERIAL_REQUESTS_PATH = '/warehouse/production-transfers/material-requests';

function buildMaterialRequestsReturnHref(employeeId: string, orderNumbers: string[]): string {
  const params = new URLSearchParams();
  if (employeeId) params.set('employeeId', employeeId);
  if (orderNumbers.length > 0) params.set('orders', [...orderNumbers].sort().join(','));
  const query = params.toString();
  return query ? `${MATERIAL_REQUESTS_PATH}?${query}` : MATERIAL_REQUESTS_PATH;
}

const today = (): string => new Date().toLocaleDateString('en-CA');
const lineKey = (line: KkdOpenOrderLine): string => `${line.orderNumber}|${line.orderLineId}`;
const locationLabel = (item: LocationOption): string => `${item.code} · ${item.name}`;
const stockOptionLabel = (item: KkdStockLookup): string => `${item.code} · ${item.name}`;
const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});
type LineEdit = {
  selected: boolean;
  quantity: number;
  sourceLocationId?: number;
  sourceLocationValue?: string | null;
  sourceLocationLabel?: string;
  issuedStockId?: number;
  issuedStockLabel?: string;
  lotNo: string;
  serials: string;
};
const encodeUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string | null): ActiveUserOption | null =>
  value ? (JSON.parse(decodeURIComponent(value)) as ActiveUserOption) : null;

export function KkdDistributionCreatePage(): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const [searchParams] = useSearchParams();
  const [initialSelection] = useState(() => ({
    employeeId: searchParams.get('employeeId')?.trim() || '',
    orders: [
      ...new Set(
        (searchParams.get('orders') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ],
    taskMode: searchParams.get('taskMode') === '1',
  }));
  /** Malzeme talep listesinden “Dağıtıma hazırla” ile gelindi — ön seçim kilitli devam. */
  const isHandoff =
    initialSelection.taskMode &&
    Boolean(initialSelection.employeeId) &&
    initialSelection.orders.length > 0;
  const returnToSelectionHref = useMemo(
    () => buildMaterialRequestsReturnHref(initialSelection.employeeId, initialSelection.orders),
    [initialSelection.employeeId, initialSelection.orders],
  );
  const flowSteps = useMemo(
    () => [
      { id: 'select', label: 'Sipariş seçimi', href: returnToSelectionHref },
      { id: 'distribute', label: 'Dağıtım görevi' },
    ],
    [returnToSelectionHref],
  );
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const series = useQuery({ queryKey: ['kkd', 'distribution-series'], queryFn: kkdApi.distributionSeries });
  const [employeeId, setEmployeeId] = useState(initialSelection.employeeId);
  const [employeeQr, setEmployeeQr] = useState('');
  const employeeNumber = Number(employeeId || 0);
  const context = useQuery({
    queryKey: ['kkd', 'distribution-context', employeeNumber],
    queryFn: () => kkdApi.distributionContext(employeeNumber),
    enabled: employeeNumber > 0,
  });
  const [orders, setOrders] = useState<string[]>(initialSelection.orders);
  const sortedOrders = useMemo(() => [...orders].sort(), [orders]);
  const handedOffOrders = useMemo(() => {
    if (!context.data) return [];
    const selected = new Set(orders);
    return context.data.orders.filter((order) => selected.has(order.orderNumber));
  }, [context.data, orders]);
  const orderLines = useQuery({
    queryKey: ['kkd', 'distribution-lines', employeeNumber, sortedOrders.join('|')],
    queryFn: () => kkdApi.distributionOrderLines(employeeNumber, sortedOrders),
    enabled: employeeNumber > 0 && sortedOrders.length > 0,
  });
  const [warehouseValue, setWarehouseValue] = useState<string | null>(null);
  const warehouseId = Number(warehouseValue?.split('|')[0] || 0);
  const [seriesId, setSeriesId] = useState('');
  const [documentDate, setDocumentDate] = useState(today());
  const remainingEntitlements = useQuery({
    queryKey: ['kkd', 'remaining-entitlements', employeeNumber, documentDate],
    queryFn: () => kkdApi.remainingEntitlements(employeeNumber, documentDate),
    enabled: employeeNumber > 0,
  });
  const [description, setDescription] = useState('');
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});
  const [locationLookupKey, setLocationLookupKey] = useState<string | null>(null);
  const [stockLookupKey, setStockLookupKey] = useState<string | null>(null);
  const [result, setResult] = useState<KkdDistributionCreateResult>();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const receiptDetail = useQuery({
    queryKey: ['kkd', 'distributions', 'detail', result?.id],
    queryFn: () => kkdApi.distributionDetail(result!.id),
    enabled: Boolean(result?.id) && receiptOpen,
  });
  const resolveEmployee = useMutation({
    mutationFn: (qrCode: string) => kkdApi.resolveEmployeeQr(qrCode.trim()),
    onSuccess: (employee) => {
      setEmployeeId(String(employee.id));
      setEmployeeQr('');
      toast.success(`${employee.employeeCode} · ${employee.fullName} seçildi.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Personel QR kodu çözümlenemedi.'),
  });

  const resolveFromQr = (qrCode: string): void => {
    const next = qrCode.trim();
    if (!next || resolveEmployee.isPending) return;
    setEmployeeQr(next);
    resolveEmployee.mutate(next);
  };

  useEffect(() => {
    setOrders(employeeId === initialSelection.employeeId ? initialSelection.orders : []);
    setEdits({});
    setWarehouseValue(null);
    setAssignees([]);
    setResult(undefined);
  }, [employeeId, initialSelection]);

  useEffect(() => {
    const preferred = series.data?.find((x) => x.isDefault) ?? series.data?.[0];
    if (preferred && !seriesId) setSeriesId(String(preferred.id));
  }, [series.data, seriesId]);

  const patch = (line: KkdOpenOrderLine, value: Partial<LineEdit>): void =>
    setEdits((current) => {
      const key = lineKey(line);
      const existing =
        current[key] ?? { selected: false, quantity: Math.min(1, line.remainingQuantity), lotNo: '', serials: '' };
      return { ...current, [key]: { ...existing, ...value } };
    });
  const selected = (orderLines.data ?? []).filter((x) => edits[lineKey(x)]?.selected);
  const quotaWarnings = useMemo(() => {
    const items = remainingEntitlements.data ?? [];
    if (items.length === 0 || selected.length === 0) return [];
    const preferredByStock = new Map(
      (context.data?.preferredStocks ?? []).map((item) => [item.stockId, item.groupCode] as const),
    );
    return selected.flatMap((line) => {
      const edit = edits[lineKey(line)];
      if (!edit || !line.stockId) return [];
      const byStock = items.find((item) => item.stockId === line.stockId);
      const groupCode = preferredByStock.get(line.stockId);
      const byGroup =
        !byStock && groupCode
          ? items.find((item) => item.groupCode === groupCode && (!item.stockId || item.stockId === line.stockId))
          : undefined;
      const match = byStock ?? byGroup;
      if (!match) return [];
      const remaining = match.totalRemainingQuantity;
      const exceeds = edit.quantity > remaining;
      const frequencyBlocked =
        remaining <= 0 &&
        Boolean(match.nextEligibleDate) &&
        new Date(match.nextEligibleDate!).toLocaleDateString('en-CA') > documentDate;
      if (!exceeds && !frequencyBlocked) return [];
      return [
        {
          key: lineKey(line),
          stockCode: line.stockCode,
          stockName: line.stockName,
          quantity: edit.quantity,
          remaining,
          nextEligibleDate: match.nextEligibleDate,
          frequencyBlocked,
        },
      ];
    });
  }, [context.data?.preferredStocks, documentDate, edits, remainingEntitlements.data, selected]);
  const hasQuotaWarning = quotaWarnings.length > 0;
  const selectableLines = useMemo(
    () => (orderLines.data ?? []).filter((line) => line.isMapped),
    [orderLines.data],
  );
  const allSelectableSelected =
    selectableLines.length > 0 && selectableLines.every((line) => edits[lineKey(line)]?.selected);
  const someSelectableSelected =
    selectableLines.some((line) => edits[lineKey(line)]?.selected) && !allSelectableSelected;

  const toggleAllSelectableLines = (checked: boolean): void => {
    setEdits((current) => {
      const next = { ...current };
      for (const line of selectableLines) {
        const key = lineKey(line);
        const existing =
          next[key] ?? { selected: false, quantity: Math.min(1, line.remainingQuantity), lotNo: '', serials: '' };
        next[key] = { ...existing, selected: checked };
      }
      return next;
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!employeeNumber || !warehouseId || !seriesId || selected.length === 0) {
        throw new Error('Personel, kaynak depo, belge serisi ve en az bir sipariş kalemi zorunludur.');
      }
      const lines = selected.map((line) => {
        const edit = edits[lineKey(line)];
        if (!line.isMapped || !line.stockId) {
          throw new Error(line.mappingMessage || `${line.stockCode} WMS stoğuyla eşleşmiyor.`);
        }
        if (!edit.sourceLocationId) throw new Error(`${line.stockCode} için kaynak raf seçilmelidir.`);
        if (edit.quantity <= 0 || edit.quantity > line.remainingQuantity) {
          throw new Error(`${line.stockCode} miktarı 0 ile ${line.remainingQuantity} arasında olmalıdır.`);
        }
        const serials = edit.serials
          .split(/[\n,;]+/)
          .map((x) => x.trim())
          .filter(Boolean);
        const trackings = serials.length
          ? serials.map((serialNo) => ({
              quantity: 1,
              lotNo: edit.lotNo.trim() || null,
              serialNo,
              handlingUnitNo: null,
              manufacturingDate: null,
              expirationDate: null,
              sourceLocationId: edit.sourceLocationId!,
            }))
          : edit.lotNo.trim()
            ? [
                {
                  quantity: edit.quantity,
                  lotNo: edit.lotNo.trim(),
                  serialNo: null,
                  handlingUnitNo: null,
                  manufacturingDate: null,
                  expirationDate: null,
                  sourceLocationId: edit.sourceLocationId,
                },
              ]
            : null;
        if (serials.length && serials.length !== edit.quantity) {
          throw new Error(`${line.stockCode} için seri sayısı teslim miktarıyla aynı olmalıdır.`);
        }
        const issuedStockId = edit.issuedStockId ?? line.stockId!;
        const substituted = Boolean(edit.issuedStockId && edit.issuedStockId !== line.stockId);
        return {
          stockId: issuedStockId,
          yapCodeId: null,
          quantity: edit.quantity,
          unitCode: line.unitCode || null,
          sourceLocationId: edit.sourceLocationId,
          orderNumber: line.orderNumber,
          orderLineId: line.orderLineId,
          requireHandlingUnit: false,
          description: substituted
            ? `Stok değişimi: bu stoktan istendi (${line.stockCode} · ${line.stockName}), bu stoktan çıkış yapıldı (${edit.issuedStockLabel}).`
            : null,
          trackings,
        };
      });
      return kkdApi.createDistribution({
        idempotencyKey: crypto.randomUUID(),
        employeeId: employeeNumber,
        warehouseId,
        documentSeriesId: Number(seriesId),
        documentDate,
        stagingLocationId: null,
        loadingLocationId: null,
        description: description.trim() || null,
        lines,
        createWarehouseTask: initialSelection.taskMode,
        assignedUserIds: initialSelection.taskMode ? assignees.map((x) => x.id) : null,
      });
    },
    onSuccess: (value) => {
      setResult(value);
      if (isExcessApprovalPending(value.excessApprovalStatus) || value.excessQuantity > 0) {
        toast.warning(`${value.documentNo}: ${KKD_QUOTA_FULL_TITLE}. Müdür onayı bekleniyor.`);
      } else {
        toast.success(`${value.documentNo} oluşturuldu; ambar çıkış operasyonuna hazır.`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'KKD dağıtımı oluşturulamadı.'),
  });

  const seriesOptions: AppDropdownOption[] = (series.data ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} · ${item.name}`,
    description: item.isDefault ? 'Varsayılan seri' : item.previewDocumentNumber,
  }));
  const lineColumns = ['Sipariş / sıra', 'Stok', 'Proje', 'Açık miktar', 'Eşleme'];

  return (
    <KkdPage
      title={initialSelection.taskMode ? 'Malzeme Talebi Görevi' : 'Yeni KKD Dağıtımı'}
      description={
        isHandoff
          ? 'Önceki adımda seçilen personel ve siparişler hazır. Kalemleri işaretleyip depo çıkışını oluşturun.'
          : initialSelection.taskMode
            ? 'Windbox siparişini depo çalışanına görev olarak atayın; fiziksel çıkış tamamlandığında hak ve ERP kaydı birlikte sonuçlansın.'
            : 'Personelin açık Netsis siparişinden hakkını ayırın; fiziksel çıkış tamamlandığında hak tüketimi ve ERP ambar çıkışı otomatik sonuçlansın.'
      }
    >
      {isHandoff ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <KkdFlowSteps steps={flowSteps} currentId="distribute" className="min-w-0 flex-1" />
          <OpsActionButton variant="secondary" className="w-full shrink-0 sm:w-auto" asChild>
            <Link to={returnToSelectionHref}>
              <ArrowLeft className="size-3.5 shrink-0" />
              Sipariş seçimine dön
            </Link>
          </OpsActionButton>
        </div>
      ) : null}

      {result ? (
        isExcessApprovalPending(result.excessApprovalStatus) || result.excessQuantity > 0 ? (
          <KkdCallout
            tone="warn"
            icon={<ShieldAlert className="size-5" strokeWidth={1.75} />}
            title={KKD_QUOTA_FULL_TITLE}
            actions={
              <div className="flex flex-wrap gap-2">
                <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setReceiptOpen(true)}>
                  <Printer className="size-3.5 shrink-0" />
                  Teslim belgesi
                </OpsActionButton>
                <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
                  <Link to="/warehouse/kkd/distributions">
                    <ShieldCheck className="size-3.5 shrink-0" />
                    Müdür onayına git
                  </Link>
                </OpsActionButton>
                <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" asChild>
                  <Link to={`/warehouse/warehouse-outbounds/${result.warehouseOutboundId}/operations`}>
                    <PackageCheck className="size-3.5 shrink-0" />
                    Ambar çıkış operasyonunu aç
                  </Link>
                </OpsActionButton>
              </div>
            }
          >
            <p>
              <strong>{result.documentNo}</strong> oluşturuldu. {KKD_QUOTA_FULL_MESSAGE}
            </p>
            <p className="mt-1.5 text-[0.78rem]">
              {result.totalQuantity} toplam · {result.entitledQuantity} hak · {result.excessQuantity} kota aşımı ·{' '}
              {formatExcessApprovalStatus(result.excessApprovalStatus)}
            </p>
          </KkdCallout>
        ) : (
          <KkdCallout
            tone="success"
            icon={<CheckCircle2 className="size-5" strokeWidth={1.75} />}
            title={`${result.documentNo} hazır`}
            actions={
              <div className="flex flex-wrap gap-2">
                <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setReceiptOpen(true)}>
                  <Printer className="size-3.5 shrink-0" />
                  Teslim belgesi
                </OpsActionButton>
                <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" asChild>
                  <Link to={`/warehouse/warehouse-outbounds/${result.warehouseOutboundId}/operations`}>
                    <PackageCheck className="size-3.5 shrink-0" />
                    Ambar çıkış operasyonunu aç
                  </Link>
                </OpsActionButton>
              </div>
            }
          >
            {result.totalQuantity} toplam · {result.entitledQuantity} hak · {result.excessQuantity} sipariş fazlası
          </KkdCallout>
        )
      ) : null}

      {isHandoff ? (
        <KkdCallout
          tone="info"
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          title="Malzeme talebinden devam"
        >
          Personel ve sipariş seçimi bu adımda kilitli. Değiştirmek için sağ üstteki{' '}
          <strong>Sipariş seçimine dön</strong> ile önceki adıma gidin; burada kalem, depo ve görev ataması yapılır.
        </KkdCallout>
      ) : null}

      <KkdPanel
        code="EMP_01"
        icon={<UserRound className="size-4" strokeWidth={1.75} />}
        title={isHandoff ? 'Seçilen personel' : 'Personel seçimi'}
        description={
          isHandoff
            ? 'Talep listesinden taşındı; bu adımda değiştirilemez.'
            : 'Kartı okutun veya listeden seçin; bağlı Netsis carisi otomatik çözümlenir.'
        }
        actions={isHandoff ? <OpsStatusBadge tone="active">Kilitli</OpsStatusBadge> : undefined}
      >
        {!isHandoff ? (
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                resolveFromQr(employeeQr);
              }}
            >
              <KkdField label="Personel QR kodu">
                <OpsQrCaptureField
                  autoFocus
                  value={employeeQr}
                  onChange={setEmployeeQr}
                  onCommit={resolveFromQr}
                  disabled={resolveEmployee.isPending}
                  placeholder="Kartı okutun veya QR kodunu yazın"
                />
              </KkdField>
              <OpsActionButton
                type="submit"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={!employeeQr.trim()}
                loading={resolveEmployee.isPending}
                loadingLabel={<>Çözümleniyor…</>}
              >
                <ScanLine className="size-3.5 shrink-0" />
                Çözümle
              </OpsActionButton>
            </form>
            <KkdEmployeeLookupField
              value={employeeId}
              employees={employees.data}
              onChange={setEmployeeId}
            />
          </div>
        ) : null}

        {context.isLoading ? (
          <div className={cn(!isHandoff && 'mt-3')}>
            <OpsLoadingState code="CTX" message="Personel carisi ve açık siparişler okunuyor…" compact />
          </div>
        ) : null}

        {context.data ? (
          <div className={cn('grid gap-3 sm:grid-cols-3', !isHandoff && 'mt-3')}>
            <KkdMetric
              tone="person"
              icon={<UserRound className="size-4" strokeWidth={1.75} />}
              label="Personel"
              value={`${context.data.employeeCode} · ${context.data.employeeName}`}
            />
            <KkdMetric
              tone="customer"
              icon={<Building2 className="size-4" strokeWidth={1.75} />}
              label="Bağlı Netsis carisi"
              value={`${context.data.customerCode} · ${context.data.customerName}`}
            />
            <KkdMetric
              tone="orders"
              icon={<MapPin className="size-4" strokeWidth={1.75} />}
              label={isHandoff ? 'Seçili sipariş' : 'Şube'}
              value={isHandoff ? `${orders.length} sipariş` : context.data.branchCode}
              hint={isHandoff ? `Şube ${context.data.branchCode}` : `${context.data.orders.length} açık sipariş`}
            />
          </div>
        ) : null}
      </KkdPanel>

      {context.data ? (
        <KkdCallout tone="info" icon={<ShieldCheck className="size-4" strokeWidth={1.75} />} title="Etkin KKD süreç politikası">
          {context.data.policy.requireOpenOrder
            ? 'Açık Netsis siparişi zorunlu.'
            : 'Siparişsiz dağıtıma izin veriliyor.'}{' '}
          {context.data.policy.allowMultipleOrdersPerDistribution
            ? 'Birden fazla sipariş seçilebilir.'
            : 'Dağıtım tek siparişle sınırlandırılmıştır.'}{' '}
          {context.data.policy.allowOpenOrderExcess
            ? 'Açık sipariş bakiyesi içinde hak üstü teslim yapılabilir.'
            : 'Teslim, hesaplanan KKD hakkını aşamaz.'}{' '}
          {context.data.policy.requireManagerApprovalForExcess
            ? ' Hak üstü / kota aşımı teslimde barkod kotası uyarısı çıkar; depo müdürü fiziksel kontrol sonrası onaylar.'
            : ''}
          {context.data.preferredStocks.length > 0 ? (
            <div className="mt-1.5">
              <strong>Personelin grup tercihleri:</strong>{' '}
              {context.data.preferredStocks
                .map((item) => {
                  const groupName =
                    remainingEntitlements.data?.find((row) => row.groupCode === item.groupCode)?.groupName ||
                    remainingEntitlements.data?.find((row) => row.stockId === item.stockId)?.groupName;
                  const groupLabel = groupName ? `${item.groupCode} · ${groupName}` : item.groupCode;
                  return `${groupLabel} → ${item.stockCode}`;
                })
                .join(' · ')}
            </div>
          ) : null}
        </KkdCallout>
      ) : null}

      {context.data ? (
        <KkdPanel
          code="ORD_02"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title={isHandoff ? 'Taşınan siparişler' : 'Açık Netsis siparişleri'}
          description={
            isHandoff
              ? 'Önceki adımdan gelen seçim. Değiştirmek için sipariş seçimine dönün.'
              : 'Her teslim satırı gerçek sipariş satırına bağlı kalır. Sipariş seçilince kalemler aşağıda açılır.'
          }
          actions={
            <OpsStatusBadge tone={isHandoff ? 'active' : 'neutral'}>
              {isHandoff ? `${orders.length} kilitli` : `${orders.length} seçili`}
            </OpsStatusBadge>
          }
        >
          {context.data.orders.length === 0 ? (
            <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
              {context.data.policy.requireOpenOrder
                ? 'Bu personele bağlı cari için açık Netsis siparişi bulunmadığından dağıtım başlatılamaz.'
                : 'Bu personele bağlı cari için açık Netsis siparişi bulunamadı.'}
            </KkdCallout>
          ) : isHandoff ? (
            handedOffOrders.length === 0 ? (
              <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
                Taşınan siparişler bu cari için artık açık görünmüyor. Sipariş seçimine dönüp yenileyin.
              </KkdCallout>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {handedOffOrders.map((order) => (
                  <KkdSelectableCard
                    key={order.orderNumber}
                    selected
                    disabled
                    onToggle={() => undefined}
                    control={
                      <OpsSkinCheckbox checked disabled aria-label={order.orderNumber} onCheckedChange={() => undefined} />
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="block min-w-0 font-mono text-[0.92rem] leading-5">
                        {order.orderNumber}
                      </strong>
                      <OpsStatusBadge tone="active">Açık {order.remainingQuantity}</OpsStatusBadge>
                    </div>
                    <span className="mt-1 block text-xs text-[var(--wms-app-text-muted)]">
                      {order.projectCode || 'Projesiz'}
                    </span>
                  </KkdSelectableCard>
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {context.data.orders.map((order) => {
                const isSelected = orders.includes(order.orderNumber);
                const toggle = (): void =>
                  setOrders((current) => {
                    if (isSelected) return current.filter((x) => x !== order.orderNumber);
                    if (!context.data?.policy.allowMultipleOrdersPerDistribution) return [order.orderNumber];
                    return [...new Set([...current, order.orderNumber])];
                  });
                return (
                  <KkdSelectableCard
                    key={order.orderNumber}
                    selected={isSelected}
                    onToggle={toggle}
                    control={
                      <OpsSkinCheckbox checked={isSelected} onCheckedChange={toggle} aria-label={order.orderNumber} />
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="block min-w-0 font-mono text-[0.92rem] leading-5">
                        {order.orderNumber}
                      </strong>
                      <OpsStatusBadge tone={isSelected ? 'active' : 'neutral'}>
                        Açık {order.remainingQuantity}
                      </OpsStatusBadge>
                    </div>
                    <span className="mt-1 block text-xs text-[var(--wms-app-text-muted)]">
                      {order.projectCode || 'Projesiz'}
                    </span>
                  </KkdSelectableCard>
                );
              })}
            </div>
          )}
        </KkdPanel>
      ) : null}

      {sortedOrders.length > 0 ? (
        <KkdPanel
          code="LIN_03"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title="Sipariş kalemleri"
          description="WMS stoğuyla eşleşmeyen satırlar dağıtıma alınamaz."
          actions={<OpsStatusBadge tone="neutral">{selected.length} kalem</OpsStatusBadge>}
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          <KkdTableShell minWidthClass="min-w-[900px]" className="border-x-0 border-b-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={cn(KKD_HEAD_CELL, 'w-[3.25rem] text-center')} title="Tümünü seç">
                  <span className="inline-flex items-center justify-center">
                    <KkdRowCheckbox
                      checked={allSelectableSelected}
                      indeterminate={someSelectableSelected}
                      disabled={selectableLines.length === 0}
                      onCheckedChange={toggleAllSelectableLines}
                      ariaLabel="Tüm eşleşen kalemleri seç"
                    />
                  </span>
                </th>
                {lineColumns.map((column) => (
                  <th key={column} className={KKD_HEAD_CELL}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderLines.isLoading ? (
                <tr>
                  <td colSpan={lineColumns.length + 1} className="wms-ops-grid-state-cell">
                    <OpsLoadingState code="FETCH" message="Sipariş kalemleri okunuyor…" compact />
                  </td>
                </tr>
              ) : (orderLines.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={lineColumns.length + 1} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState message="Seçilen siparişlerde açık kalem bulunamadı." />
                  </td>
                </tr>
              ) : (
                orderLines.data?.map((line) => (
                  <tr key={lineKey(line)}>
                    <td className={cn(KKD_CELL, 'text-center')}>
                      <KkdRowCheckbox
                        checked={edits[lineKey(line)]?.selected || false}
                        disabled={!line.isMapped}
                        onCheckedChange={(checked) => patch(line, { selected: checked })}
                        ariaLabel={`${line.stockCode} kalemini seç`}
                      />
                    </td>
                    <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                      {line.orderNumber} / {line.orderLineSequence}
                    </td>
                    <td className={KKD_CELL}>
                      <strong className="block">{line.stockCode}</strong>
                      <span className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                    </td>
                    <td className={KKD_CELL}>{line.projectCode || '—'}</td>
                    <td className={cn(KKD_CELL, 'text-right font-bold')}>
                      {line.remainingQuantity} {line.unitCode}
                    </td>
                    <td className={KKD_CELL}>
                      {line.isMapped ? (
                        <OpsStatusBadge tone="done">WMS ile eşleşti</OpsStatusBadge>
                      ) : (
                        <span className="inline-flex items-start gap-2 text-rose-500">
                          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                          <span className="text-xs">{line.mappingMessage}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </KkdTableShell>
        </KkdPanel>
      ) : null}

      {selected.length > 0 ? (
        <KkdPanel
          code="OUT_04"
          icon={<Warehouse className="size-4" strokeWidth={1.75} />}
          title="Teslim ve stok çıkış ayrıntıları"
          description="Kaynak depo, belge serisi ve satır bazında raf/seri bilgisi ambar çıkışını oluşturur."
        >
          <div
            className={cn(
              'wms-ops-kkd-header-fields',
              initialSelection.taskMode && 'wms-ops-kkd-header-fields--with-assignees',
            )}
          >
            <KkdField label="Kaynak depo" className="w-full">
              <div className="wms-ops-field-shell w-full min-w-0">
                <PagedAppDropdown<WarehouseOption>
                  queryKey={['kkd-warehouses', context.data?.branchCode]}
                  fetchPage={(request) => warehouseOutboundApi.warehouses(request, context.data?.branchCode || '0')}
                  toOption={(item) => ({
                    value: `${item.id}|${item.warehouseCode}`,
                    label: `${item.warehouseCode} · ${item.warehouseName}`,
                  })}
                  value={warehouseValue}
                  onValueChange={(value) => {
                    setWarehouseValue(value);
                    setEdits((current) =>
                      Object.fromEntries(
                        Object.entries(current).map(([key, item]) => [
                          key,
                          {
                            ...item,
                            sourceLocationId: undefined,
                            sourceLocationValue: null,
                            sourceLocationLabel: undefined,
                          },
                        ]),
                      ),
                    );
                    setLocationLookupKey(null);
                  }}
                  placeholder="Kaynak depo seçin"
                  searchable
                  className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                />
              </div>
            </KkdField>
            <KkdField label="Ambar çıkış belge serisi" className="w-full">
              <OpsSelect
                value={seriesId}
                onValueChange={setSeriesId}
                options={seriesOptions}
                placeholder="Seri seçin"
                searchable
                className="w-full"
              />
            </KkdField>
            <KkdField label="Belge tarihi" className="w-full">
              <AppDateInput
                className="w-full"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
              />
            </KkdField>
            {initialSelection.taskMode ? (
              <KkdField
                className="w-full"
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <UsersRound className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    Depo görevlileri
                    <OpsStatusBadge tone="neutral">Opsiyonel</OpsStatusBadge>
                    <TooltipProvider delayDuration={160}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex text-[var(--wms-ops-accent)]"
                            aria-label="Depo görevlisi atama açıklaması"
                          >
                            <CircleHelp className="size-3.5" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          sideOffset={8}
                          className="max-w-[22rem] text-left text-[0.78rem] leading-5"
                        >
                          İsterseniz talebi şimdi atayın. Boş bırakırsanız açık görev oluşur ve görev havuzundan
                          sonradan atanabilir; sevk politikası atamayı zorunlu tutuyorsa API işlemi güvenli
                          biçimde durdurur.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                }
              >
                <div className="wms-ops-field-shell w-full min-w-0">
                  <PagedAppDropdown<ActiveUserOption>
                    queryKey={['kkd-material-request-users']}
                    fetchPage={warehouseOutboundApi.users}
                    toOption={(user) => ({
                      value: encodeUser(user),
                      label: `${user.firstName} ${user.lastName}`.trim() || user.username,
                      description: `${user.username} · ${user.email}`,
                      disabled: assignees.some((x) => x.id === user.id),
                    })}
                    value={null}
                    onValueChange={(value) => {
                      const user = decodeUser(value);
                      if (user) {
                        setAssignees((current) =>
                          current.some((x) => x.id === user.id) ? current : [...current, user],
                        );
                      }
                    }}
                    placeholder="Depo çalışanı ekle"
                    searchable
                    minSearchLength={1}
                    className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                  />
                </div>
                {assignees.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {assignees.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1.5 border border-[color-mix(in_oklab,var(--wms-ops-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)] px-2 py-0.5 text-[0.7rem]"
                      >
                        <strong>{`${user.firstName} ${user.lastName}`.trim() || user.username}</strong>
                        <button
                          type="button"
                          onClick={() => setAssignees((current) => current.filter((x) => x.id !== user.id))}
                          className="text-rose-500"
                          aria-label={`${user.username} atamasını kaldır`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </KkdField>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {selected.map((line) => {
              const key = lineKey(line);
              const edit = edits[key];
              const quotaHit = quotaWarnings.find((item) => item.key === key);
              const groupMeta =
                remainingEntitlements.data?.find((row) => row.stockId === line.stockId) ??
                remainingEntitlements.data?.find(
                  (row) =>
                    row.groupCode ===
                    context.data?.preferredStocks.find((pref) => pref.stockId === line.stockId)?.groupCode,
                );
              const groupLabel = groupMeta
                ? groupMeta.groupName
                  ? `${groupMeta.groupCode} · ${groupMeta.groupName}`
                  : groupMeta.groupCode
                : context.data?.preferredStocks.find((pref) => pref.stockId === line.stockId)?.groupCode;
              const substituteGroupCode =
                groupMeta?.groupCode ||
                context.data?.preferredStocks.find((pref) => pref.stockId === line.stockId)?.groupCode;
              const substituted = Boolean(edit.issuedStockId && edit.issuedStockId !== line.stockId);
              return (
                <article
                  key={key}
                  className={cn(
                    'wms-ops-kkd-delivery-row',
                    isPremium ? 'wms-ops-kkd-delivery-row--premium' : 'wms-ops-kkd-delivery-row--terminal',
                  )}
                >
                  <div className="wms-ops-kkd-delivery-row__head">
                    <div className="min-w-0">
                      <div className="wms-ops-kkd-delivery-row__title">
                        {substituted ? edit.issuedStockLabel : `${line.stockCode} · ${line.stockName}`}
                      </div>
                      <div className="wms-ops-kkd-delivery-row__meta">
                        {line.orderNumber} / sıra {line.orderLineSequence} · en fazla {line.remainingQuantity}
                        {groupLabel ? ` · grup ${groupLabel}` : ''}
                        {quotaHit
                          ? ` · kalan hak ${quotaHit.remaining}${
                              quotaHit.nextEligibleDate
                                ? ` · sonraki ${new Date(quotaHit.nextEligibleDate).toLocaleDateString('tr-TR')}`
                                : ''
                            }`
                          : ''}
                      </div>
                      {substituted ? (
                        <p className="mt-1 text-[0.7rem] leading-4 text-amber-600 dark:text-amber-400">
                          Talep: {line.stockCode} · {line.stockName} → çıkış: {edit.issuedStockLabel}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {quotaHit ? (
                        <OpsStatusBadge tone="danger" title={KKD_QUOTA_FULL_TITLE}>
                          Kota dolu
                        </OpsStatusBadge>
                      ) : null}
                      {substituted ? <OpsStatusBadge tone="pending">Stok değişti</OpsStatusBadge> : null}
                      <OpsStatusBadge tone="active">{line.unitCode || 'ADET'}</OpsStatusBadge>
                    </div>
                  </div>
                  <div className="mb-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <KkdField label="Çıkış stoğu">
                      <PagedLookupDialog<KkdStockLookup>
                        variant="ops"
                        triggerMode="button"
                        open={stockLookupKey === key}
                        onOpenChange={(open) => setStockLookupKey(open ? key : null)}
                        title="Çıkış stoğu seç"
                        description={
                          substituteGroupCode
                            ? `Grup ${substituteGroupCode} içinden stok seçin. Grup koduyla çıkış yapılamaz; yalnızca stok kodu kullanılır.`
                            : 'Uymayan ürün için alternatif stok seçin. Çıkış stok koduyla yapılır.'
                        }
                        value={edit.issuedStockLabel ?? `${line.stockCode} · ${line.stockName}`}
                        placeholder="Stok değiştir"
                        searchPlaceholder="Stok ara"
                        emptyText="Stok bulunamadı."
                        triggerClassName="h-7 truncate"
                        queryKey={['kkd-stock-substitute', key, substituteGroupCode || 'all']}
                        fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                          toPagedResponse(
                            await kkdApi.stocksPaged(
                              {
                                pageNumber,
                                pageSize,
                                search,
                                sortBy: 'code',
                                sortDirection: 'asc',
                                signal: signal ?? new AbortController().signal,
                              },
                              substituteGroupCode,
                            ),
                          )
                        }
                        getKey={(item) => String(item.id)}
                        getLabel={stockOptionLabel}
                        onSelect={(stock) => {
                          patch(line, {
                            issuedStockId: stock.id,
                            issuedStockLabel: stockOptionLabel(stock),
                          });
                        }}
                      />
                    </KkdField>
                    {substituted ? (
                      <OpsActionButton
                        variant="secondary"
                        className="wms-ops-list-toolbar-btn"
                        onClick={() => patch(line, { issuedStockId: undefined, issuedStockLabel: undefined })}
                      >
                        <X className="size-3.5 shrink-0" />
                        Talebe dön
                      </OpsActionButton>
                    ) : null}
                  </div>
                  <div className="wms-ops-kkd-delivery-row__fields">
                    <div className="wms-ops-kkd-delivery-row__field">
                      <span className="wms-ops-entry-label">Miktar</span>
                      <AppInput
                        type="number"
                        min="0.000001"
                        max={line.remainingQuantity}
                        step="any"
                        value={edit.quantity}
                        onChange={(event) => patch(line, { quantity: Number(event.target.value) })}
                      />
                    </div>
                    <div className="wms-ops-kkd-delivery-row__field">
                      <span className="wms-ops-entry-label">Kaynak raf</span>
                      <PagedLookupDialog<LocationOption>
                        variant="ops"
                        triggerMode="combobox"
                        autoSearchMinLength={1}
                        disabled={warehouseId <= 0}
                        open={locationLookupKey === key}
                        onOpenChange={(open) => setLocationLookupKey(open ? key : null)}
                        title="Kaynak raf seç"
                        description="Raf kodu yazarak arayın; arama ikonu veya çift tık ile liste penceresini açın."
                        value={edit.sourceLocationLabel ?? ''}
                        placeholder={warehouseId > 0 ? 'Raf yazın veya seçin' : 'Önce kaynak depo seçin'}
                        searchPlaceholder="Raf ara"
                        emptyText={
                          warehouseId > 0
                            ? 'Bu depoda raf bulunamadı.'
                            : 'Önce üstteki kaynak depoyu seçin.'
                        }
                        triggerClassName="h-7 truncate"
                        queryKey={['kkd-location-lookup', warehouseId, key]}
                        fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                          toPagedResponse(
                            await warehouseOutboundApi.locations(
                              {
                                pageNumber,
                                pageSize,
                                search,
                                sortBy: 'code',
                                sortDirection: 'asc',
                                signal: signal ?? new AbortController().signal,
                              },
                              warehouseId,
                            ),
                          )
                        }
                        getKey={(item) => String(item.id)}
                        getLabel={locationLabel}
                        onSelect={(location) => {
                          patch(line, {
                            sourceLocationValue: String(location.id),
                            sourceLocationId: location.id,
                            sourceLocationLabel: locationLabel(location),
                          });
                        }}
                      />
                    </div>
                    <div className="wms-ops-kkd-delivery-row__field">
                      <span
                        className="wms-ops-entry-label"
                        title="Lot takipli stokta doldurun; değilse boş bırakın"
                      >
                        Lot
                      </span>
                      <AppInput
                        value={edit.lotNo}
                        placeholder="Opsiyonel"
                        onChange={(event) => patch(line, { lotNo: event.target.value })}
                      />
                    </div>
                    <div className="wms-ops-kkd-delivery-row__field">
                      <span
                        className="wms-ops-entry-label"
                        title="Seri takipli stokta elle yazın veya barkod okutun; virgülle ayırın, adet kadar olmalı"
                      >
                        Seriler
                      </span>
                      <AppInput
                        className="font-mono"
                        value={edit.serials}
                        placeholder="Opsiyonel · virgülle"
                        onChange={(event) => patch(line, { serials: event.target.value })}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {hasQuotaWarning ? (
            <KkdCallout
              tone="warn"
              className="mt-3"
              icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
              title={KKD_QUOTA_FULL_TITLE}
            >
              <p>{KKD_QUOTA_FULL_MESSAGE}</p>
              <ul className="mt-2 space-y-1 text-[0.78rem]">
                {quotaWarnings.map((item) => (
                  <li key={item.key}>
                    <strong>{item.stockCode}</strong> · talep {item.quantity} / kalan hak {item.remaining}
                    {item.frequencyBlocked ? ` — ${KKD_QUOTA_FREQUENCY_HINT}` : ''}
                    {item.nextEligibleDate
                      ? ` (sonraki hak: ${new Date(item.nextEligibleDate).toLocaleDateString('tr-TR')})`
                      : ''}
                  </li>
                ))}
              </ul>
              {context.data?.policy.requireManagerApprovalForExcess ? (
                <p className="mt-2 text-[0.72rem] text-[var(--wms-app-text-muted)]">
                  Belge yine oluşturulabilir; kota aşımı için müdür onayı bekleyen kayda düşer.
                </p>
              ) : null}
            </KkdCallout>
          ) : null}

          <KkdField label="Açıklama" className="mt-4">
            <KkdTextarea
              value={description}
              onChange={setDescription}
              className="min-h-24 wms-ops-notes-textarea"
              ariaLabel="Dağıtım açıklaması"
            />
          </KkdField>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <OpsActionButton
              variant="primary"
              loading={create.isPending}
              loadingLabel={
                <>
                  <PackageCheck className="size-3.5 shrink-0" />
                  Hazırlanıyor…
                </>
              }
              onClick={() => create.mutate()}
            >
              <PackageCheck className="size-3.5 shrink-0" />
              Dağıtımı ve ambar çıkışını hazırla
            </OpsActionButton>
          </div>
        </KkdPanel>
      ) : null}

      <KkdDistributionReceiptDialog
        open={receiptOpen && Boolean(receiptDetail.data)}
        onOpenChange={setReceiptOpen}
        detail={receiptDetail.data ?? null}
      />
    </KkdPage>
  );
}
