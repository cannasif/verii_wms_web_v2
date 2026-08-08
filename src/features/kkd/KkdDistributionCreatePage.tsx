import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Factory,
  MapPin,
  PackageCheck,
  Printer,
  ScanLine,
  Settings2,
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
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import { warehouseOutboundApi } from '@/features/warehouse-outbound/warehouseOutbound-api';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { StockTrackingPolicyField } from '@/features/stock-tracking/effective-stock-tracking';
import type { EffectiveStockTrackingPolicy } from '@/features/stock-tracking/effective-stock-tracking.service';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import { useAuthStore } from '@/stores/auth-store';
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
  isExcessApprovalPending,
  KKD_QUOTA_FREQUENCY_HINT,
  KKD_QUOTA_FULL_MESSAGE,
  KKD_QUOTA_FULL_TITLE,
} from './kkd-quota-copy';

const KKD_REQUESTS_PATH = '/warehouse/kkd/requests';

const FLOW_STEPS = [
  { id: 'select', label: 'Sipariş seçimi' },
  { id: 'distribute', label: 'Teslim ve çıkış' },
] as const;

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
type KkdQuotaWarningItem = {
  key: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  remaining: number;
  nextEligibleDate?: string;
  frequencyBlocked: boolean;
};
const encodeUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string | null): ActiveUserOption | null =>
  value ? (JSON.parse(decodeURIComponent(value)) as ActiveUserOption) : null;

/** Oturum kullanıcısından, işlemi yapan kişi alanı için varsayılan seçenek üretir. */
function toActiveUserOption(user: { id: number; email: string; name?: string }): ActiveUserOption {
  const [firstName = '', ...rest] = (user.name || user.email).trim().split(/\s+/);
  return {
    id: user.id,
    username: user.email,
    email: user.email,
    firstName,
    lastName: rest.join(' '),
    isActive: true,
  };
}

function flashInvalidFields(): void {
  window.requestAnimationFrame(() => {
    document
      .querySelectorAll(
        '.wms-ops-form [aria-invalid="true"], .wms-ops-form .wms-ops-field-shell--error, .wms-ops-form .app-input-shell[data-invalid="true"]',
      )
      .forEach((node) => {
        const el = node as HTMLElement;
        el.classList.remove('wms-error-focus-flash');
        void el.offsetWidth;
        el.classList.add('wms-error-focus-flash');
        window.setTimeout(() => el.classList.remove('wms-error-focus-flash'), 2600);
      });
  });
}

function contextErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Personel-cari bağlantısı veya Netsis erişimi kontrol edilmelidir.';
}

type FlowStep = 'select' | 'distribute';

export function KkdDistributionCreatePage(): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const queryClient = useQueryClient();
  const { can } = usePermissionAccess();
  const canManageOverrides = can('WMS.KKD.OVERRIDES.MANAGE');
  const authUser = useAuthStore((state) => state.user);
  const currentUserOption = useMemo(
    () => (authUser ? toActiveUserOption(authUser) : null),
    [authUser],
  );
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
    requestId: Number(searchParams.get('requestId') || 0),
  }));
  const requestMode = initialSelection.requestId > 0;
  const startsOnDistribute =
    requestMode || (Boolean(initialSelection.employeeId) && initialSelection.orders.length > 0);

  const [flowStep, setFlowStep] = useState<FlowStep>(startsOnDistribute ? 'distribute' : 'select');
  const isDistributeStep = requestMode || flowStep === 'distribute';
  const isLocked = isDistributeStep;

  /** Listeden / QR çözümünden seçilen personel (henüz talepler yüklenmemiş olabilir). */
  const [pickedEmployeeId, setPickedEmployeeId] = useState(initialSelection.employeeId);
  /** Talepleri getir ile sabitlenen personel — select adımı sorguları buna bağlı. */
  const [activeEmployeeId, setActiveEmployeeId] = useState(initialSelection.employeeId);
  const [employeeQr, setEmployeeQr] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>(initialSelection.orders);
  const [fieldErrors, setFieldErrors] = useState<{ qr?: boolean; employee?: boolean }>({});
  const previousEmployeeIdRef = useRef(initialSelection.employeeId);

  /** Dağıtım adımında kilitli personel / sipariş. */
  const [employeeId, setEmployeeId] = useState(initialSelection.employeeId);
  const [orders, setOrders] = useState<string[]>(initialSelection.orders);

  const activeEmployeeNumber = Number(activeEmployeeId || 0);
  const employeeNumber = Number(employeeId || 0);
  const sortedSelectedOrders = useMemo(() => [...selectedOrders].sort(), [selectedOrders]);
  const sortedOrders = useMemo(() => [...orders].sort(), [orders]);

  const configuration = useQuery({
    queryKey: ['kkd', 'material-requests', 'configuration'],
    queryFn: kkdApi.materialRequestConfiguration,
    enabled: !requestMode,
  });
  const enabled = configuration.data?.isEnabled === true;
  const employees = useQuery({
    queryKey: ['kkd', 'employees'],
    queryFn: kkdApi.employees,
    enabled: requestMode || enabled || isDistributeStep,
  });
  const selectContext = useQuery({
    queryKey: ['kkd', 'material-requests', 'context', activeEmployeeNumber],
    queryFn: () => kkdApi.materialRequestContext(activeEmployeeNumber),
    enabled: !requestMode && !isDistributeStep && enabled && activeEmployeeNumber > 0,
    retry: false,
  });
  const previewLines = useQuery({
    queryKey: ['kkd', 'material-requests', 'lines', activeEmployeeNumber, sortedSelectedOrders.join('|')],
    queryFn: () => kkdApi.materialRequestOrderLines(activeEmployeeNumber, sortedSelectedOrders),
    enabled:
      !requestMode && !isDistributeStep && enabled && activeEmployeeNumber > 0 && sortedSelectedOrders.length > 0,
  });
  const resolveEmployee = useMutation({
    mutationFn: (qrCode: string) => kkdApi.resolveEmployeeQr(qrCode.trim()),
  });
  const requestsBusy = resolveEmployee.isPending || selectContext.isFetching;

  const series = useQuery({ queryKey: ['kkd', 'distribution-series'], queryFn: kkdApi.distributionSeries });
  const context = useQuery({
    queryKey: ['kkd', 'distribution-context', employeeNumber, requestMode ? 'request' : 'order'],
    queryFn: () => kkdApi.distributionContext(employeeNumber, !requestMode),
    enabled: isDistributeStep && employeeNumber > 0,
  });
  const handedOffOrders = useMemo(() => {
    if (!context.data) return [];
    const selected = new Set(orders);
    return context.data.orders.filter((order) => selected.has(order.orderNumber));
  }, [context.data, orders]);
  const orderLines = useQuery({
    queryKey: ['kkd', 'distribution-lines', employeeNumber, sortedOrders.join('|')],
    queryFn: () => kkdApi.distributionOrderLines(employeeNumber, sortedOrders),
    enabled: isDistributeStep && !requestMode && employeeNumber > 0 && sortedOrders.length > 0,
  });
  const linkedRequest = useQuery({
    queryKey: ['kkd', 'requests', initialSelection.requestId],
    queryFn: () => kkdApi.requestDetail(initialSelection.requestId),
    enabled: requestMode,
  });
  const effectiveLines = useMemo<KkdOpenOrderLine[]>(
    () =>
      requestMode
        ? (linkedRequest.data?.lines ?? [])
            .filter((line) => line.status !== 'Cancelled')
            .map((line) => ({
              orderNumber: linkedRequest.data!.requestNo,
              orderLineId: line.id,
              orderLineSequence: line.lineNo,
              stockId: line.stockId ?? undefined,
              stockCode: line.stockCode ?? line.groupCode,
              stockName: line.stockName ?? line.groupName ?? line.groupCode,
              unitCode: line.unitCode,
              projectCode: line.groupCode,
              remainingQuantity: line.remainingQuantity,
              isMapped: Boolean(line.stockId),
              mappingMessage: line.stockId
                ? undefined
                : `${line.groupCode} grubu için stok/beden seçimi bekleniyor.`,
              kkdRequestLineId: line.id,
            }))
        : (orderLines.data ?? []),
    [linkedRequest.data, orderLines.data, requestMode],
  );

  const [warehouseValue, setWarehouseValue] = useState<string | null>(null);
  const warehouseId = Number(warehouseValue?.split('|')[0] || 0);
  const [seriesId, setSeriesId] = useState('');
  const [documentDate, setDocumentDate] = useState(today());
  const remainingEntitlements = useQuery({
    queryKey: ['kkd', 'remaining-entitlements', employeeNumber, documentDate],
    queryFn: () => kkdApi.remainingEntitlements(employeeNumber, documentDate),
    enabled: isDistributeStep && employeeNumber > 0,
  });
  const [description, setDescription] = useState('');
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});
  const [locationLookupKey, setLocationLookupKey] = useState<string | null>(null);
  const [stockLookupKey, setStockLookupKey] = useState<string | null>(null);
  const [result, setResult] = useState<KkdDistributionCreateResult>();
  const resultCalloutRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result) return;
    resultCalloutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultCalloutRef.current?.focus({ preventScroll: true });
  }, [result]);
  const [submittedQuotaWarnings, setSubmittedQuotaWarnings] = useState<KkdQuotaWarningItem[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const assigneesDefaultedRef = useRef(false);
  /** Aynı teslimin tekrar tekrar gönderilmesini (çoklu tıklama) önlemek için oturum başına tek anahtar. */
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const receiptDetail = useQuery({
    queryKey: ['kkd', 'distributions', 'detail', result?.id],
    queryFn: () => kkdApi.distributionDetail(result!.id),
    enabled: Boolean(result?.id) && receiptOpen,
  });
  const warehouseAccess = useQuery({
    queryKey: ['kkd', 'warehouse-access'],
    queryFn: goodsReceiptV2Api.warehouseAccess,
    enabled: isDistributeStep,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (previousEmployeeIdRef.current === activeEmployeeId) return;
    previousEmployeeIdRef.current = activeEmployeeId;
    setSelectedOrders([]);
  }, [activeEmployeeId]);

  useEffect(() => {
    if (!fieldErrors.qr && !fieldErrors.employee) return;
    const timer = window.setTimeout(() => flashInvalidFields(), 40);
    return () => window.clearTimeout(timer);
  }, [fieldErrors]);

  useEffect(() => {
    if (!selectContext.isError || !selectContext.error) return;
    toast.error(contextErrorMessage(selectContext.error));
  }, [selectContext.isError, selectContext.errorUpdatedAt, selectContext.error]);

  useEffect(() => {
    const preferred = series.data?.find((x) => x.isDefault) ?? series.data?.[0];
    if (preferred && !seriesId) setSeriesId(String(preferred.id));
  }, [series.data, seriesId]);

  /** Dağıtım adımına her girişte işlemi yapan kişiyi oturum kullanıcısıyla öner (bir kez). */
  useEffect(() => {
    if (!isDistributeStep) {
      assigneesDefaultedRef.current = false;
      return;
    }
    if (assigneesDefaultedRef.current) return;
    assigneesDefaultedRef.current = true;
    if (currentUserOption) setAssignees([currentUserOption]);
  }, [isDistributeStep, currentUserOption]);

  /** Kullanıcı yetkisi tek depoyla sınırlıysa kaynak depoyu otomatik seç. */
  useEffect(() => {
    if (!isDistributeStep || warehouseValue) return;
    const access = warehouseAccess.data;
    if (!access?.isRestricted) return;
    if (access.warehouseIds.length === 1 && access.warehouseCodes.length === 1) {
      setWarehouseValue(`${access.warehouseIds[0]}|${access.warehouseCodes[0]}`);
    }
  }, [isDistributeStep, warehouseAccess.data, warehouseValue]);

  const pickEmployee = (nextEmployeeId: string): void => {
    setPickedEmployeeId(nextEmployeeId);
    setEmployeeQr('');
    setActiveEmployeeId('');
    setSelectedOrders([]);
    setFieldErrors({});
  };

  const onQrChange = (value: string): void => {
    setEmployeeQr(value);
    setFieldErrors((current) => (current.qr || current.employee ? {} : current));
    if (!value.trim()) return;
    setPickedEmployeeId('');
    setActiveEmployeeId('');
    setSelectedOrders([]);
  };

  const loadEmployeeRequests = (nextEmployeeId: string): void => {
    setFieldErrors({});
    setPickedEmployeeId(nextEmployeeId);
    if (activeEmployeeId === nextEmployeeId) {
      void selectContext.refetch();
      return;
    }
    setActiveEmployeeId(nextEmployeeId);
  };

  const loadRequests = (qrOverride?: string): void => {
    if (requestsBusy) return;
    const qr = (qrOverride ?? employeeQr).trim();
    if (qr) {
      setFieldErrors({});
      setEmployeeQr(qr);
      resolveEmployee.mutate(qr, {
        onSuccess: (employee) => {
          const id = String(employee.id);
          setEmployeeQr('');
          toast.success(`${employee.employeeCode} · ${employee.fullName} bulundu.`);
          loadEmployeeRequests(id);
        },
        onError: (error) => {
          setFieldErrors({ qr: true });
          toast.error(error instanceof Error ? error.message : 'Personel kartı çözümlenemedi.');
        },
      });
      return;
    }
    if (pickedEmployeeId) {
      loadEmployeeRequests(pickedEmployeeId);
      return;
    }
    setFieldErrors({ qr: true, employee: true });
    toast.error('Personel seçin veya kart / QR okutun.');
  };

  const toggleOrder = (orderNumber: string): void => {
    setSelectedOrders((current) => {
      if (current.includes(orderNumber)) return current.filter((item) => item !== orderNumber);
      if (!selectContext.data?.policy.allowMultipleOrdersPerDistribution) return [orderNumber];
      return [...new Set([...current, orderNumber])];
    });
  };

  const prepareDistribution = (): void => {
    if (!enabled || !activeEmployeeNumber || sortedSelectedOrders.length === 0) return;
    setEmployeeId(String(activeEmployeeNumber));
    setOrders(sortedSelectedOrders);
    setEdits({});
    setWarehouseValue(null);
    setResult(undefined);
    setSubmittedQuotaWarnings([]);
    setDescription('');
    setIdempotencyKey(crypto.randomUUID());
    setFlowStep('distribute');
  };

  const returnToSelect = (): void => {
    if (requestMode) return;
    setPickedEmployeeId(employeeId);
    setActiveEmployeeId(employeeId);
    setSelectedOrders(orders);
    setFlowStep('select');
  };

  /** Sonuç ekranından "yeni teslim başlat" — aynı personel/sipariş için formu sıfırlar. */
  const startNewDelivery = (): void => {
    setResult(undefined);
    setSubmittedQuotaWarnings([]);
    setEdits({});
    setWarehouseValue(null);
    setDescription('');
    setAssignees(currentUserOption ? [currentUserOption] : []);
    setIdempotencyKey(crypto.randomUUID());
  };

  const patch = (line: KkdOpenOrderLine, value: Partial<LineEdit>): void =>
    setEdits((current) => {
      const key = lineKey(line);
      const existing =
        current[key] ?? { selected: false, quantity: Math.min(1, line.remainingQuantity), lotNo: '', serials: '' };
      return { ...current, [key]: { ...existing, ...value } };
    });
  const selected = effectiveLines.filter((x) => edits[lineKey(x)]?.selected);

  const [trackingPolicies, setTrackingPolicies] = useState<Record<number, EffectiveStockTrackingPolicy>>({});
  const [trackingPolicyLoading, setTrackingPolicyLoading] = useState<Record<number, boolean>>({});
  const effectiveStockId = (line: KkdOpenOrderLine, edit?: LineEdit): number | undefined =>
    edit?.issuedStockId ?? line.stockId;
  const selectedStockIdsKey = useMemo(() => {
    const ids = new Set<number>();
    for (const line of selected) {
      const stockId = effectiveStockId(line, edits[lineKey(line)]);
      if (stockId) ids.add(stockId);
    }
    return Array.from(ids).sort((a, b) => a - b).join(',');
  }, [selected, edits]);
  useEffect(() => {
    const branchCode = context.data?.branchCode;
    if (!branchCode || !selectedStockIdsKey) return;
    const stockIds = selectedStockIdsKey.split(',').map(Number);
    for (const stockId of stockIds) {
      if (!stockId || trackingPolicies[stockId] || trackingPolicyLoading[stockId]) continue;
      setTrackingPolicyLoading((current) => ({ ...current, [stockId]: true }));
      warehouseOutboundApi
        .trackingPolicy(branchCode, stockId)
        .then((policy) => setTrackingPolicies((current) => ({ ...current, [stockId]: policy })))
        .catch(() => undefined)
        .finally(() => setTrackingPolicyLoading((current) => ({ ...current, [stockId]: false })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStockIdsKey, context.data?.branchCode]);

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
          nextEligibleDate: match.nextEligibleDate ?? undefined,
          frequencyBlocked,
        },
      ];
    });
  }, [context.data?.preferredStocks, documentDate, edits, remainingEntitlements.data, selected]);
  const hasQuotaWarning = quotaWarnings.length > 0;
  const selectableLines = useMemo(
    () => effectiveLines.filter((line) => line.isMapped),
    [effectiveLines],
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
        throw new Error(
          requestMode
            ? 'Personel, kaynak depo, belge serisi ve en az bir KKD talep kalemi zorunludur.'
            : 'Personel, kaynak depo, belge serisi ve en az bir sipariş kalemi zorunludur.',
        );
      }
      if (assignees.length === 0) {
        throw new Error('İşlemi yapan kişi seçilmelidir.');
      }
      const quotaSnapshot = quotaWarnings;
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
        const issuedStockId = requestMode ? line.stockId! : edit.issuedStockId ?? line.stockId!;
        const substituted = !requestMode && Boolean(edit.issuedStockId && edit.issuedStockId !== line.stockId);
        const policy = trackingPolicies[issuedStockId];
        if (!policy) {
          throw new Error(
            `${line.stockCode} için stok takip politikası henüz yüklenmedi; bir an bekleyip tekrar deneyin.`,
          );
        }
        if (policy.trackingType !== 'None' && !trackings?.length) {
          throw new Error(
            `${line.stockCode} seri/lot takipli bir stoktur; lot veya seri bilgisi girilmeden teslim edilemez.`,
          );
        }
        if (policy.requireSerial && trackings?.some((t) => !t.serialNo)) {
          throw new Error(`${line.stockCode} için seri numarası zorunludur.`);
        }
        if (policy.requireLot && trackings?.some((t) => !t.lotNo)) {
          throw new Error(`${line.stockCode} için lot numarası zorunludur.`);
        }
        return {
          stockId: issuedStockId,
          yapCodeId: null,
          quantity: edit.quantity,
          unitCode: line.unitCode || null,
          sourceLocationId: edit.sourceLocationId,
          orderNumber: requestMode ? null : line.orderNumber,
          orderLineId: requestMode ? null : line.orderLineId,
          requireHandlingUnit: false,
          description: substituted
            ? `Stok değişimi: bu stoktan istendi (${line.stockCode} · ${line.stockName}), bu stoktan çıkış yapıldı (${edit.issuedStockLabel}).`
            : null,
          trackings,
          kkdRequestLineId: line.kkdRequestLineId ?? null,
        };
      });
      const response = await kkdApi.createDistribution({
        idempotencyKey,
        employeeId: employeeNumber,
        warehouseId,
        documentSeriesId: Number(seriesId),
        documentDate,
        stagingLocationId: null,
        loadingLocationId: null,
        description: description.trim() || null,
        lines,
        createWarehouseTask: true,
        assignedUserIds: assignees.map((x) => x.id),
        kkdRequestId: requestMode ? initialSelection.requestId : null,
      });
      return { response, quotaSnapshot };
    },
    onSuccess: ({ response, quotaSnapshot }) => {
      setResult(response);
      setSubmittedQuotaWarnings(quotaSnapshot);
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'remaining-entitlements', employeeNumber] });
      if (isExcessApprovalPending(response.excessApprovalStatus) || response.excessQuantity > 0) {
        toast.warning(`${response.documentNo}: kota aşımı nedeniyle müdür onayına gönderildi.`);
      } else {
        toast.success(`${response.documentNo} oluşturuldu; ambar çıkış operasyonuna hazır.`);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'KKD dağıtımı oluşturulamadı.'),
  });

  const seriesOptions: AppDropdownOption[] = (series.data ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} · ${item.name}`,
    description: item.isDefault ? 'Varsayılan seri' : item.previewDocumentNumber,
  }));
  const previewLineColumns = [
    'Sipariş / sıra',
    'Stok',
    'Proje',
    'Sipariş tarihi',
    'Teslim tarihi',
    'Kalan',
    'WMS durumu',
  ];
  const lineColumns = requestMode
    ? ['Talep / sıra', 'Stok', 'KKD grubu', 'Kalan miktar', 'Çözümleme']
    : ['Sipariş / sıra', 'Stok', 'Proje', 'Açık miktar', 'Eşleme'];

  return (
    <KkdPage
      title="KKD Malzeme Talep Siparişleri"
      description="Personel kartından bağlı carinin canlı Netsis açık siparişlerini getirin; hak ve frekans uygunsa kalemleri seçip teslimi ve ambar çıkışını aynı sayfada tamamlayın."
      actions={
        !requestMode ? (
          <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
            <Link to="/warehouse/production-transfers/task-pool">
              <Factory className="size-3.5 shrink-0" />
              Üretim transfer görevleri
            </Link>
          </OpsActionButton>
        ) : undefined
      }
    >
      {!result ? (
        !requestMode ? (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <KkdFlowSteps
              steps={[...FLOW_STEPS]}
              currentId={isDistributeStep ? 'distribute' : 'select'}
              className="min-w-0 flex-1"
            />
            {isDistributeStep ? (
              <OpsActionButton
                variant="secondary"
                className="w-full shrink-0 sm:w-auto"
                type="button"
                onClick={returnToSelect}
              >
                <ArrowLeft className="size-3.5 shrink-0" />
                Sipariş seçimine dön
              </OpsActionButton>
            ) : null}
          </div>
        ) : (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <KkdFlowSteps steps={[...FLOW_STEPS]} currentId="distribute" className="min-w-0 flex-1" />
            <OpsActionButton variant="secondary" className="w-full shrink-0 sm:w-auto" asChild>
              <Link to={KKD_REQUESTS_PATH}>
                <ArrowLeft className="size-3.5 shrink-0" />
                Açık taleplere dön
              </Link>
            </OpsActionButton>
          </div>
        )
      ) : null}

      {result ? (
        <div ref={resultCalloutRef} tabIndex={-1} className="outline-none">
          <KkdDeliveryResultScene
            result={result}
            submittedQuotaWarnings={submittedQuotaWarnings}
            canManageOverrides={canManageOverrides}
            onPrintReceipt={() => setReceiptOpen(true)}
            onNewDelivery={startNewDelivery}
          />
        </div>
      ) : null}

      {/* ——— SELECT STEP ——— */}
      {!requestMode && !isDistributeStep ? (
        <>
          {configuration.isLoading ? (
            <KkdPanel
              code="CFG"
              icon={<Settings2 className="size-4" strokeWidth={1.75} />}
              title="Şube politikası"
              description="Malzeme talep kanalının açık olup olmadığı okunuyor."
            >
              <OpsLoadingState code="POLICY" message="Şube malzeme talep politikası yükleniyor…" />
            </KkdPanel>
          ) : null}

          {configuration.isError ? (
            <KkdCallout
              tone="danger"
              icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
              title="Politika okunamadı"
            >
              Malzeme talep süreç parametresi okunamadı.
            </KkdCallout>
          ) : null}

          {configuration.data && !enabled ? (
            <KkdCallout
              tone="warn"
              icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
              title="Malzeme talep siparişleri kapalı"
              actions={
                <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
                  <Link to="/warehouse/kkd/policy">
                    <Settings2 className="size-3.5 shrink-0" />
                    KKD süreç politikasını aç
                  </Link>
                </OpsActionButton>
              }
            >
              Bu kanal şubenin KKD süreç politikasından etkinleştirilmeden personel kartı veya Netsis açık siparişi
              okunmaz.
            </KkdCallout>
          ) : null}

          {enabled ? (
            <KkdPanel
              code="EMP_01"
              icon={<UserRound className="size-4" strokeWidth={1.75} />}
              title="Personel seçimi"
              description="Kart / QR okutunca (Enter, Tab veya kamera) personel seçilir ve talepler gelir. Listeden seçince Talepleri getir’e basın."
            >
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadRequests();
                }}
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  <KkdField label="Personel kartı / QR">
                    <OpsQrCaptureField
                      autoFocus
                      value={employeeQr}
                      onChange={onQrChange}
                      onCommit={(code) => loadRequests(code)}
                      disabled={resolveEmployee.isPending}
                      invalid={Boolean(fieldErrors.qr)}
                      placeholder="Kartı okutun veya kodu yazın"
                    />
                  </KkdField>
                  <KkdEmployeeLookupField
                    value={pickedEmployeeId}
                    employees={employees.data}
                    onChange={pickEmployee}
                    disabled={resolveEmployee.isPending}
                    invalid={Boolean(fieldErrors.employee)}
                  />
                </div>
                <div className="flex justify-stretch sm:justify-end">
                  <OpsActionButton
                    type="submit"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    loading={requestsBusy}
                    loadingLabel={<>Aranıyor…</>}
                  >
                    <ScanLine className="size-3.5 shrink-0" />
                    Talepleri getir
                  </OpsActionButton>
                </div>
              </form>

              {activeEmployeeNumber > 0 && selectContext.isLoading ? (
                <div className="mt-3">
                  <OpsLoadingState code="CTX" message="Personel carisi ve açık talepler okunuyor…" compact />
                </div>
              ) : null}

              {activeEmployeeNumber > 0 && selectContext.data ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <KkdMetric
                    tone="person"
                    icon={<UserRound className="size-4" strokeWidth={1.75} />}
                    label="Personel"
                    value={`${selectContext.data.employeeCode} · ${selectContext.data.employeeName}`}
                  />
                  <KkdMetric
                    tone="customer"
                    icon={<Building2 className="size-4" strokeWidth={1.75} />}
                    label="Netsis carisi"
                    value={`${selectContext.data.customerCode} · ${selectContext.data.customerName}`}
                  />
                  <KkdMetric
                    tone="orders"
                    icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
                    label="Açık talep"
                    value={`${selectContext.data.orders.length} sipariş`}
                  />
                </div>
              ) : null}
            </KkdPanel>
          ) : null}

          {enabled && activeEmployeeNumber > 0 && selectContext.isError ? (
            <KkdCallout
              tone="danger"
              icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
              title="Malzeme talepleri okunamadı"
            >
              {contextErrorMessage(selectContext.error)}
            </KkdCallout>
          ) : null}

          {activeEmployeeNumber > 0 && selectContext.data ? (
            <KkdPanel
              code="ORD_02"
              icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
              title="Açık siparişler"
              description="Sipariş seçilince kalemler aşağıda açılır. Seçilenlerle devam et ile teslim adımına geçilir."
            >
              {selectContext.data.orders.length === 0 ? (
                <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
                  Bu personelin bağlı olduğu cari için açık Netsis siparişi bulunamadı.
                </KkdCallout>
              ) : (
                <>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {selectContext.data.orders.map((order) => {
                      const isSelected = selectedOrders.includes(order.orderNumber);
                      return (
                        <KkdSelectableCard
                          key={order.orderNumber}
                          selected={isSelected}
                          onToggle={() => toggleOrder(order.orderNumber)}
                          control={
                            <OpsSkinCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOrder(order.orderNumber)}
                              aria-label={order.orderNumber}
                            />
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
                            {order.projectCode || 'Projesiz'} ·{' '}
                            {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : 'Tarih yok'}
                          </span>
                        </KkdSelectableCard>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-[color-mix(in_oklab,var(--wms-ops-card-border)_80%,transparent)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--wms-app-text-muted)]">
                      {sortedSelectedOrders.length === 0
                        ? 'Henüz sipariş seçilmedi.'
                        : `${sortedSelectedOrders.length} sipariş seçildi — sonraki adım: dağıtım görevi.`}
                    </p>
                    <OpsActionButton
                      type="button"
                      variant="primary"
                      className="w-full sm:w-auto sm:ml-auto"
                      disabled={sortedSelectedOrders.length === 0}
                      onClick={prepareDistribution}
                    >
                      Seçilenlerle devam et
                      <ArrowRight className="size-3.5 shrink-0" />
                    </OpsActionButton>
                  </div>
                </>
              )}
            </KkdPanel>
          ) : null}

          {sortedSelectedOrders.length > 0 ? (
            <KkdPanel
              code="LIN_03"
              icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
              title="Talep kalemleri"
              description="Kalan miktarlar Netsis satır bakiyesinden anlık okunur. WMS stoğuyla eşleşmeyen satırlar dağıtıma alınmaz."
              bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
            >
              <KkdTableShell minWidthClass="min-w-[1000px]" className="border-x-0 border-b-0">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {previewLineColumns.map((column) => (
                      <th key={column} className={KKD_HEAD_CELL}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewLines.isLoading ? (
                    <tr>
                      <td colSpan={previewLineColumns.length} className="wms-ops-grid-state-cell">
                        <OpsLoadingState code="FETCH" message="Talep kalemleri okunuyor…" compact />
                      </td>
                    </tr>
                  ) : (previewLines.data?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={previewLineColumns.length} className="wms-ops-grid-state-cell">
                        <OpsGridEmptyState message="Seçilen siparişlerde açık kalem bulunamadı." />
                      </td>
                    </tr>
                  ) : (
                    previewLines.data?.map((line) => (
                      <tr key={`${line.orderNumber}|${line.orderLineId}`}>
                        <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                          {line.orderNumber} / {line.orderLineSequence}
                        </td>
                        <td className={KKD_CELL}>
                          <strong className="block">{line.stockCode}</strong>
                          <span className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                        </td>
                        <td className={KKD_CELL}>{line.projectCode || '—'}</td>
                        <td className={cn(KKD_CELL, 'whitespace-nowrap')}>
                          {line.orderDate ? new Date(line.orderDate).toLocaleDateString('tr-TR') : '—'}
                        </td>
                        <td className={cn(KKD_CELL, 'whitespace-nowrap')}>
                          {line.deliveryDate ? new Date(line.deliveryDate).toLocaleDateString('tr-TR') : '—'}
                        </td>
                        <td className={cn(KKD_CELL, 'text-right font-bold')}>
                          {line.remainingQuantity} {line.unitCode}
                        </td>
                        <td className={KKD_CELL}>
                          {line.isMapped ? (
                            <OpsStatusBadge tone="done">Dağıtıma uygun</OpsStatusBadge>
                          ) : (
                            <span className="inline-flex items-start gap-2 text-rose-500">
                              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                              <span className="text-xs">{line.mappingMessage || 'WMS stok eşlemesi eksik.'}</span>
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
        </>
      ) : null}

      {/* ——— DISTRIBUTE STEP ——— */}
      {isDistributeStep && !result ? (
        <>
          <KkdCallout
            tone="info"
            icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
            title={requestMode ? 'Açık KKD talebinden devam' : 'Malzeme talebinden devam'}
          >
            {requestMode ? (
              <>
                Personel ve talep bu adımda kilitli. Değiştirmek için <strong>Açık taleplere dön</strong> ile kuyruğa
                gidin; burada kalem, depo ve teslim bilgileri girilir.
              </>
            ) : (
              <>
                Personel ve sipariş seçimi bu adımda kilitli. Değiştirmek için{' '}
                <strong>Sipariş seçimine dön</strong> ile önceki adıma gidin; burada kalem, depo ve teslim bilgileri
                girilir.
              </>
            )}
          </KkdCallout>

          <KkdPanel
            code="EMP_01"
            icon={<UserRound className="size-4" strokeWidth={1.75} />}
            title="Seçilen personel"
            description={
              requestMode
                ? 'Açık KKD talebinden taşındı; bu adımda değiştirilemez.'
                : 'Talep listesinden taşındı; bu adımda değiştirilemez.'
            }
            actions={isLocked ? <OpsStatusBadge tone="active">Kilitli</OpsStatusBadge> : undefined}
          >
            {context.isLoading ? (
              <OpsLoadingState code="CTX" message="Personel carisi ve açık siparişler okunuyor…" compact />
            ) : null}

            {context.data ? (
              <div className="grid gap-3 sm:grid-cols-3">
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
                  label={requestMode ? 'Talep' : 'Seçili sipariş'}
                  value={requestMode ? linkedRequest.data?.requestNo || '—' : `${orders.length} sipariş`}
                  hint={`Şube ${context.data.branchCode}`}
                />
              </div>
            ) : null}
          </KkdPanel>

          {context.data ? (
            <KkdCallout
              tone="info"
              icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
              title="Etkin KKD süreç politikası"
            >
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

          {context.data && !requestMode ? (
            <KkdPanel
              code="ORD_02"
              icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
              title="Taşınan siparişler"
              description="Önceki adımdan gelen seçim. Değiştirmek için sipariş seçimine dönün."
              actions={
                <OpsStatusBadge tone="active">{orders.length} kilitli</OpsStatusBadge>
              }
            >
              {context.data.orders.length === 0 ? (
                <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
                  {context.data.policy.requireOpenOrder
                    ? 'Bu personele bağlı cari için açık Netsis siparişi bulunmadığından dağıtım başlatılamaz.'
                    : 'Bu personele bağlı cari için açık Netsis siparişi bulunamadı.'}
                </KkdCallout>
              ) : handedOffOrders.length === 0 ? (
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
              )}
            </KkdPanel>
          ) : null}

          {sortedOrders.length > 0 || requestMode ? (
            <KkdPanel
              code="LIN_03"
              icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
              title={requestMode ? 'KKD talep kalemleri' : 'Sipariş kalemleri'}
              description={
                requestMode
                  ? 'Grup için kesin stok/beden seçilmemiş satırlar hazırlamaya alınamaz.'
                  : 'WMS stoğuyla eşleşmeyen satırlar dağıtıma alınamaz.'
              }
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
                  {(requestMode ? linkedRequest.isLoading : orderLines.isLoading) ? (
                    <tr>
                      <td colSpan={lineColumns.length + 1} className="wms-ops-grid-state-cell">
                        <OpsLoadingState code="FETCH" message="Sipariş kalemleri okunuyor…" compact />
                      </td>
                    </tr>
                  ) : effectiveLines.length === 0 ? (
                    <tr>
                      <td colSpan={lineColumns.length + 1} className="wms-ops-grid-state-cell">
                        <OpsGridEmptyState message="Seçilen siparişlerde açık kalem bulunamadı." />
                      </td>
                    </tr>
                  ) : (
                    effectiveLines.map((line) => (
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
              <div className="wms-ops-kkd-header-fields wms-ops-kkd-header-fields--with-assignees">
                <KkdField
                  label="Kaynak depo"
                  className="w-full"
                  hint={warehouseAccess.data?.isRestricted ? 'Sadece yetkili olduğunuz depolar listelenir.' : undefined}
                >
                  <div className="wms-ops-field-shell w-full min-w-0">
                    <PagedAppDropdown<WarehouseOption>
                      queryKey={['kkd-warehouses', context.data?.branchCode, warehouseAccess.data?.isRestricted]}
                      fetchPage={async (request) => {
                        const page = await warehouseOutboundApi.warehouses(request, context.data?.branchCode || '0');
                        const access = warehouseAccess.data;
                        if (!access?.isRestricted) return page;
                        const allowed = new Set(access.warehouseIds);
                        const items = page.items.filter((item) => allowed.has(item.id));
                        return { ...page, items, totalCount: items.length };
                      }}
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
                  <div className="wms-ops-field-shell w-full min-w-0">
                    <OpsSelect
                      value={seriesId}
                      onValueChange={setSeriesId}
                      options={seriesOptions}
                      placeholder="Seri seçin"
                      searchable
                      className="w-full"
                    />
                  </div>
                </KkdField>
                <KkdField label="Belge tarihi" className="w-full">
                  <div className="wms-ops-field-shell w-full min-w-0">
                    <AppDateInput
                      className="w-full"
                      value={documentDate}
                      onChange={(event) => setDocumentDate(event.target.value)}
                    />
                  </div>
                </KkdField>
                <KkdField
                  className="w-full"
                  label={
                    <span className="inline-flex max-w-full items-center gap-1">
                      <UsersRound className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="truncate">İşlemi yapan</span>
                      <TooltipProvider delayDuration={160}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex shrink-0 text-[var(--wms-ops-accent)]"
                              aria-label="İşlemi yapan kişi açıklaması"
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
                            Bu teslimi fiilen kimin yaptığını gösterir. Varsayılan olarak oturum açan kullanıcı
                            seçilidir; işlemi başka biri yapıyorsa kaldırıp ilgili kişiyi ekleyin.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  }
                >
                  <div className="wms-ops-field-shell w-full min-w-0">
                    <PagedAppDropdown<ActiveUserOption>
                      queryKey={['kkd-distribution-operators']}
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
                      placeholder="İşlemi yapan kişiyi değiştir / ekle"
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
                            aria-label={`${user.username} kişisini kaldır`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </KkdField>
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
                  const effStockId = effectiveStockId(line, edit);
                  const linePolicy = effStockId ? trackingPolicies[effStockId] : undefined;
                  const linePolicyLoading = effStockId ? Boolean(trackingPolicyLoading[effStockId]) : false;
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
                      {!requestMode ? (
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
                      ) : null}
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
                            className={cn(
                              'wms-ops-entry-label',
                              linePolicy?.requireLot && 'text-amber-600 dark:text-amber-400',
                            )}
                            title={
                              linePolicy?.requireLot
                                ? 'Bu stok lot takiplidir; lot numarası zorunludur.'
                                : 'Lot takipli stokta doldurun; değilse boş bırakın'
                            }
                          >
                            Lot{linePolicy?.requireLot ? ' *' : ''}
                          </span>
                          <AppInput
                            value={edit.lotNo}
                            placeholder={
                              linePolicyLoading ? 'Politika yükleniyor…' : linePolicy?.requireLot ? 'Zorunlu' : 'Opsiyonel'
                            }
                            onChange={(event) => patch(line, { lotNo: event.target.value })}
                          />
                        </div>
                        <div className="wms-ops-kkd-delivery-row__field">
                          <span
                            className={cn(
                              'wms-ops-entry-label',
                              linePolicy?.requireSerial && 'text-amber-600 dark:text-amber-400',
                            )}
                            title={
                              linePolicy?.requireSerial
                                ? 'Bu stok seri takiplidir; seri numarası zorunludur.'
                                : 'Seri takipli stokta elle yazın veya barkod okutun; virgülle ayırın, adet kadar olmalı'
                            }
                          >
                            Seriler{linePolicy?.requireSerial ? ' *' : ''}
                          </span>
                          <AppInput
                            className="font-mono"
                            value={edit.serials}
                            placeholder={
                              linePolicyLoading
                                ? 'Politika yükleniyor…'
                                : linePolicy?.requireSerial
                                  ? 'Zorunlu · virgülle'
                                  : 'Opsiyonel · virgülle'
                            }
                            onChange={(event) => patch(line, { serials: event.target.value })}
                          />
                        </div>
                      </div>
                      <StockTrackingPolicyField policy={linePolicy} loading={linePolicyLoading} compact />
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
                      Teslim ediliyor…
                    </>
                  }
                  onClick={() => create.mutate()}
                >
                  <PackageCheck className="size-3.5 shrink-0" />
                  Teslimi tamamla ve ambar çıkışını başlat
                </OpsActionButton>
              </div>
            </KkdPanel>
          ) : null}
        </>
      ) : null}

      <KkdDistributionReceiptDialog
        open={receiptOpen && Boolean(receiptDetail.data)}
        onOpenChange={setReceiptOpen}
        detail={receiptDetail.data ?? null}
      />
    </KkdPage>
  );
}

/** Kota aşımı olmadan tamamlanan dağıtımlar için Mal Kabul akışındaki başarı ekranıyla aynı sade görünüm. */
/**
 * Teslim/dağıtım sonucu için tam sayfa sonuç sahnesi (Mal Kabul'daki "İrsaliye oluştu" ekranıyla
 * aynı görsel dil). Form burada gösterilmez — kota aşımı yoksa yeşil, aşım varsa (müdür onayı
 * bekleniyorsa) sarı tonda tek bir bilgilendirici sahne render edilir.
 */
function KkdDeliveryResultScene({
  result,
  submittedQuotaWarnings,
  canManageOverrides,
  onPrintReceipt,
  onNewDelivery,
}: {
  result: KkdDistributionCreateResult;
  submittedQuotaWarnings: KkdQuotaWarningItem[];
  canManageOverrides: boolean;
  onPrintReceipt: () => void;
  onNewDelivery: () => void;
}): ReactElement {
  const pending = isExcessApprovalPending(result.excessApprovalStatus) || result.excessQuantity > 0;

  return (
    <div className={cn('wms-ops-gr-success', pending ? 'wms-ops-gr-success--quality' : 'wms-ops-gr-success--done')}>
      <div className="wms-ops-gr-success__glow" aria-hidden />
      <header className="wms-ops-gr-success__header">
        <div className="wms-ops-gr-success__icon" aria-hidden>
          {pending ? <ShieldAlert className="size-9" /> : <CheckCircle2 className="size-9" />}
        </div>
        <p className="wms-ops-gr-success__eyebrow">KKD · Malzeme teslim</p>
        <h2 className="wms-ops-gr-success__title">
          {pending ? 'Müdür onayına gönderildi' : 'Dağıtım oluşturuldu'}
        </h2>
        <p className="wms-ops-gr-success__subtitle">
          {pending
            ? submittedQuotaWarnings.length > 0
              ? `Aşağıdaki ürün${submittedQuotaWarnings.length > 1 ? 'lerde' : 'de'} kota aşımı bulunduğundan bu teslim toplu şekilde depo müdürü onayına gönderildi.`
              : 'Talep edilen üründe kota aşımı bulunduğundan depo müdürü onayına gönderildi.'
            : 'Kota aşımı yok, müdür onayına gerek kalmadı. Ambar çıkışını tamamlayınca teslim belgesi düzenlenebilir.'}
        </p>
        <div className="wms-ops-gr-success__doc">
          <span className="wms-ops-gr-success__doc-label">Belge no</span>
          <span className="wms-ops-gr-success__doc-row">
            <strong className="wms-ops-gr-success__doc-value">{result.documentNo}</strong>
          </span>
        </div>
      </header>

      <div className="wms-ops-gr-success__stats">
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">Toplam</span>
          <strong className="wms-ops-gr-success__stat-value">{result.totalQuantity}</strong>
        </div>
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">Hak</span>
          <strong className="wms-ops-gr-success__stat-value">{result.entitledQuantity}</strong>
        </div>
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">{pending ? 'Aşım' : 'Durum'}</span>
          <strong className="wms-ops-gr-success__stat-value wms-ops-gr-success__stat-value--status">
            {pending ? result.excessQuantity : 'Çıkışa hazır'}
          </strong>
        </div>
      </div>

      {pending ? (
        <div className="wms-ops-gr-success__quality">
          <div className="wms-ops-gr-success__quality-copy">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            <div>
              <strong>{KKD_QUOTA_FULL_MESSAGE}</strong>
              {submittedQuotaWarnings.length > 0 ? (
                <span>
                  {submittedQuotaWarnings.map((item) => (
                    <span key={item.key} className="block">
                      {item.stockCode} · {item.stockName} — talep {item.quantity}, kalan hak{' '}
                      {Math.max(item.remaining, 0)}
                      {item.frequencyBlocked ? ` · ${KKD_QUOTA_FREQUENCY_HINT}` : ''}
                      {item.nextEligibleDate
                        ? ` (sonraki hak: ${new Date(item.nextEligibleDate).toLocaleDateString('tr-TR')})`
                        : ''}
                    </span>
                  ))}
                </span>
              ) : null}
              <span>
                Malzeme henüz personele teslim edilmedi; ambar çıkışı bu karara kadar kilitli.{' '}
                {canManageOverrides
                  ? 'Onay/red kararını aşağıdaki Müdür onayına git ekranından verebilirsiniz.'
                  : 'Depo müdürünüz karar verdikten sonra teslim belgesi ve ambar çıkışı açılır.'}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="wms-ops-gr-success__actions">
        {pending ? (
          <>
            {canManageOverrides ? (
              <OpsActionButton type="button" variant="primary" asChild>
                <Link to="/warehouse/kkd/distributions">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  Müdür onayına git
                </Link>
              </OpsActionButton>
            ) : null}
            <OpsActionButton
              type="button"
              variant="secondary"
              className={canManageOverrides ? undefined : 'col-span-2'}
              onClick={onNewDelivery}
            >
              <ArrowRight className="size-3.5 shrink-0" />
              Yeni teslim başlat
            </OpsActionButton>
          </>
        ) : (
          <>
            <OpsActionButton type="button" variant="primary" asChild>
              <Link to={`/warehouse/warehouse-outbounds/${result.warehouseOutboundId}/operations`}>
                <PackageCheck className="size-3.5 shrink-0" />
                Ambar çıkış operasyonunu aç
              </Link>
            </OpsActionButton>
            <OpsActionButton type="button" variant="secondary" onClick={onPrintReceipt}>
              <Printer className="size-3.5 shrink-0" />
              Teslim belgesi
            </OpsActionButton>
            <OpsActionButton type="button" variant="secondary" className="col-span-2" onClick={onNewDelivery}>
              <ArrowRight className="size-3.5 shrink-0" />
              Yeni teslim başlat
            </OpsActionButton>
          </>
        )}
      </footer>
    </div>
  );
}
