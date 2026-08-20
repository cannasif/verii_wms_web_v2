import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, ArrowRightLeft, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Eye, Hand, PackageCheck, PlayCircle, Plus, RefreshCw, SearchCheck, Trash2, TriangleAlert, Undo2, UserPlus, UserRoundCog, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn, type GridRequest } from '@/components/shared/AdvancedDataGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsCodeBadge, OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type { ActiveUserOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { stockMovementsApi } from '@/features/stock-movements/api/stock-movements.api';
import { warehouseOutboundApi } from '@/features/warehouse-outbound/warehouseOutbound-api';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { formatProjectQuantity, isPieceUnit, maskProjectQuantityInput, nextQuantityCaret, parseLocalizedNumber } from '@/lib/project-format';
import type { PagedResponse } from '@/types/api';
import {
  kkdApi,
  type KkdEmployee,
  type KkdEntitlementGroupLookup,
  type KkdPreparationTaskRow,
  type KkdRequestBoardTab,
  type KkdRequestCreatePayload,
  type KkdRequestDetail,
  type KkdRequestLine,
  type KkdRequestRow,
  type KkdStockLookup,
} from './kkd-api';
import {
  KkdQuotaReviewPanel,
  QuotaDecisionBadge,
  QuotaLineActions,
} from './KkdQuotaReviewPanel';
import { lineQuotaBucket, useKkdQuotaDecide, useKkdQuotaExcess } from './kkd-quota-review';
import { KKD_CELL, KKD_HEAD_CELL, KkdField, KkdPanel, KkdTableShell } from './kkd-ops-ui';

/** Dialog içi dropdown'lar body'ye portal edilir; aksi halde overflow keser / arkada kalır. */
const DIALOG_DROPDOWN_CONTENT = 'z-[5000]';

const encodeUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string): ActiveUserOption => JSON.parse(decodeURIComponent(value)) as ActiveUserOption;

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

function toActiveUserOption(user: { id: number; email: string; name?: string }): ActiveUserOption {
  const [firstName = '', ...rest] = (user.name || user.email).trim().split(/\s+/);
  return { id: user.id, username: user.email, email: user.email, firstName, lastName: rest.join(' '), isActive: true };
}

type DraftLine = {
  key: string;
  groupCode: string;
  groupName: string;
  stockId: number | null;
  stockLabel: string;
  unitCode: string;
  quantity: string;
};

const newLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  groupCode: '',
  groupName: '',
  stockId: null,
  stockLabel: '',
  unitCode: '',
  quantity: '1',
});

function parseDraftQuantity(value: string): number {
  const qty = parseLocalizedNumber(value);
  return Number.isFinite(qty) ? qty : 0;
}

function commitDraftQuantity(value: string, unitCode?: string | null): string {
  const parsed = parseDraftQuantity(value);
  if (parsed <= 0) return value.trim();
  return formatProjectQuantity(parsed, unitCode || 'ADET');
}

const CLOSED = new Set(['Completed', 'Cancelled']);
const ACTIVE_TASK_STATUSES = new Set(['Assigned', 'InPreparation']);

/** Üretim iş emirleri sayfasındaki yaşam döngüsü sekmeleri; server-side filtrelenir. */
const PAGE_TABS = ['pending', 'preparing', 'completed', 'cancelled', 'mine'] as const;
/** Sekme şeridinde görünmez — sadece kota onayı yetkisi olanlara açık, ayrı bir buton ile girilir. */
const QUOTA_TAB = 'quotapending' as const;
type PageTab = (typeof PAGE_TABS)[number] | typeof QUOTA_TAB;
const isPageTab = (value: string | null): value is PageTab =>
  PAGE_TABS.includes(value as (typeof PAGE_TABS)[number]) || value === QUOTA_TAB;

/** "Talebi hazırla" (kalem bazlı atama) veya "Üzerime al" hedefi. */
type PrepTarget = {
  id: number;
  requestNo: string;
  warehouseId?: number | null;
  rowVersion?: string | null;
};

/** `prepare()` çağrısının gerçekte kullandığı alanlar — hem grid satırı hem talep detayı bunu karşılar. */
type PrepareRow = {
  id: number;
  employeeId: number;
  myActiveTaskId?: number | null;
  hasPoolTask?: boolean;
  poolTaskId?: number | null;
};

export function KkdRequestsPage(): ReactElement {
  const { t, i18n } = useModuleTranslation('kkd');
  const { can } = usePermissionAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const currentUserOption = useMemo(() => (authUser ? toActiveUserOption(authUser) : null), [authUser]);
  const canResolve = can('WMS.KKD.REQUESTS.RESOLVE');
  const canAssign = can('WMS.KKD.REQUESTS.ASSIGN');
  const canPrepare = can('WMS.KKD.DISTRIBUTION.OPERATE');
  const canCancel = can('WMS.KKD.REQUESTS.CANCEL');
  /** Kota onayı bekleyenler sekmesi ve Ata diyaloğundaki gerçek onay/red — ek hak tanımlama yetkisiyle aynı. */
  const canManageQuota = can('WMS.KKD.OVERRIDES.MANAGE');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageTab>(() => {
    const tab = searchParams.get('tab');
    return isPageTab(tab) ? tab : 'pending';
  });
  const [revision, setRevision] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveRequestId, setResolveRequestId] = useState<number | null>(null);
  const [resolveLine, setResolveLine] = useState<KkdRequestLine | null>(null);
  const [resolveStock, setResolveStock] = useState<{ id: number; label: string } | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<{ id: number; requestNo: string; rowVersion?: string | null } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [priority, setPriority] = useState<KkdRequestCreatePayload['priority']>('Normal');
  const [neededAt, setNeededAt] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [prepTarget, setPrepTarget] = useState<PrepTarget | null>(null);
  const [claimTarget, setClaimTarget] = useState<PrepTarget | null>(null);
  const [claimWarehouseId, setClaimWarehouseId] = useState('');
  const [handoffTask, setHandoffTask] = useState<KkdPreparationTaskRow | null>(null);
  const [handoffUser, setHandoffUser] = useState<ActiveUserOption | null>(null);
  const [handoffReason, setHandoffReason] = useState('');
  const [expandedQuotaId, setExpandedQuotaId] = useState<number | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isPageTab(tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== QUOTA_TAB) setExpandedQuotaId(null);
  }, [activeTab]);

  const goToTab = useCallback((tab: PageTab) => {
    setActiveTab(tab);
    setSearchParams((params) => { params.set('tab', tab); return params; }, { replace: true });
  }, [setSearchParams]);

  const toggleQuotaExpand = useCallback((rowId: number) => {
    setExpandedQuotaId((current) => (current === rowId ? null : rowId));
  }, []);

  const tabCounts = useQuery({
    queryKey: ['kkd', 'requests', 'tab-counts', revision],
    queryFn: kkdApi.requestTabCounts,
    refetchInterval: 60_000,
  });
  const fetchPage = useCallback(
    (request: GridRequest) => kkdApi.requestsPaged(request, activeTab as KkdRequestBoardTab),
    [activeTab],
  );

  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const warehouses = useQuery({ queryKey: ['kkd', 'requests', 'warehouses'], queryFn: stockMovementsApi.getWarehouses, staleTime: 5 * 60 * 1000 });
  const warehouseAccess = useQuery({ queryKey: ['kkd', 'requests', 'warehouse-access'], queryFn: goodsReceiptV2Api.warehouseAccess, staleTime: 5 * 60 * 1000 });
  const detail = useQuery({
    queryKey: ['kkd', 'requests', detailId],
    queryFn: () => kkdApi.requestDetail(detailId!),
    enabled: Boolean(detailId),
  });
  const detailTasks = useQuery({
    queryKey: ['kkd', 'requests', detailId, 'preparation-tasks'],
    queryFn: () => kkdApi.requestPreparationTasks(detailId!),
    enabled: Boolean(detailId),
  });
  const detailPrepareTarget = useMemo(() => {
    const tasks = (detailTasks.data ?? []).filter((task) => ACTIVE_TASK_STATUSES.has(task.status));
    const currentUserId = currentUserOption?.id ?? null;
    const myTask = currentUserId != null
      ? tasks.find((task) => task.assignedUserId === currentUserId)
      : undefined;
    return {
      /** Sadece üzerime atanmış / aldığım aktif görevde toplama. Havuz henüz alınmamışsa görünmez. */
      prepareTaskId: myTask?.id ?? null,
    };
  }, [currentUserOption?.id, detailTasks.data]);

  const warehouseLabel = useCallback((id?: number | null): string => {
    if (!id) return t('grid.warehouseUnset');
    const match = warehouses.data?.find((item) => item.id === id);
    return match ? `${match.warehouseCode} · ${match.warehouseName}` : `#${id}`;
  }, [t, warehouses.data]);
  const warehouseOptions = useMemo(() => {
    // warehouse-access (mal kabul ucu) yüklenemezse tüm depoları göster — ata butonu kilitlenmesin.
    const allowed = warehouseAccess.data?.isRestricted ? new Set(warehouseAccess.data.warehouseIds) : null;
    return (warehouses.data ?? [])
      .filter((item) => !allowed || allowed.has(item.id))
      .sort((a, b) => a.warehouseCode - b.warehouseCode)
      .map((item) => ({ value: String(item.id), label: `${item.warehouseCode} · ${item.warehouseName}` }));
  }, [warehouseAccess.data, warehouses.data]);
  const warehouseFilterOptions = useMemo(() => (warehouses.data ?? [])
    .sort((a, b) => a.warehouseCode - b.warehouseCode)
    .map((item) => ({ value: String(item.id), label: `${item.warehouseCode} · ${item.warehouseName}` })), [warehouses.data]);
  /**
   * Başkasına / havuza atama ve görev devri ASSIGN iznidir; claim RESOLVE ile kalır.
   * warehouse-access mal kabul yetkisi/şube header yüzünden düşse bile ata kaybolmasın —
   * sadece açıkça isRestricted=true ise gizlenir.
   */
  const canAssignToOthers = canAssign && warehouseAccess.data?.isRestricted !== true;
  const canClaimSelf = canResolve;
  const openPrepare = useCallback((target: PrepTarget) => setPrepTarget(target), []);

  const formatDateTime = useCallback((value?: string | null): string => value
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—', [i18n.language]);
  const formatQuantity = useCallback((value: number): string =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(value), [i18n.language]);
  const enumText = useCallback((scope: string, value: string): string =>
    t(`${scope}.${value}`, { defaultValue: value }), [t]);
  /**
   * Bilinen bir hazırlama görevi varsa doğrudan barkodlu toplama sayfasına götürür (görev
   * zaten hangi stoğun ne kadar toplanacağını biliyor, kullanıcı hiçbir şey seçmez).
   * Görev bilinmiyorsa (ör. siparişsiz/ad-hoc senaryo) eski manuel dağıtım formuna düşer.
   */
  const navigatePrepare = useCallback((row: { id: number; employeeId: number }, taskId?: number | null): void => {
    if (taskId) {
      try {
        sessionStorage.setItem('kkd-requests-return-tab', activeTab);
      } catch {
        /* private mode / quota — URL query yeterli */
      }
      const params = new URLSearchParams({ returnTab: activeTab });
      navigate(`/warehouse/kkd/requests/${row.id}/preparation-tasks/${taskId}/pick?${params.toString()}`);
      return;
    }
    const params = new URLSearchParams({ employeeId: String(row.employeeId), requestId: String(row.id), taskMode: '1' });
    navigate(`/warehouse/kkd/distributions/new?${params.toString()}`);
  }, [activeTab, navigate]);

  const invalidateBoard = useCallback(() => {
    setRevision((item) => item + 1);
    void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests'] });
  }, [queryClient]);

  const claim = useMutation({
    mutationFn: async (payload: { id: number; warehouseId: number; expectedRowVersion?: string | null }) =>
      kkdApi.claimRequest(payload.id, {
        warehouseId: payload.warehouseId,
        expectedRowVersion: payload.expectedRowVersion ?? null,
      }),
    onSuccess: () => {
      setClaimTarget(null); setClaimWarehouseId(''); invalidateBoard();
      toast.success(t('messages.claimed'));
      goToTab('mine');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const claimSelf = useCallback((row: PrepTarget) => {
    const warehouseId = row.warehouseId
      ?? (warehouseOptions.length === 1 ? Number(warehouseOptions[0].value) : null);
    if (!warehouseId) {
      setClaimTarget(row);
      setClaimWarehouseId(warehouseOptions[0]?.value ?? '');
      return;
    }
    claim.mutate({ id: row.id, warehouseId, expectedRowVersion: row.rowVersion ?? null });
  }, [claim, warehouseOptions]);

  /** Depo havuzuna bırakılmış (kişiye atanmamış) bir görevi aktörün üzerine alması. */
  const claimPool = useMutation({
    mutationFn: async (payload: { taskId: number; expectedRowVersion?: string | null }) =>
      kkdApi.claimPreparationTask(payload.taskId, { expectedRowVersion: payload.expectedRowVersion ?? null }),
    onSuccess: () => {
      invalidateBoard();
      toast.success(t('messages.claimedPool'));
      goToTab('mine');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  /**
   * Hazırlamaya giderken: havuz göreviyse önce üzerine al (otomatik sahiplen), sonra tezgahı aç.
   * Zaten kişiye atanmış görevde doğrudan tezgaha gider — bekleyen claim akışını bozmaz.
   * Detay diyaloğundan çağrıldığında (KkdRequestDetail) havuz/görev bilgisi bulunmaz; bu durumda
   * hedef görev bilinmiyor sayılır ve tezgah otomatik-sahiplenme yapmadan açılır.
   */
  const prepare = useCallback((row: PrepareRow, taskId?: number | null): void => {
    const targetTaskId = taskId ?? row.myActiveTaskId ?? (row.hasPoolTask ? row.poolTaskId : null);
    const needsPoolClaim = Boolean(
      targetTaskId
      && row.hasPoolTask
      && row.poolTaskId === targetTaskId
      && !row.myActiveTaskId,
    );
    if (needsPoolClaim && targetTaskId) {
      void kkdApi.claimPreparationTask(targetTaskId, { expectedRowVersion: null })
        .then((task) => {
          invalidateBoard();
          toast.success(t('messages.claimedPool'));
          navigatePrepare(row, task.id);
        })
        .catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : t('messages.failed'));
        });
      return;
    }
    navigatePrepare(row, targetTaskId);
  }, [invalidateBoard, navigatePrepare, t]);
  const handoff = useMutation({
    mutationFn: async () => {
      if (!handoffTask || !handoffUser) throw new Error(t('validation.user'));
      if (handoffReason.trim().length < 3) throw new Error(t('validation.reason'));
      return kkdApi.handoffPreparationTask(handoffTask.id, {
        toUserId: handoffUser.id, reason: handoffReason.trim(), expectedRowVersion: handoffTask.rowVersion,
      });
    },
    onSuccess: () => {
      setHandoffTask(null); setHandoffUser(null); setHandoffReason(''); invalidateBoard();
      toast.success(t('messages.handedOver'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  /** Grid işlemlerinden devret için üzerimdeki aktif görevi yükler. */
  const loadMyActiveTask = useCallback(async (row: KkdRequestRow): Promise<KkdPreparationTaskRow | null> => {
    const taskId = row.myActiveTaskId;
    if (!taskId) return null;
    const tasks = await kkdApi.requestPreparationTasks(row.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !ACTIVE_TASK_STATUSES.has(task.status) || task.assignedUserId == null) return null;
    return task;
  }, []);

  const openHandoffFromRow = useCallback(async (row: KkdRequestRow) => {
    try {
      const task = await loadMyActiveTask(row);
      if (!task) {
        toast.error(t('messages.taskNotFound'));
        return;
      }
      setHandoffUser(null);
      setHandoffReason('');
      setHandoffTask(task);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('messages.failed'));
    }
  }, [loadMyActiveTask, t]);

  const erpRetry = useMutation({
    mutationFn: async (distributionId: number) => kkdApi.complete(distributionId),
    onSuccess: () => { invalidateBoard(); toast.success(t('messages.erpRetried')); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const reactivateRequest = useMutation({
    mutationFn: async ({ id, rowVersion }: { id: number; rowVersion: string }) => kkdApi.reactivateRequest(id, rowVersion),
    onSuccess: () => { invalidateBoard(); toast.success(t('messages.reactivated')); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const cancelPrecheck = useQuery({
    queryKey: ['kkd', 'requests', cancelTarget?.id, 'cancel-precheck'],
    queryFn: () => kkdApi.requestCancelPrecheck(cancelTarget!.id),
    enabled: Boolean(cancelTarget),
  });

  const columns = useMemo<GridColumn<KkdRequestRow>[]>(() => [
    {
      key: 'id', label: t('grid.id'), width: activeTab === QUOTA_TAB ? 118 : 88, filterType: 'number', sortable: true,
      render: (row) => {
        const open = expandedQuotaId === row.id;
        return (
          <span className="inline-flex items-center gap-2">
            {row.myActiveTaskStarted ? <PlayCircle className="size-3.5 shrink-0 text-sky-500" aria-label={t('grid.taskInProgress')} /> : null}
            <span>{row.id}</span>
            {activeTab === QUOTA_TAB ? (
              <button
                type="button"
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-md border transition',
                  'border-[color-mix(in_oklab,var(--wms-brand-primary)_40%,var(--wms-app-border))]',
                  'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]',
                  'hover:border-[var(--wms-brand-primary)] hover:bg-[var(--wms-brand-primary)] hover:text-white',
                  open && 'bg-[var(--wms-brand-primary)] text-white',
                )}
                title={open ? t('actions.collapse') : t('actions.expand')}
                aria-label={open ? t('actions.collapse') : t('actions.expand')}
                aria-expanded={open}
                onClick={(event) => { event.stopPropagation(); toggleQuotaExpand(row.id); }}
              >
                {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            ) : null}
          </span>
        );
      },
    },
    { key: 'requestNo', label: t('grid.requestNo'), width: 190, render: (row) => <strong>{row.requestNo}</strong>, searchable: true, defaultSearch: true, sortable: true },
    { key: 'status', label: t('grid.status'), width: 165, render: (row) => <Status value={row.status} text={enumText('status', row.status)}/>, filterType: 'enum', sortable: true },
    { key: 'priority', label: t('grid.priority'), width: 125, render: (row) => enumText('priority', row.priority), filterType: 'enum', sortable: true },
    { key: 'employeeCode', label: t('grid.employeeCode'), width: 145, render: (row) => row.employeeCode, searchable: true, defaultSearch: true, sortable: true },
    { key: 'employeeName', label: t('grid.employeeName'), width: 210, render: (row) => row.employeeName, searchable: true, defaultSearch: true, sortable: true },
    { key: 'departmentName', label: t('grid.department'), width: 165, render: (row) => row.departmentName, searchable: false, sortable: true },
    { key: 'warehouseId', label: t('grid.warehouse'), width: 175, render: (row) => warehouseLabel(row.warehouseId), filterType: 'enum', filterOptions: warehouseFilterOptions, sortable: true },
    {
      key: 'assignedUserId', label: t('grid.assignedUser'), width: 200, filterable: false, searchable: false,
      render: (row) => {
        // Yalnızca aktif hazırlama görevinden gelen atamalar gösterilir — talep üzerindeki eski/bağımsız
        // assignedUserId alanı görev oluşturmadan işaretlenmiş olabilir ve "toplama" aksiyonuyla tutarsız kalır.
        const names = row.activeAssigneeNames;
        if (names.length === 0 && !row.hasPoolTask) {
          return <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600">{t('grid.unassigned')}</span>;
        }
        return (
          <span className="flex max-w-full flex-wrap gap-1">
            {row.hasPoolTask ? (
              <span className="inline-flex items-center gap-1 max-w-full truncate rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-600">
                <Users className="size-3" aria-hidden />{t('assign.pool')}
              </span>
            ) : null}
            {names.slice(0, 2).map((name) => (
              <span key={name} title={name} className="inline-flex max-w-[9rem] truncate rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">{name}</span>
            ))}
            {names.length > 2 ? (
              <span title={names.slice(2).join(', ')} className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">+{names.length - 2}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'myActiveTaskStarted', label: t('grid.taskInProgress'), width: 150, filterable: false, searchable: false, sortable: true,
      render: (row) => (row.myActiveTaskStarted ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-600">
          <PlayCircle className="size-3" aria-hidden />{t('grid.taskInProgress')}
        </span>
      ) : <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>),
    },
    {
      key: 'myActiveTaskQuotaPendingCount', label: t('grid.quotaStatus'), width: 170, filterable: false, searchable: false, sortable: true,
      render: (row) => {
        const pendingOnThisTab = activeTab === QUOTA_TAB;
        if (pendingOnThisTab || (row.myActiveTaskQuotaPendingCount ?? 0) > 0) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600">
              <TriangleAlert className="size-3 shrink-0" aria-hidden />{t('grid.quotaPending')}
            </span>
          );
        }
        if ((row.myActiveTaskQuotaApprovedCount ?? 0) > 0) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3 shrink-0" aria-hidden />{t('grid.quotaApproved')}
            </span>
          );
        }
        return <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>;
      },
    },
    {
      key: 'erpStatus', label: t('grid.erp'), width: 130, filterable: false, searchable: false, sortable: false,
      render: (row) => {
        if (!row.linkedDistributionId || !row.linkedDistributionStatus) return <span className="text-xs text-[var(--wms-app-text-muted)]">—</span>;
        const status = row.linkedDistributionStatus;
        const tone = status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600'
          : status === 'Failed' ? 'bg-rose-500/10 text-rose-600'
          : status === 'Cancelled' ? 'bg-rose-500/10 text-rose-600'
          : 'bg-cyan-500/10 text-cyan-600';
        return (
          <span
            className={cn('inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-semibold', tone)}
            title={row.linkedDistributionFailureReason ?? undefined}
          >
            {enumText('distributionStatus', status)}
          </span>
        );
      },
    },
    { key: 'totalLineCount', label: t('grid.lineCount'), width: 115, render: (row) => row.totalLineCount, filterType: 'number', sortable: true },
    { key: 'unresolvedLineCount', label: t('grid.unresolved'), width: 145, render: (row) => row.unresolvedLineCount > 0 ? <span className="font-semibold text-amber-600">{row.unresolvedLineCount}</span> : '0', filterType: 'number', sortable: true },
    { key: 'requestedQuantity', label: t('grid.requested'), width: 135, render: (row) => formatQuantity(row.requestedQuantity), filterType: 'number', sortable: true },
    { key: 'allocatedQuantity', label: t('grid.allocated'), width: 135, render: (row) => formatQuantity(row.allocatedQuantity), filterType: 'number', sortable: true },
    { key: 'deliveredQuantity', label: t('grid.delivered'), width: 135, render: (row) => formatQuantity(row.deliveredQuantity), filterType: 'number', sortable: true },
    { key: 'neededAtUtc', label: t('grid.neededAt'), width: 170, render: (row) => formatDateTime(row.neededAtUtc), filterType: 'datetime', sortable: true },
    { key: 'requestedAtUtc', label: t('grid.requestedAt'), width: 170, render: (row) => formatDateTime(row.requestedAtUtc), filterType: 'datetime', sortable: true },
    { key: 'createdBy', label: t('grid.createdBy'), width: 110, render: (row) => row.createdBy ?? '—', filterType: 'number', searchable: true, sortable: true },
    { key: 'createdDate', label: t('grid.createdDate'), width: 170, render: (row) => formatDateTime(row.createdDate), filterType: 'datetime', sortable: true },
    { key: 'updatedBy', label: t('grid.updatedBy'), width: 110, render: (row) => row.updatedBy ?? '—', filterType: 'number', searchable: true, sortable: true },
    { key: 'updatedDate', label: t('grid.updatedDate'), width: 170, render: (row) => formatDateTime(row.updatedDate), filterType: 'datetime', sortable: true },
    {
      key: 'actions', label: t('grid.actions'), width: 280, filterable: false, searchable: false,
      render: (row) => {
        const open = !CLOSED.has(row.status);
        const hasUnassigned = row.unassignedLineCount > 0;
        const canManageMyTask = canAssign && open && Boolean(row.myActiveTaskId);
        const quotaQueue = activeTab === QUOTA_TAB;
        return (
          <div className="wms-ops-row-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.detail')} aria-label={t('actions.detail')} onClick={() => setDetailId(row.id)}>
              <Eye className="size-3.5" />
            </button>
            {!quotaQueue && canAssignToOthers && open && hasUnassigned ? (
              <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.assign')} aria-label={t('actions.assign')} onClick={() => openPrepare(row)}>
                <UserRoundCog className="size-3.5" />
              </button>
            ) : null}
            {!quotaQueue && canClaimSelf && open && row.hasPoolTask && row.poolTaskId && !row.myActiveTaskId ? (
              <button
                type="button" className="wms-ops-grid-icon-btn" title={t('actions.claimPool')} aria-label={t('actions.claimPool')}
                disabled={claimPool.isPending}
                onClick={() => claimPool.mutate({ taskId: row.poolTaskId!, expectedRowVersion: null })}
              >
                <Users className="size-3.5" />
              </button>
            ) : null}
            {!quotaQueue && canClaimSelf && open && hasUnassigned && !row.hasPoolTask && !row.myActiveTaskId ? (
              <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.claim')} aria-label={t('actions.claim')} onClick={() => claimSelf(row)}>
                <Hand className="size-3.5" />
              </button>
            ) : null}
            {!quotaQueue && canPrepare && open && (row.myActiveTaskId || (row.hasPoolTask && row.poolTaskId)) ? (
              <button
                type="button"
                className="wms-ops-grid-icon-btn"
                title={row.myActiveTaskId && row.myActiveTaskStarted ? t('actions.continuePrepare') : t('actions.prepare')}
                aria-label={row.myActiveTaskId && row.myActiveTaskStarted ? t('actions.continuePrepare') : t('actions.prepare')}
                onClick={() => prepare(row, row.myActiveTaskId ?? row.poolTaskId)}
              >
                {row.myActiveTaskId && row.myActiveTaskStarted ? <PlayCircle className="size-3.5 text-sky-600" /> : <PackageCheck className="size-3.5" />}
              </button>
            ) : null}
            {!quotaQueue && canManageMyTask ? (
              <button
                type="button"
                className="wms-ops-grid-icon-btn"
                title={t('actions.handoff')}
                aria-label={t('actions.handoff')}
                onClick={() => void openHandoffFromRow(row)}
              >
                <ArrowRightLeft className="size-3.5" />
              </button>
            ) : null}
            {row.warehouseOutboundId ? (
              <Link
                to={`/warehouse/warehouse-outbounds/${row.warehouseOutboundId}/operations`}
                className="wms-ops-grid-icon-btn"
                title={t('actions.operation')}
                aria-label={t('actions.operation')}
              >
                <PlayCircle className="size-3.5" />
              </Link>
            ) : null}
            {canPrepare && row.linkedDistributionId && row.linkedDistributionStatus === 'Failed' ? (
              <button
                type="button"
                className="wms-ops-grid-icon-btn"
                title={t('actions.erpRetry')}
                aria-label={t('actions.erpRetry')}
                disabled={erpRetry.isPending}
                onClick={() => erpRetry.mutate(row.linkedDistributionId!)}
              >
                <RefreshCw className={cn('size-3.5', erpRetry.isPending && 'animate-spin')} />
              </button>
            ) : null}
            {!quotaQueue && canCancel && open ? (
              <button
                type="button"
                className="wms-ops-grid-icon-btn !text-rose-600"
                title={t('actions.cancel')}
                aria-label={t('actions.cancel')}
                onClick={() => { setCancelReason(''); setCancelTarget(row); }}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            {canCancel && row.status === 'Cancelled' ? (
              <button
                type="button"
                className="wms-ops-grid-icon-btn"
                title={t('actions.reactivate')}
                aria-label={t('actions.reactivate')}
                disabled={reactivateRequest.isPending}
                onClick={() => reactivateRequest.mutate({ id: row.id, rowVersion: row.rowVersion })}
              >
                <Undo2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        );
      },
    },
  ], [activeTab, canAssign, canAssignToOthers, canCancel, canClaimSelf, canPrepare, canResolve, claimPool, claimSelf, enumText, erpRetry, expandedQuotaId, formatDateTime, formatQuantity, openHandoffFromRow, openPrepare, prepare, reactivateRequest, t, toggleQuotaExpand, warehouseFilterOptions, warehouseLabel]);

  const createRequest = useMutation({
    mutationFn: async () => {
      const normalized = lines.filter((line) => line.groupCode.trim() || line.stockId != null);
      if (!employeeId || normalized.length === 0) throw new Error(t('validation.employeeAndLine'));
      if (normalized.some((line) => !line.groupCode.trim())) throw new Error(t('validation.groupRequired'));
      if (normalized.some((line) => parseDraftQuantity(line.quantity) <= 0)) throw new Error(t('validation.quantity'));
      return kkdApi.createRequest({
        idempotencyKey: crypto.randomUUID(), employeeId: Number(employeeId), warehouseId: null, assignedUserId: null,
        sourceType: 'Wms', externalRequestNo: null, priority,
        neededAtUtc: neededAt ? new Date(neededAt).toISOString() : null,
        description: description.trim() || null,
        lines: normalized.map((line) => ({
          groupCode: line.groupCode, groupName: line.groupName || null, stockId: line.stockId,
          quantity: parseDraftQuantity(line.quantity), externalOrderNo: null, externalOrderLineId: null,
        })),
      });
    },
    onSuccess: (value) => {
      toast.success(t('messages.created', { no: value.requestNo }));
      setCreateOpen(false); resetCreate(); setRevision((value) => value + 1); setDetailId(value.id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const openResolve = useCallback((requestId: number, line: KkdRequestLine): void => {
    setResolveRequestId(requestId); setResolveLine(line); setResolveStock(null); setResolveReason('');
  }, []);

  const resolve = useMutation({
    mutationFn: async () => {
      if (!resolveRequestId || !resolveLine || !resolveStock) throw new Error(t('validation.stock'));
      if (resolveReason.trim().length < 3) throw new Error(t('validation.reason'));
      return kkdApi.resolveRequestLine(resolveRequestId, resolveLine.id, {
        stockId: resolveStock.id, reason: resolveReason.trim(), expectedRowVersion: resolveLine.rowVersion,
      });
    },
    onSuccess: (value) => {
      queryClient.setQueryData(['kkd', 'requests', value.id], value);
      setResolveRequestId(null); setResolveLine(null); setResolveStock(null); setResolveReason(''); setRevision((item) => item + 1);
      toast.success(t('messages.resolved'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const cancel = useMutation({
    mutationFn: async (target: { id: number; rowVersion?: string | null }) => {
      if (cancelReason.trim().length < 3) throw new Error(t('validation.reason'));
      return kkdApi.cancelRequest(target.id, cancelReason.trim(), target.rowVersion ?? '');
    },
    onSuccess: (value) => {
      queryClient.setQueryData(['kkd', 'requests', value.id], value);
      setCancelTarget(null); setCancelReason(''); setRevision((item) => item + 1); toast.success(t('messages.cancelled'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const resetCreate = (): void => {
    setEmployeeId(''); setPriority('Normal'); setNeededAt(''); setDescription(''); setLines([newLine()]);
  };

  const activeTabIndex = PAGE_TABS.findIndex((tab) => tab === activeTab);
  const tabCount = (tab: (typeof PAGE_TABS)[number]): number | null => {
    if (!tabCounts.data) return null;
    return tabCounts.data[tab];
  };

  return <>
    <AdvancedDataGrid<KkdRequestRow>
      refreshKey={revision}
      pageKey={`kkd-requests-${activeTab}`}
      title={t('page.title')}
      description={t(`tabDescriptions.${activeTab}`, { defaultValue: t('page.description') })}
      emptyMessage={t('page.empty')}
      columns={columns}
      fetchPage={fetchPage}
      expandedRowId={activeTab === QUOTA_TAB ? expandedQuotaId : null}
      renderExpandedRow={activeTab === QUOTA_TAB ? (row) => (
        <KkdQuotaReviewPanel
          requestId={row.id}
          canManageQuota={canManageQuota}
          formatQuantity={formatQuantity}
          onBoardChanged={invalidateBoard}
        />
      ) : undefined}
      aboveToolbarExtra={(
        <div className="wms-ops-production-work-order-tabs wms-ops-detail-dialog mb-4">
          <Tabs
            value={activeTab === QUOTA_TAB ? '' : activeTab}
            onValueChange={(value) => goToTab(value as PageTab)}
          >
            <TabsList
              className={cn('w-full', 'wms-ops-scrollbar', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-5')}
              data-active-index={activeTab === QUOTA_TAB ? undefined : Math.max(activeTabIndex, 0)}
            >
              {activeTab === QUOTA_TAB ? null : <span className="wms-ops-detail-tab-indicator" aria-hidden />}
              {PAGE_TABS.map((tab) => {
                const count = tabCount(tab);
                return (
                  <TabsTrigger key={tab} value={tab} className="wms-ops-detail-main-tab">
                    {t(`tabs.${tab}`)}
                    {count != null && count > 0 ? (
                      <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--wms-brand-primary)]/12 px-1.5 text-[0.68rem] font-bold text-[var(--wms-brand-primary)]">
                        {count}
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      )}
      onRowDoubleClick={(row) => {
        if (activeTab === QUOTA_TAB) {
          toggleQuotaExpand(row.id);
          return;
        }
        if (activeTab === 'mine' && (row.myActiveTaskId || row.poolTaskId)) {
          prepare(row, row.myActiveTaskId ?? row.poolTaskId);
        }
        else setDetailId(row.id);
      }}
      toolbarActions={[
        canManageQuota ? {
          label: tabCounts.data && tabCounts.data.quotaPending > 0
            ? `${t('tabs.quotapending')} (${tabCounts.data.quotaPending})`
            : t('tabs.quotapending'),
          icon: <TriangleAlert className="size-4" />,
          tooltip: t('tabDescriptions.quotapending'),
          variant: 'secondary' as const,
          disabled: !tabCounts.data || tabCounts.data.quotaPending <= 0,
          className: cn(
            'wms-kkd-quota-cta',
            activeTab === QUOTA_TAB && 'wms-kkd-quota-cta--active',
            activeTab !== QUOTA_TAB && tabCounts.data && tabCounts.data.quotaPending > 0 && 'wms-kkd-quota-cta--live',
          ),
          run: async () => goToTab(QUOTA_TAB),
        } : null,
        can('WMS.KKD.REQUESTS.CREATE') ? {
          label: t('actions.new'), icon: <Plus className="size-4"/>, variant: 'primary' as const, showBusy: false, run: async () => setCreateOpen(true),
        } : null,
      ].filter((action): action is NonNullable<typeof action> => action !== null)}
    />

    {createOpen ? <ResponsiveDialog onClose={() => { setCreateOpen(false); resetCreate(); }} title={t('create.title')} description={t('create.description')} className="!max-w-5xl">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createRequest.mutate(); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <KkdField label={t('create.employee')}>
            <div className="wms-ops-field-shell w-full min-w-0">
              <AppDropdown
                value={employeeId || null}
                onValueChange={(value) => setEmployeeId(value ?? '')}
                searchable
                portalContainer={null}
                contentClassName={DIALOG_DROPDOWN_CONTENT}
                className="w-full"
                options={(employees.data ?? []).filter((item) => item.isActive).map(employeeOption)}
                placeholder={t('create.employeePlaceholder')}
              />
            </div>
          </KkdField>
          <KkdField label={t('create.priority')}>
            <div className="wms-ops-field-shell w-full min-w-0">
              <AppDropdown
                value={priority}
                onValueChange={(value) => setPriority(value as KkdRequestCreatePayload['priority'])}
                portalContainer={null}
                contentClassName={DIALOG_DROPDOWN_CONTENT}
                className="w-full"
                options={['Low', 'Normal', 'High', 'Urgent'].map((value) => ({ value, label: enumText('priority', value) }))}
              />
            </div>
          </KkdField>
          <KkdField label={t('create.neededAt')}>
            <AppDateInput type="datetime-local" value={neededAt} onChange={(event) => setNeededAt(event.target.value)}/>
          </KkdField>
          <KkdField label={t('create.descriptionLabel')}>
            <AppInput value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000}/>
          </KkdField>
        </div>

        <KkdPanel
          title={t('create.lines')}
          description={t('create.linesHelp')}
          icon={<ClipboardList className="size-4" strokeWidth={1.75}/>}
          bodyClassName="!p-0"
        >
          <div className="wms-ops-kkd-create-lines">
            <KkdTableShell minWidthClass="min-w-[720px]" className="border-0" maxHeightClass={false}>
              <thead>
                <tr>
                  <th className={cn(KKD_HEAD_CELL, 'w-14 whitespace-nowrap text-center')}>#</th>
                  <th className={KKD_HEAD_CELL}>{t('create.group')}</th>
                  <th className={KKD_HEAD_CELL} title={t('create.stockOptional')}>{t('create.stock')}</th>
                  <th className={cn(KKD_HEAD_CELL, 'w-28 text-right')}>{t('create.quantity')}</th>
                  <th className={cn(KKD_HEAD_CELL, 'w-12')} aria-label={t('actions.removeLine')} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <DraftLineEditor
                    key={line.key}
                    line={line}
                    index={index}
                    canRemove={lines.length > 1}
                    t={t}
                    onChange={(next) => setLines((current) => current.map((item) => (item.key === line.key ? next : item)))}
                    onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  />
                ))}
              </tbody>
            </KkdTableShell>
          </div>
          <div className="border-t border-[var(--wms-ops-card-border)] px-3 py-3 sm:px-4">
            <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setLines((current) => [...current, newLine()])}>
              <Plus className="size-3.5 shrink-0"/>{t('actions.addLine')}
            </OpsActionButton>
          </div>
        </KkdPanel>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--wms-ops-card-border)] pt-4 sm:flex-row sm:justify-end">
          <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => { setCreateOpen(false); resetCreate(); }}>
            {t('actions.close')}
          </OpsActionButton>
          <OpsActionButton type="submit" variant="primary" className="wms-ops-list-toolbar-btn" disabled={createRequest.isPending}>
            {t('actions.create')}
          </OpsActionButton>
        </div>
      </form>
    </ResponsiveDialog> : null}

    {detailId ? (
      <KkdRequestDetailDialog
        open
        loading={detail.isLoading}
        error={detail.isError}
        value={detail.data ?? null}
        tasks={detailTasks.data ?? []}
        tasksLoading={detailTasks.isLoading}
        t={t}
        formatDateTime={formatDateTime}
        formatQuantity={formatQuantity}
        enumText={enumText}
        canResolve={canResolve}
        canAssign={canAssignToOthers}
        canClaim={canClaimSelf}
        canCancel={can('WMS.KKD.REQUESTS.CANCEL')}
        canPrepare={canPrepare}
        canManageQuota={canManageQuota}
        prepareTaskId={detailPrepareTarget.prepareTaskId}
        currentUserId={currentUserOption?.id ?? null}
        initialTab={activeTab === 'preparing' || activeTab === 'mine' ? 'tasks' : 'content'}
        warehouseLabel={warehouseLabel}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        cancelling={cancel.isPending}
        onClose={() => { setDetailId(null); setCancelReason(''); }}
        onResolve={(line) => openResolve(detail.data!.id, line)}
        onAssign={() => openPrepare(detail.data!)}
        onClaim={() => claimSelf(detail.data!)}
        onCancel={() => cancel.mutate({ id: detail.data!.id, rowVersion: detail.data!.rowVersion })}
        onPrepare={() => {
          const taskId = detailPrepareTarget.prepareTaskId;
          if (!detail.data || !taskId) return;
          prepare(detail.data, taskId);
        }}
        onPrepareTask={(taskId) => prepare(detail.data!, taskId)}
        onHandoff={(task) => { setHandoffUser(null); setHandoffReason(''); setHandoffTask(task); }}
        onClaimPool={(task) => claimPool.mutate({ taskId: task.id, expectedRowVersion: task.rowVersion })}
        onQuotaBoardChanged={invalidateBoard}
      />
    ) : null}

    {cancelTarget ? <ResponsiveDialog
      onClose={() => { setCancelTarget(null); setCancelReason(''); }}
      title={t('cancelDialog.title')}
      description={t('cancelDialog.description', { no: cancelTarget.requestNo })}
      className="!max-w-lg"
    >
      <div className="space-y-4">
        {cancelPrecheck.isLoading ? (
          <p className="text-sm text-[var(--wms-app-text-muted)]">{t('cancelDialog.checking')}</p>
        ) : cancelPrecheck.data && !cancelPrecheck.data.canCancel ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3">
              <strong className="text-sm text-rose-600">{t('cancelDialog.blockedTitle')}</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--wms-app-text)]">
                {cancelPrecheck.data.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
            {cancelPrecheck.data.activeWarehouseOutboundId ? (
              <Link
                to={`/warehouse/warehouse-outbounds/${cancelPrecheck.data.activeWarehouseOutboundId}/operations`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--wms-brand-primary)] underline-offset-2 hover:underline"
                onClick={() => { setCancelTarget(null); setCancelReason(''); }}
              >
                <PlayCircle className="size-4"/>{t('cancelDialog.goToOutbound')}
              </Link>
            ) : null}
            <div className="flex justify-end border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
                {t('actions.close')}
              </OpsActionButton>
            </div>
          </div>
        ) : (
          <>
            <KkdField label={t('detail.cancelReason')}>
              <AppInput
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder={t('detail.cancelReasonPlaceholder')}
                maxLength={1000}
                autoFocus
              />
            </KkdField>
            <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
                {t('actions.close')}
              </OpsActionButton>
              <button
                type="button"
                disabled={cancel.isPending || cancelReason.trim().length < 3}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-500 px-4 text-rose-600 disabled:opacity-50"
                onClick={() => cancel.mutate({ id: cancelTarget.id, rowVersion: cancelTarget.rowVersion })}
              >
                <X className="size-4"/>{t('actions.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </ResponsiveDialog> : null}

    {prepTarget ? (
      <PrepareRequestDialog
        target={prepTarget}
        t={t}
        warehouseOptions={warehouseOptions}
        formatQuantity={formatQuantity}
        currentUserOption={currentUserOption}
        canManageQuota={canManageQuota}
        onOpenResolve={openResolve}
        onClose={() => setPrepTarget(null)}
        onDone={() => {
          setPrepTarget(null);
          invalidateBoard();
          if (activeTab === 'pending') goToTab('preparing');
        }}
      />
    ) : null}

    {claimTarget ? <ResponsiveDialog
      onClose={() => setClaimTarget(null)}
      title={t('assign.claimTitle')}
      description={t('assign.claimDescription', { no: claimTarget.requestNo })}
      className="!max-w-lg"
    >
      <div className="space-y-4">
        <KkdField label={t('assign.warehouse')} hint={warehouseAccess.data?.isRestricted ? t('assign.warehouseRestrictedHint') : undefined}>
          <div className="wms-ops-field-shell w-full min-w-0">
            <AppDropdown
              value={claimWarehouseId || null}
              onValueChange={(value) => setClaimWarehouseId(value ?? '')}
              options={warehouseOptions}
              placeholder={t('assign.warehousePlaceholder')}
              searchable
              portalContainer={null}
              contentClassName={DIALOG_DROPDOWN_CONTENT}
              className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
            />
          </div>
        </KkdField>
        <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
          <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setClaimTarget(null)}>
            {t('actions.close')}
          </OpsActionButton>
          <OpsActionButton
            type="button" variant="primary" className="wms-ops-list-toolbar-btn"
            disabled={claim.isPending || !claimWarehouseId}
            onClick={() => claim.mutate({ id: claimTarget.id, warehouseId: Number(claimWarehouseId), expectedRowVersion: claimTarget.rowVersion ?? null })}
          >
            {t('actions.claim')}
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog> : null}

    {handoffTask ? <ResponsiveDialog
      onClose={() => setHandoffTask(null)}
      title={t('handoff.title')}
      description={t('handoff.description', { no: handoffTask.taskNo, user: handoffTask.assignedUserName })}
      className="!max-w-lg"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--wms-ops-card-border)] p-3 text-sm text-[var(--wms-app-text-muted)]">
          {t('handoff.remainingInfo', {
            count: handoffTask.lines.filter((line) => line.quantity - line.preparedQuantity > 0).length,
          })}
        </div>
        <KkdField label={t('handoff.user')}>
          <div className="wms-ops-field-shell w-full min-w-0">
            <PagedAppDropdown<ActiveUserOption>
              queryKey={['kkd-task-handoff-users']}
              fetchPage={warehouseOutboundApi.users}
              toOption={(user) => ({
                value: encodeUser(user),
                label: `${user.firstName} ${user.lastName}`.trim() || user.username,
                description: `${user.username} · ${user.email}`,
              })}
              value={handoffUser ? encodeUser(handoffUser) : null}
              selectedOption={handoffUser ? {
                value: encodeUser(handoffUser),
                label: `${handoffUser.firstName} ${handoffUser.lastName}`.trim() || handoffUser.username,
              } : undefined}
              onValueChange={(value) => setHandoffUser(value ? decodeUser(value) : null)}
              searchable
              minSearchLength={1}
              portalContainer={null}
              contentClassName={DIALOG_DROPDOWN_CONTENT}
              className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
              placeholder={t('assign.userPlaceholder')}
            />
          </div>
        </KkdField>
        <KkdField label={t('handoff.reason')}>
          <AppInput value={handoffReason} onChange={(event) => setHandoffReason(event.target.value)} maxLength={1000}/>
        </KkdField>
        <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
          <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setHandoffTask(null)}>
            {t('actions.close')}
          </OpsActionButton>
          <OpsActionButton
            type="button" variant="primary" className="wms-ops-list-toolbar-btn"
            disabled={handoff.isPending || !handoffUser || handoffReason.trim().length < 3}
            onClick={() => handoff.mutate()}
          >
            <ArrowRightLeft className="size-3.5"/>{t('actions.handoff')}
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog> : null}

    {resolveLine && resolveRequestId ? <ResponsiveDialog onClose={() => { setResolveLine(null); setResolveRequestId(null); }} title={t('resolve.title')} description={t('resolve.description', { group: resolveLine.groupCode })} className="!max-w-xl">
      <div className="space-y-4">
        <KkdField label={t('resolve.stock')} hint={t('resolve.stockHelp')}>
          <div className="wms-ops-field-shell w-full min-w-0">
            <PagedAppDropdown<KkdStockLookup>
              queryKey={['kkd-request-stock', resolveLine.groupCode]}
              fetchPage={(request) => kkdApi.stocksPaged(request, resolveLine.groupCode)}
              toOption={(stock) => ({ value: encodeStock(stock), label: `${stock.code} · ${stock.name}`, description: stock.unitCode })}
              value={resolveStock ? encodeURIComponent(JSON.stringify(resolveStock)) : null}
              selectedOption={resolveStock ? { value: encodeURIComponent(JSON.stringify(resolveStock)), label: resolveStock.label } : undefined}
              onValueChange={(value) => setResolveStock(value ? decodeStock(value) : null)}
              searchable
              minSearchLength={1}
              portalContainer={null}
              contentClassName={DIALOG_DROPDOWN_CONTENT}
              className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
              placeholder={t('resolve.stockPlaceholder')}
            />
          </div>
        </KkdField>
        <KkdField label={t('resolve.reason')}>
          <AppInput value={resolveReason} onChange={(event) => setResolveReason(event.target.value)} maxLength={1000}/>
        </KkdField>
        <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
          <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setResolveLine(null)}>
            {t('actions.close')}
          </OpsActionButton>
          <OpsActionButton type="button" variant="primary" className="wms-ops-list-toolbar-btn" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
            {t('actions.save')}
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog> : null}
  </>;
}

/**
 * Üretim reçete atama tezgâhının KKD karşılığı.
 * Fark: hedef olarak kişi VEYA depo seçilir; depo = o deponun havuzu.
 * Kalem bölme opsiyoneldir (hepsini seçip tek hedefe verebilirsin).
 */
const POOL_GROUP_KEY = 'pool';
type PrepareGroup = { user: ActiveUserOption | null; lineIds: number[] };
type AssignTargetMode = 'user' | 'warehouse';

function PrepareRequestDialog({ target, t, warehouseOptions, formatQuantity, currentUserOption, canManageQuota, onOpenResolve, onClose, onDone }: {
  target: PrepTarget;
  t: (key: string, options?: Record<string, unknown>) => string;
  warehouseOptions: Array<{ value: string; label: string }>;
  formatQuantity: (value: number) => string;
  currentUserOption: ActiveUserOption | null;
  /** Kota Onayla/Reddet gerçek bir ek hak (override) kaydı yarattığı için sadece bu yetkiye sahip olanlar karar verebilir. */
  canManageQuota: boolean;
  onOpenResolve: (requestId: number, line: KkdRequestLine) => void;
  onClose: () => void;
  onDone: () => void;
}): ReactElement {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState(target.warehouseId ? String(target.warehouseId) : (warehouseOptions[0]?.value ?? ''));
  const [targetMode, setTargetMode] = useState<AssignTargetMode>('user');
  const [groupUser, setGroupUser] = useState<ActiveUserOption | null>(null);
  const [assigneeLookupOpen, setAssigneeLookupOpen] = useState(false);
  const [poolWarehouseId, setPoolWarehouseId] = useState(warehouseId);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<PrepareGroup[]>([]);
  const [didAutoSelect, setDidAutoSelect] = useState(false);
  /** Müdürün bu atama turunda hariç tuttuğu (kota aşımı nedeniyle reddedilen) kalemler — sadece bu diyalog oturumunda tutulur. */
  const [excludedLineIds, setExcludedLineIds] = useState<Set<number>>(new Set());
  /** Kota aşımına rağmen müdürün onayladığı kalemler — gerçek bir ek hak (override) kaydı yaratır (bkz. decideQuota). */
  const [approvedLineIds, setApprovedLineIds] = useState<Set<number>>(new Set());
  const [decidingLineId, setDecidingLineId] = useState<number | null>(null);
  const [pendingRejectId, setPendingRejectId] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: ['kkd', 'requests', target.id],
    queryFn: () => kkdApi.requestDetail(target.id),
  });
  const tasks = useQuery({
    queryKey: ['kkd', 'requests', target.id, 'preparation-tasks'],
    queryFn: () => kkdApi.requestPreparationTasks(target.id),
  });

  const activeAssignedIds = useMemo(() => new Set(
    (tasks.data ?? [])
      .filter((task) => ACTIVE_TASK_STATUSES.has(task.status))
      .flatMap((task) => task.lines.map((line) => line.requestLineId)),
  ), [tasks.data]);
  const groupedIds = useMemo(() => new Set(groups.flatMap((group) => group.lineIds)), [groups]);
  const assignableLines = useMemo(() => (detail.data?.lines ?? []).filter((line) =>
    line.status !== 'Cancelled' && line.status !== 'Completed'
    && line.remainingQuantity > 0
    && !activeAssignedIds.has(line.id)), [activeAssignedIds, detail.data]);
  const employeeId = detail.data?.employeeId;
  const excessCheckKey = assignableLines.filter((line) => line.stockId)
    .map((line) => `${line.id}:${line.stockId}:${line.remainingQuantity}`).join('|');
  const excessQuery = useQuery({
    queryKey: ['kkd', 'requests', target.id, 'excess-check', employeeId, excessCheckKey],
    queryFn: async () => {
      const entries = await Promise.all(
        assignableLines.filter((line) => line.stockId).map(async (line) => {
          const result = await kkdApi.check({ employeeId: employeeId!, stockId: line.stockId!, quantity: line.remainingQuantity });
          return [line.id, result.isAllowed] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: Boolean(employeeId) && excessCheckKey.length > 0,
  });
  const excessLineIds = useMemo(() => new Set(
    [...(excessQuery.data?.entries() ?? [])].filter(([, isAllowed]) => !isAllowed).map(([lineId]) => lineId),
  ), [excessQuery.data]);
  const remainingLines = assignableLines.filter((line) => !groupedIds.has(line.id));
  const coverableLines = remainingLines.filter((line) => !excludedLineIds.has(line.id));
  const allCovered = assignableLines.length > 0 && coverableLines.length === 0;
  const selectedUnassignedCount = coverableLines.filter((line) => selectedLineIds.has(line.id)).length;
  const allUnassignedSelected = coverableLines.length > 0 && selectedUnassignedCount === coverableLines.length;
  const assignedCount = assignableLines.length - remainingLines.length;

  useEffect(() => {
    if (didAutoSelect || coverableLines.length === 0) return;
    setSelectedLineIds(new Set(coverableLines.map((line) => line.id)));
    setDidAutoSelect(true);
  }, [didAutoSelect, coverableLines]);

  const effectiveWarehouseId = targetMode === 'warehouse' && poolWarehouseId
    ? poolWarehouseId
    : warehouseId;

  const submit = useMutation({
    mutationFn: async () => {
      if (!effectiveWarehouseId) throw new Error(t('validation.warehouse'));
      if (!allCovered) throw new Error(t('prepareDialog.allLinesRequired'));
      return kkdApi.assignPreparationTasks(target.id, {
        warehouseId: Number(effectiveWarehouseId),
        groups: groups.map((group) => ({ assignedUserId: group.user?.id ?? null, lineIds: group.lineIds })),
        expectedRowVersion: target.rowVersion ?? null,
      });
    },
    onSuccess: () => { toast.success(t('messages.tasksAssigned')); onDone(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const toggleLine = (lineId: number): void => {
    if (excludedLineIds.has(lineId)) return;
    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const toggleAllUnassigned = (): void => {
    setSelectedLineIds(allUnassignedSelected
      ? new Set()
      : new Set(coverableLines.map((line) => line.id)));
  };

  const rejectExcessLine = async (lineId: number): Promise<void> => {
    setDecidingLineId(lineId);
    try {
      await kkdApi.decideQuota(lineId, { approve: false, reason: 'Atama ekranından reddedildi.' });
      setExcludedLineIds((current) => new Set([...current, lineId]));
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(lineId);
        return next;
      });
      setPendingRejectId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kota kararı kaydedilemedi.');
    } finally {
      setDecidingLineId(null);
    }
  };

  const approveExcessLine = async (lineId: number): Promise<void> => {
    setDecidingLineId(lineId);
    try {
      await kkdApi.decideQuota(lineId, { approve: true, reason: 'Atama ekranından onaylandı.' });
      setApprovedLineIds((current) => new Set([...current, lineId]));
      setPendingRejectId(null);
      void queryClient.invalidateQueries({ queryKey: ['kkd', 'requests', target.id, 'excess-check'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kota kararı kaydedilemedi.');
    } finally {
      setDecidingLineId(null);
    }
  };

  const groupKey = (group: PrepareGroup): string | number => group.user?.id ?? POOL_GROUP_KEY;

  const mergeIntoGroup = (user: ActiveUserOption | null, lineIds: number[]): void => {
    setGroups((current) => {
      const key = user?.id ?? POOL_GROUP_KEY;
      const existing = current.find((group) => groupKey(group) === key);
      if (existing) {
        return current.map((group) => groupKey(group) === key
          ? { ...group, lineIds: [...new Set([...group.lineIds, ...lineIds])] }
          : group);
      }
      return [...current, { user, lineIds }];
    });
    setSelectedLineIds(new Set());
  };

  const assignSelected = (): void => {
    const lineIds = coverableLines.filter((line) => selectedLineIds.has(line.id)).map((line) => line.id);
    if (lineIds.length === 0) return;
    if (targetMode === 'warehouse') {
      if (!poolWarehouseId) return;
      setWarehouseId(poolWarehouseId);
      mergeIntoGroup(null, lineIds);
      return;
    }
    if (!groupUser) return;
    mergeIntoGroup(groupUser, lineIds);
  };

  const removeGroup = (key: string | number): void => {
    const removed = groups.find((group) => groupKey(group) === key);
    setGroups((current) => current.filter((group) => groupKey(group) !== key));
    if (removed) {
      setSelectedLineIds((current) => new Set([...current, ...removed.lineIds]));
    }
  };

  const removeLineFromGroup = (key: string | number, lineId: number): void => {
    setGroups((current) => current
      .map((group) => groupKey(group) === key
        ? { ...group, lineIds: group.lineIds.filter((id) => id !== lineId) }
        : group)
      .filter((group) => group.lineIds.length > 0));
    setSelectedLineIds((current) => new Set([...current, lineId]));
  };

  const userLabel = (user: ActiveUserOption): string => `${user.firstName} ${user.lastName}`.trim() || user.username;
  const warehouseLabel = (id: string): string => warehouseOptions.find((item) => item.value === id)?.label ?? `#${id}`;
  const canAssignSelected = selectedUnassignedCount > 0
    && (targetMode === 'warehouse' ? Boolean(poolWarehouseId) : Boolean(groupUser));
  const assignPreviewLabel = targetMode === 'warehouse'
    ? (poolWarehouseId ? warehouseLabel(poolWarehouseId) : null)
    : (groupUser ? userLabel(groupUser) : null);

  const lineById = useMemo(() => new Map(assignableLines.map((line) => [line.id, line])), [assignableLines]);

  const footerHint = coverableLines.length > 0
    ? t('prepareDialog.remainingLines', { count: coverableLines.length })
    : groups.length === 0
      ? t('prepareDialog.needGroup')
      : selectedUnassignedCount > 0 && !canAssignSelected
        ? t('prepareDialog.needTarget')
        : null;

  return (
    <ResponsiveDialog
      onClose={onClose}
      title={t('prepareDialog.title')}
      description={t('prepareDialog.description', { no: target.requestNo })}
      className="!max-w-[min(72rem,calc(100%-2.5rem))]"
    >
      {detail.isLoading || tasks.isLoading ? <p className="text-sm text-[var(--wms-app-text-muted)]">{t('messages.loading')}</p>
        : detail.isError || !detail.data ? <p className="text-sm text-rose-600">{t('messages.detailFailed')}</p>
        : assignableLines.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--wms-app-text-muted)]">{t('prepareDialog.nothingToAssign')}</p>
            <div className="flex justify-end border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={onClose}>
                {t('actions.close')}
              </OpsActionButton>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="wms-ops-detail-panel space-y-3 p-3 sm:p-4">
            <div>
              <h3 className="wms-ops-detail-section-title !border-0 !p-0">{t('prepareDialog.assignSection')}</h3>
              <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{t('prepareDialog.assignHint')}</p>
            </div>

            <div className="wms-ops-production-work-order-tabs wms-ops-detail-dialog">
              <Tabs value={targetMode} onValueChange={(value) => setTargetMode(value as AssignTargetMode)}>
                <TabsList
                  className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-2')}
                  data-active-index={targetMode === 'user' ? 0 : 1}
                >
                  <span className="wms-ops-detail-tab-indicator" aria-hidden />
                  <TabsTrigger value="user" className="wms-ops-detail-main-tab">
                    {t('prepareDialog.targetUser')}
                  </TabsTrigger>
                  <TabsTrigger value="warehouse" className="wms-ops-detail-main-tab">
                    {t('prepareDialog.targetWarehouse')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-3">
                {targetMode === 'user' ? (
                  <>
                    <KkdField label={t('prepareDialog.userFieldLabel')}>
                      <PagedLookupDialog<ActiveUserOption>
                        variant="ops"
                        triggerMode="combobox"
                        autoSearchMinLength={1}
                        popoverPortalContainer={null}
                        openDialogOnTouchTap
                        open={assigneeLookupOpen}
                        onOpenChange={setAssigneeLookupOpen}
                        title={t('prepareDialog.userFieldLabel')}
                        value={groupUser ? userLabel(groupUser) : null}
                        placeholder={t('prepareDialog.userPlaceholder')}
                        searchPlaceholder={t('prepareDialog.userSearchPlaceholder')}
                        emptyText={t('prepareDialog.userEmpty')}
                        triggerClassName="!h-11 !py-2 !pl-9 !pr-3"
                        queryKey={['kkd-request-assign-users-lookup']}
                        fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                          toPagedResponse(await warehouseOutboundApi.users({
                            pageNumber,
                            pageSize,
                            search,
                            sortBy: 'username',
                            sortDirection: 'asc',
                            signal: signal ?? new AbortController().signal,
                          }))
                        }
                        getKey={(user) => String(user.id)}
                        getLabel={(user) => userLabel(user)}
                        onSelect={setGroupUser}
                      />
                    </KkdField>
                    <KkdField label={t('prepareDialog.prepWarehouseLabel')} hint={t('prepareDialog.prepWarehouseHint')}>
                      <div className="wms-ops-field-shell w-full min-w-0">
                        <AppDropdown
                          value={warehouseId || null}
                          onValueChange={(value) => setWarehouseId(value ?? '')}
                          options={warehouseOptions}
                          placeholder={t('assign.warehousePlaceholder')}
                          searchable
                          portalContainer={null}
                          contentClassName={DIALOG_DROPDOWN_CONTENT}
                          className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                        />
                      </div>
                    </KkdField>
                  </>
                ) : (
                  <KkdField label={t('prepareDialog.poolWarehouseLabel')} hint={t('prepareDialog.poolWarehouseHint')}>
                    <div className="wms-ops-field-shell w-full min-w-0">
                      <AppDropdown
                        value={poolWarehouseId || null}
                        onValueChange={(value) => {
                          setPoolWarehouseId(value ?? '');
                          if (value) setWarehouseId(value);
                        }}
                        options={warehouseOptions}
                        placeholder={t('prepareDialog.warehousePlaceholder')}
                        searchable
                        portalContainer={null}
                        contentClassName={DIALOG_DROPDOWN_CONTENT}
                        className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                      />
                    </div>
                  </KkdField>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:pb-0.5 sm:flex-row">
                {targetMode === 'user' && currentUserOption ? (
                  <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setGroupUser(currentUserOption)}>
                    {t('assign.claimSelf')}
                  </OpsActionButton>
                ) : null}
                <OpsActionButton
                  type="button"
                  variant="secondary"
                  className="wms-ops-list-toolbar-btn"
                  disabled={!canAssignSelected}
                  onClick={assignSelected}
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  {t('prepareDialog.assignSelected')}
                </OpsActionButton>
              </div>
            </div>

            {assignPreviewLabel && selectedUnassignedCount > 0 ? (
              <p className="text-xs text-[var(--wms-app-text-muted)]">
                {t('prepareDialog.assignPreview', {
                  count: selectedUnassignedCount,
                  target: assignPreviewLabel,
                  kind: targetMode === 'warehouse' ? t('prepareDialog.targetWarehouse') : t('prepareDialog.targetUser'),
                })}
              </p>
            ) : null}
          </div>

          <div className="wms-ops-detail-panel overflow-hidden">
            <header className="flex flex-col gap-1 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <h3 className="wms-ops-detail-section-title !border-0 !p-0">{t('prepareDialog.unassignedLines')}</h3>
              <p className="text-xs text-[var(--wms-app-text-muted)]">
                {t('prepareDialog.unassignedStats', {
                  unassigned: remainingLines.length,
                  selected: selectedUnassignedCount,
                  assigned: assignedCount,
                })}
              </p>
            </header>

            {remainingLines.length === 0 ? (
              <div className="p-4 text-sm text-[var(--wms-app-text-muted)]">
                {t('prepareDialog.allAssignedHint')}
              </div>
            ) : (
              <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto p-3 sm:p-4">
                <table className="wms-ops-gr-detail-lines-table w-full min-w-[560px] text-sm">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <OpsSkinCheckbox
                          aria-label={t('prepareDialog.selectAll')}
                          checked={allUnassignedSelected}
                          indeterminate={selectedUnassignedCount > 0 && !allUnassignedSelected}
                          onCheckedChange={toggleAllUnassigned}
                        />
                      </th>
                      <th>#</th>
                      <th>{t('prepareDialog.colLine')}</th>
                      <th className="wms-ops-gr-detail-lines-table__num">{t('prepareDialog.colQuantity')}</th>
                      <th>{t('prepareDialog.colStock')}</th>
                      <th>{t('prepareDialog.colQuota')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remainingLines.map((line) => {
                      const isExcess = excessLineIds.has(line.id);
                      const isExcluded = excludedLineIds.has(line.id);
                      return (
                        <tr
                          key={line.id}
                          className={cn(
                            isExcluded ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                            !isExcluded && !selectedLineIds.has(line.id) && 'opacity-55',
                          )}
                          onClick={() => toggleLine(line.id)}
                        >
                          <td>
                            <OpsSkinCheckbox
                              aria-label={`#${line.lineNo}`}
                              checked={selectedLineIds.has(line.id)}
                              disabled={isExcluded}
                              onCheckedChange={() => toggleLine(line.id)}
                            />
                          </td>
                          <td className="font-mono text-xs">{line.lineNo}</td>
                          <td>
                            <div className="font-semibold">{line.groupCode}{line.groupName ? ` · ${line.groupName}` : ''}</div>
                          </td>
                          <td className="wms-ops-gr-detail-lines-table__num">{formatQuantity(line.remainingQuantity)}</td>
                          <td className="wms-ops-gr-detail-lines-table__muted text-xs" onClick={(event) => event.stopPropagation()}>
                            {line.stockId ? (
                              <StockIdentityCell
                                stockId={line.stockId}
                                stockCode={line.stockCode}
                                stockName={line.stockName}
                                layout="inline"
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {t('detail.stockAwaiting')}
                                <button
                                  type="button"
                                  className="wms-ops-grid-icon-btn"
                                  title={t('actions.selectStock')}
                                  aria-label={t('actions.selectStock')}
                                  onClick={() => onOpenResolve(target.id, line)}
                                >
                                  <SearchCheck className="size-3.5" />
                                </button>
                              </span>
                            )}
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            {!isExcess ? null : isExcluded ? (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600" title={t('prepareDialog.quotaRejectedHint')}>
                                <TriangleAlert className="size-3.5 shrink-0" />
                                {t('prepareDialog.quotaRejected')}
                              </div>
                            ) : pendingRejectId === line.id ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-semibold text-rose-600">{t('prepareDialog.quotaConfirmReject')}</span>
                                <button
                                  type="button"
                                  className="wms-ops-grid-icon-btn !text-rose-600"
                                  disabled={decidingLineId === line.id}
                                  onClick={() => void rejectExcessLine(line.id)}
                                >
                                  {t('prepareDialog.quotaConfirmYes')}
                                </button>
                                <button type="button" className="wms-ops-grid-icon-btn" onClick={() => setPendingRejectId(null)}>
                                  {t('actions.close')}
                                </button>
                              </div>
                            ) : approvedLineIds.has(line.id) ? (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                <Check className="size-3.5 shrink-0" />
                                {t('prepareDialog.quotaApproved')}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                                  <TriangleAlert className="size-3 shrink-0" />
                                  {t('prepareDialog.quotaExceeded')}
                                </span>
                                {canManageQuota ? (
                                  <>
                                    <button
                                      type="button"
                                      className="wms-ops-grid-icon-btn !text-emerald-600"
                                      title={t('prepareDialog.quotaApprove')}
                                      aria-label={t('prepareDialog.quotaApprove')}
                                      disabled={decidingLineId === line.id}
                                      onClick={() => void approveExcessLine(line.id)}
                                    >
                                      <CheckCircle2 className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="wms-ops-grid-icon-btn !text-rose-600"
                                      title={t('prepareDialog.quotaReject')}
                                      aria-label={t('prepareDialog.quotaReject')}
                                      disabled={decidingLineId === line.id}
                                      onClick={() => setPendingRejectId(line.id)}
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[0.68rem] text-[var(--wms-app-text-muted)]">{t('prepareDialog.quotaNeedsManager')}</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {groups.length > 0 ? (
            <div className="space-y-3">
              {groups.map((group) => {
                const key = groupKey(group);
                const title = group.user
                  ? userLabel(group.user)
                  : `${t('prepareDialog.poolGroupLabel')}${effectiveWarehouseId ? ` · ${warehouseLabel(effectiveWarehouseId)}` : ''}`;
                return (
                  <section key={key} className="wms-ops-detail-panel overflow-hidden">
                    <header className="flex items-center justify-between gap-2 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))] px-3 py-2.5 sm:px-4">
                      <h4 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                        {group.user ? null : <Users className="size-3.5 shrink-0 text-[var(--wms-brand-primary)]" aria-hidden />}
                        <span className="truncate">{title}</span>
                        <span className="shrink-0 text-xs font-normal text-[var(--wms-app-text-muted)]">
                          · {t('prepareDialog.groupLines', { count: group.lineIds.length })}
                        </span>
                      </h4>
                      <button
                        type="button"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-500/10"
                        aria-label={t('prepareDialog.removeGroup')}
                        onClick={() => removeGroup(key)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </header>
                    <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto p-3 sm:p-4">
                      <table className="wms-ops-gr-detail-lines-table w-full min-w-[480px] text-sm">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{t('prepareDialog.colLine')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('prepareDialog.colQuantity')}</th>
                            <th>{t('prepareDialog.colStock')}</th>
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody>
                          {group.lineIds.map((lineId) => {
                            const line = lineById.get(lineId);
                            if (!line) return null;
                            return (
                              <tr key={lineId}>
                                <td className="font-mono text-xs">{line.lineNo}</td>
                                <td>
                                  <div className="font-semibold">{line.groupCode}{line.groupName ? ` · ${line.groupName}` : ''}</div>
                                </td>
                                <td className="wms-ops-gr-detail-lines-table__num">{formatQuantity(line.remainingQuantity)}</td>
                                <td className="wms-ops-gr-detail-lines-table__muted text-xs">
                                  {line.stockId ? (
                                    <StockIdentityCell
                                      stockId={line.stockId}
                                      stockCode={line.stockCode}
                                      stockName={line.stockName}
                                      layout="inline"
                                    />
                                  ) : t('detail.stockAwaiting')}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    title={t('prepareDialog.removeLine')}
                                    aria-label={t('prepareDialog.removeLine')}
                                    onClick={() => removeLineFromGroup(key, lineId)}
                                    className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                                  >
                                    <X className="size-4" aria-hidden />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--wms-ops-card-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
            {footerHint ? (
              <span className="text-xs text-amber-600 sm:mr-auto">{footerHint}</span>
            ) : null}
            <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={onClose}>
              {t('actions.close')}
            </OpsActionButton>
            <OpsActionButton
              type="button"
              variant="primary"
              className="wms-ops-list-toolbar-btn"
              disabled={submit.isPending || !allCovered || groups.length === 0 || !effectiveWarehouseId}
              onClick={() => submit.mutate()}
            >
              {t('prepareDialog.confirm')}
              {groups.length > 0 ? ` (${groups.length})` : ''}
            </OpsActionButton>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}

function DraftLineEditor({ line, index, canRemove, t, onChange, onRemove }: {
  line: DraftLine; index: number; canRemove: boolean; t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (line: DraftLine) => void; onRemove: () => void;
}): ReactElement {
  const [groupLookupOpen, setGroupLookupOpen] = useState(false);
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const quantityRef = useRef<HTMLInputElement>(null);
  const pieceUnit = isPieceUnit(line.unitCode || 'ADET');
  const groupLabel = line.groupCode
    ? (line.groupName ? `${line.groupCode} · ${line.groupName}` : line.groupCode)
    : '';

  return (
    <tr>
      <td className={KKD_CELL}>
        <div className="wms-ops-kkd-create-lines__index" title={t('create.lineNo', { no: index + 1 })}>
          <span className="wms-ops-kkd-create-lines__index-num">{String(index + 1).padStart(2, '0')}</span>
        </div>
      </td>
      <td className={KKD_CELL}>
        <div className="wms-ops-kkd-create-lines__cell">
          <PagedLookupDialog<KkdEntitlementGroupLookup>
            variant="ops"
            triggerMode="combobox"
            autoSearchMinLength={1}
            open={groupLookupOpen}
            onOpenChange={setGroupLookupOpen}
            title={t('create.groupLookupTitle')}
            description={t('create.groupLookupDescription')}
            value={groupLabel}
            placeholder={t('create.groupPlaceholder')}
            searchPlaceholder={t('create.groupSearch')}
            emptyText={t('create.groupEmpty')}
            popoverPortalContainer={null}
            queryKey={['kkd-request-groups', line.key]}
            fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
              toPagedResponse(
                await kkdApi.entitlementGroupsPaged({
                  pageNumber,
                  pageSize,
                  search,
                  searchFields: ['code', 'name'],
                  sortBy: 'code',
                  sortDirection: 'asc',
                  signal: signal ?? new AbortController().signal,
                }),
              )
            }
            getKey={(group) => group.code}
            getLabel={(group) => `${group.code} · ${group.name}`}
            onSelect={(group) =>
              onChange({
                ...line,
                groupCode: group.code,
                groupName: group.name,
                stockId: null,
                stockLabel: '',
                unitCode: '',
                quantity: commitDraftQuantity(line.quantity, ''),
              })
            }
          />
        </div>
      </td>
      <td className={KKD_CELL}>
        <div className="wms-ops-kkd-create-lines__cell">
          <PagedLookupDialog<KkdStockLookup>
            variant="ops"
            triggerMode="combobox"
            autoSearchMinLength={1}
            open={stockLookupOpen}
            onOpenChange={setStockLookupOpen}
            title={t('create.stockLookupTitle')}
            description={
              line.groupCode
                ? t('create.stockLookupDescriptionFiltered', { group: line.groupCode })
                : t('create.stockLookupDescription')
            }
            value={line.stockLabel}
            placeholder={t('create.stockPlaceholder')}
            searchPlaceholder={t('create.stockSearch')}
            emptyText={t('create.stockEmpty')}
            popoverPortalContainer={null}
            queryKey={['kkd-request-line-stock', line.key, line.groupCode || 'all']}
            fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
              toPagedResponse(
                await kkdApi.stocksPaged(
                  {
                    pageNumber,
                    pageSize,
                    search,
                    searchFields: ['code', 'name'],
                    sortBy: 'code',
                    sortDirection: 'asc',
                    signal: signal ?? new AbortController().signal,
                  },
                  line.groupCode || undefined,
                ),
              )
            }
            getKey={(stock) => String(stock.id)}
            getLabel={(stock) => `${stock.code} · ${stock.name}`}
            onSelect={(stock) => {
              const stockGroup = stock.groupCode?.trim() || '';
              onChange({
                ...line,
                stockId: stock.id,
                stockLabel: `${stock.code} · ${stock.name}`,
                unitCode: stock.unitCode ?? '',
                groupCode: stockGroup || line.groupCode,
                groupName: stockGroup
                  ? (stockGroup === line.groupCode ? line.groupName : '')
                  : line.groupName,
                quantity: commitDraftQuantity(line.quantity, stock.unitCode),
              });
            }}
          />
        </div>
      </td>
      <td className={KKD_CELL}>
        <div className="wms-ops-kkd-create-lines__cell wms-ops-kkd-create-lines__qty">
          <AppInput
            ref={quantityRef}
            type="text"
            inputMode={pieceUnit ? 'numeric' : 'decimal'}
            autoComplete="off"
            spellCheck={false}
            value={line.quantity}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              if (event.key.length !== 1) return;
              if (pieceUnit) {
                if (!/\d/.test(event.key)) event.preventDefault();
                return;
              }
              if (!/[\d.,]/.test(event.key)) event.preventDefault();
            }}
            onChange={(event) => {
              const field = event.currentTarget;
              const caret = field.selectionStart ?? field.value.length;
              const next = maskProjectQuantityInput(field.value, line.unitCode || 'ADET');
              onChange({ ...line, quantity: next });
              const restoreAt = nextQuantityCaret(field.value, caret, next);
              requestAnimationFrame(() => {
                quantityRef.current?.setSelectionRange(restoreAt, restoreAt);
              });
            }}
            onBlur={() => onChange({
              ...line,
              quantity: commitDraftQuantity(line.quantity, line.unitCode || 'ADET') || line.quantity,
            })}
            aria-label={t('create.quantity')}
            className="wms-ops-kkd-create-lines__qty-input"
          />
        </div>
      </td>
      <td className={KKD_CELL}>
        <div className="wms-ops-kkd-create-lines__actions">
          {canRemove ? (
            <button
              type="button"
              tabIndex={-1}
              className="inline-flex size-7 items-center justify-center text-rose-500/80 transition hover:bg-rose-500/10 hover:text-rose-400"
              onClick={onRemove}
              aria-label={t('actions.removeLine')}
            >
              <Trash2 className="size-3.5"/>
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

type KkdDetailMainTab = 'info' | 'content' | 'tasks';
const KKD_DETAIL_TAB_ORDER: KkdDetailMainTab[] = ['info', 'content', 'tasks'];

function KkdRequestDetailDialog({
  open,
  loading,
  error,
  value,
  tasks,
  tasksLoading,
  t,
  formatDateTime,
  formatQuantity,
  enumText,
  canResolve,
  canAssign,
  canClaim,
  canCancel,
  canPrepare,
  canManageQuota,
  prepareTaskId,
  currentUserId,
  initialTab = 'content',
  warehouseLabel,
  cancelReason,
  setCancelReason,
  cancelling,
  onClose,
  onResolve,
  onAssign,
  onClaim,
  onCancel,
  onPrepare,
  onPrepareTask,
  onHandoff,
  onClaimPool,
  onQuotaBoardChanged,
}: {
  open: boolean;
  loading: boolean;
  error: boolean;
  value: KkdRequestDetail | null;
  tasks: KkdPreparationTaskRow[];
  tasksLoading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDateTime: (value?: string | null) => string;
  formatQuantity: (value: number) => string;
  enumText: (scope: string, value: string) => string;
  canResolve: boolean;
  canAssign: boolean;
  canClaim: boolean;
  canCancel: boolean;
  canPrepare: boolean;
  canManageQuota: boolean;
  prepareTaskId?: number | null;
  currentUserId: number | null;
  initialTab?: KkdDetailMainTab;
  warehouseLabel: (id?: number | null) => string;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  cancelling: boolean;
  onClose: () => void;
  onResolve: (line: KkdRequestLine) => void;
  onAssign: () => void;
  onClaim: () => void;
  onCancel: () => void;
  onPrepare: () => void;
  onPrepareTask: (taskId: number) => void;
  onHandoff: (task: KkdPreparationTaskRow) => void;
  onClaimPool: (task: KkdPreparationTaskRow) => void;
  onQuotaBoardChanged: () => void;
}): ReactElement {
  const [mainTab, setMainTab] = useState<KkdDetailMainTab>(initialTab);
  const [showCancelPanel, setShowCancelPanel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMainTab(initialTab);
    setShowCancelPanel(false);
  }, [open, value?.id, initialTab]);

  const activeTasks = useMemo(
    () => tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status)),
    [tasks],
  );
  const assignedLineIds = useMemo(
    () => new Set(activeTasks.flatMap((task) => task.lines.map((line) => line.requestLineId))),
    [activeTasks],
  );
  const { excessLineIds } = useKkdQuotaExcess(value?.id ?? null, value?.employeeId, value?.lines ?? []);
  const decideQuota = useKkdQuotaDecide(value?.id ?? null, onQuotaBoardChanged);
  const hasPoolTask = activeTasks.some((task) => task.assignedUserId == null);
  const myActiveTaskId = useMemo(() => {
    if (prepareTaskId) return prepareTaskId;
    if (currentUserId == null) return null;
    return activeTasks.find((task) => task.assignedUserId === currentUserId)?.id ?? null;
  }, [activeTasks, currentUserId, prepareTaskId]);
  const hasUnassignedLines = Boolean(
    value?.lines.some((line) =>
      line.status !== 'Cancelled'
      && line.status !== 'Completed'
      && line.remainingQuantity > 0
      && !assignedLineIds.has(line.id)),
  );

  const requestOpen = Boolean(value && !CLOSED.has(value.status));
  /** Grid ile aynı: yalnızca atanmamış açık kalem kaldıysa. */
  const showAssign = Boolean(requestOpen && canAssign && hasUnassignedLines);
  /** Talep-seviye üzerime al: atanmamış kalem var, havuz/kişisel görev yok. */
  const showClaim = Boolean(
    requestOpen && canClaim && hasUnassignedLines && !hasPoolTask && !myActiveTaskId,
  );
  /** Üzerimdeki aktif görev varsa doğrudan toplama. */
  const showPrepare = Boolean(requestOpen && canPrepare && myActiveTaskId);
  const showCancel = Boolean(requestOpen && canCancel);
  const hasLifecycle = showAssign || showClaim || showPrepare || showCancel;
  const mainTabIndex = KKD_DETAIL_TAB_ORDER.indexOf(mainTab);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        className={cn(
          'wms-ops-detail-dialog wms-ops-form flex !h-[min(90vh,880px)] !max-h-[calc(100dvh-2rem)] w-full !max-w-6xl flex-col !gap-0 overflow-hidden border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] !p-0',
          '[scrollbar-gutter:auto]',
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0">
          <div className="min-w-0 pr-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
              {t('detail.eyebrow')}
            </p>
            <DialogTitle className="wms-ops-detail-dialog__title">
              {t('detail.title')}
              {value ? (
                <span className="ml-2 font-mono text-base font-bold text-cyan-600 dark:text-cyan-300">
                  {value.requestNo}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription className="wms-ops-detail-dialog__description">
              {value
                ? `${value.employeeCode} · ${value.employeeName} · ${enumText('status', value.status)}`
                : t('detail.description')}
            </DialogDescription>
            {value ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <OpsStatusBadge tone={inferOpsStatusTone(value.status)}>
                  {enumText('status', value.status)}
                </OpsStatusBadge>
                <OpsCodeBadge>{enumText('priority', value.priority)}</OpsCodeBadge>
                <OpsCodeBadge>{value.sourceType}</OpsCodeBadge>
              </div>
            ) : null}
          </div>
        </header>

        {loading || !value ? (
          <div className="wms-ops-detail-state grid min-h-0 flex-1 place-items-center px-6 py-10">
            <p className="text-sm text-[var(--wms-app-text-muted)]">
              {error ? t('messages.detailFailed') : t('messages.loading')}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="wms-ops-detail-lifecycle shrink-0 px-4 py-3 sm:px-6">
              {hasLifecycle ? (
                <div className="space-y-3">
                  <div className="wms-ops-detail-lifecycle__bar">
                    {showAssign ? (
                      <KkdDetailLifecycleButton
                        label={t('detail.lifecycleAssign')}
                        icon={<UserRoundCog className="size-4" />}
                        onClick={onAssign}
                      />
                    ) : null}
                    {showClaim ? (
                      <KkdDetailLifecycleButton
                        label={t('detail.lifecycleClaim')}
                        icon={<Hand className="size-4" />}
                        onClick={onClaim}
                      />
                    ) : null}
                    {showPrepare && myActiveTaskId ? (
                      <KkdDetailLifecycleButton
                        label={t('detail.lifecyclePrepare')}
                        icon={<PackageCheck className="size-4" />}
                        onClick={onPrepare}
                      />
                    ) : null}
                    {showCancel ? (
                      <KkdDetailLifecycleButton
                        label={t('actions.cancel')}
                        danger
                        icon={<Ban className="size-4" />}
                        onClick={() => {
                          setShowCancelPanel((current) => !current);
                          setMainTab('info');
                        }}
                      />
                    ) : null}
                  </div>
                  {showCancel && showCancelPanel ? (
                    <div className="rounded-xl border border-rose-500/35 bg-rose-500/5 p-3">
                      <KkdField label={t('detail.cancelReason')}>
                        <AppInput
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                          placeholder={t('detail.cancelReasonPlaceholder')}
                        />
                      </KkdField>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <OpsActionButton
                          type="button"
                          variant="secondary"
                          className="wms-ops-list-toolbar-btn"
                          onClick={() => setShowCancelPanel(false)}
                        >
                          {t('actions.close')}
                        </OpsActionButton>
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-500/70 bg-rose-500/10 px-3 text-sm font-semibold text-rose-600 disabled:opacity-50"
                          disabled={cancelling || cancelReason.trim().length < 3}
                          onClick={onCancel}
                        >
                          <Ban className="size-3.5" aria-hidden />
                          {t('detail.cancelConfirm')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="wms-ops-detail-lifecycle__cancelled">
                  {enumText('status', value.status)}
                </div>
              )}
            </div>

            <Tabs
              value={mainTab}
              onValueChange={(next) => setMainTab(next as KkdDetailMainTab)}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="shrink-0 px-4 pt-4 sm:px-6">
                <TabsList
                  className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-3')}
                  data-active-index={Math.max(mainTabIndex, 0)}
                >
                  <span className="wms-ops-detail-tab-indicator" aria-hidden />
                  <TabsTrigger value="info" className="wms-ops-detail-main-tab">
                    {t('detail.infoTab')}
                  </TabsTrigger>
                  <TabsTrigger value="content" className="wms-ops-detail-main-tab">
                    {t('detail.linesTab')}
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="wms-ops-detail-main-tab">
                    {t('detail.tasksTab')}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="info"
                className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
              >
                <div className="space-y-4">
                  <div className="wms-ops-detail-panel">
                    <div className="wms-ops-detail-grid">
                      <KkdDetailField label={t('detail.person')}>
                        {value.employeeCode} · {value.employeeName}
                      </KkdDetailField>
                      <KkdDetailField label={t('detail.departmentRole')}>
                        {value.departmentName} · {value.roleName}
                      </KkdDetailField>
                      <KkdDetailField label={t('grid.status')}>
                        <OpsStatusBadge tone={inferOpsStatusTone(value.status)}>
                          {enumText('status', value.status)}
                        </OpsStatusBadge>
                      </KkdDetailField>
                      <KkdDetailField label={t('grid.priority')}>
                        {enumText('priority', value.priority)}
                      </KkdDetailField>
                      <KkdDetailField label={t('grid.requestedAt')}>
                        {formatDateTime(value.requestedAtUtc)}
                      </KkdDetailField>
                      <KkdDetailField label={t('grid.neededAt')}>
                        {formatDateTime(value.neededAtUtc)}
                      </KkdDetailField>
                      <KkdDetailField label={t('detail.warehouse')}>
                        {warehouseLabel(value.warehouseId)}
                      </KkdDetailField>
                      <KkdDetailField label={t('detail.assignedUser')}>
                        {value.assignedUserId ? t('grid.assigned') : t('grid.unassigned')}
                      </KkdDetailField>
                      <KkdDetailField label={t('detail.sourceType')}>
                        {value.sourceType}
                      </KkdDetailField>
                      <KkdDetailField label={t('detail.externalNo')}>
                        {value.externalRequestNo || '—'}
                      </KkdDetailField>
                      <KkdDetailField label={t('detail.notes')} wide>
                        {value.description?.trim() || '—'}
                      </KkdDetailField>
                      {value.cancellationReason ? (
                        <KkdDetailField label={t('detail.cancelReason')} wide>
                          {value.cancellationReason}
                        </KkdDetailField>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="content"
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6"
              >
                {!value.lines.length ? (
                  <div className="wms-ops-detail-empty flex flex-col items-center gap-2 border border-dashed border-[var(--wms-app-border)] p-8 text-center">
                    <ClipboardList className="size-8 opacity-40" aria-hidden />
                    <p className="text-sm text-slate-500">{t('detail.noLines')}</p>
                  </div>
                ) : (
                  <div className="wms-ops-gr-detail-lines-wrap min-h-0 flex-1 overflow-auto">
                    <table className="wms-ops-gr-detail-lines-table w-full min-w-[820px] text-sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t('detail.colGroup')}</th>
                          <th>{t('detail.colStock')}</th>
                          <th className="wms-ops-gr-detail-lines-table__num">{t('grid.requested')}</th>
                          <th className="wms-ops-gr-detail-lines-table__num">{t('grid.allocated')}</th>
                          <th className="wms-ops-gr-detail-lines-table__num">{t('grid.delivered')}</th>
                          <th className="wms-ops-gr-detail-lines-table__num">{t('detail.remaining')}</th>
                          <th>{t('detail.colAssignment')}</th>
                          <th>{t('grid.status')}</th>
                          <th className="text-center">{t('prepareDialog.colQuota')}</th>
                          <th className="wms-ops-gr-detail-lines-table__actions">{t('grid.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.lines.map((line) => {
                          const canResolveLine = canResolve
                            && !line.stockId
                            && line.allocatedQuantity === 0
                            && line.deliveredQuantity === 0;
                          const lineOpen = line.status !== 'Cancelled' && line.status !== 'Completed';
                          const needsQuotaDecision = lineQuotaBucket(
                            line.quotaDecision,
                            excessLineIds.has(line.id),
                          ) === 'pending' && Boolean(line.stockId);
                          return (
                            <tr key={line.id} className={cn(
                              !line.stockId && 'bg-amber-500/[0.04]',
                              (excessLineIds.has(line.id) || line.quotaDecision !== 'None') && 'wms-kkd-quota-excess',
                            )}>
                              <td>{line.lineNo}</td>
                              <td>
                                <div className="font-medium">{line.groupCode}</div>
                                {line.groupName ? (
                                  <div className="wms-ops-gr-detail-lines-table__muted text-xs">{line.groupName}</div>
                                ) : null}
                              </td>
                              <td>
                                {line.stockId ? (
                                  <StockIdentityCell
                                    stockId={line.stockId}
                                    stockCode={line.stockCode}
                                    stockName={line.stockName}
                                    nameClassName="wms-ops-gr-detail-lines-table__muted text-xs"
                                  />
                                ) : (
                                  <span className="text-amber-600">{t('detail.stockAwaiting')}</span>
                                )}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__num">{formatQuantity(line.requestedQuantity)}</td>
                              <td className="wms-ops-gr-detail-lines-table__num">{formatQuantity(line.allocatedQuantity)}</td>
                              <td className="wms-ops-gr-detail-lines-table__num">{formatQuantity(line.deliveredQuantity)}</td>
                              <td className="wms-ops-gr-detail-lines-table__num wms-ops-gr-detail-lines-table__accent">
                                {formatQuantity(line.remainingQuantity)}
                              </td>
                              <td>
                                {lineOpen ? (
                                  assignedLineIds.has(line.id)
                                    ? <span className="text-emerald-600">{t('detail.lineAssigned')}</span>
                                    : <span className="text-amber-600">{t('detail.lineUnassigned')}</span>
                                ) : '—'}
                              </td>
                              <td>
                                <OpsStatusBadge tone={inferOpsStatusTone(line.status)}>
                                  {enumText('lineStatus', line.status)}
                                </OpsStatusBadge>
                              </td>
                              <td className="w-px whitespace-nowrap text-center align-middle">
                                <div className="flex justify-center">
                                  <QuotaDecisionBadge
                                    decision={line.quotaDecision}
                                    isExcess={excessLineIds.has(line.id)}
                                  />
                                </div>
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__actions">
                                <div className="flex flex-col items-stretch gap-1.5">
                                  {needsQuotaDecision && canManageQuota ? (
                                    <QuotaLineActions
                                      line={line}
                                      canDecide
                                      disabled={decideQuota.isPending}
                                      onApprove={(item) => {
                                        const pendingNow = (value?.lines ?? []).filter((candidate) =>
                                          lineQuotaBucket(candidate.quotaDecision, excessLineIds.has(candidate.id)) === 'pending'
                                          && Boolean(candidate.stockId)).length;
                                        decideQuota.mutate({
                                          lineId: item.id,
                                          approve: true,
                                          reason: t('quotaReview.approveReason'),
                                          remainingPendingAfter: Math.max(0, pendingNow - 1),
                                        });
                                      }}
                                      onReject={(item, reason) => {
                                        const pendingNow = (value?.lines ?? []).filter((candidate) =>
                                          lineQuotaBucket(candidate.quotaDecision, excessLineIds.has(candidate.id)) === 'pending'
                                          && Boolean(candidate.stockId)).length;
                                        decideQuota.mutate({
                                          lineId: item.id,
                                          approve: false,
                                          reason,
                                          remainingPendingAfter: Math.max(0, pendingNow - 1),
                                        });
                                      }}
                                    />
                                  ) : null}
                                  {canResolveLine ? (
                                    <button
                                      type="button"
                                      className="wms-ops-grid-icon-btn"
                                      title={t('actions.selectStock')}
                                      aria-label={t('actions.selectStock')}
                                      onClick={() => onResolve(line)}
                                    >
                                      <SearchCheck className="size-3.5" />
                                    </button>
                                  ) : null}
                                  {!needsQuotaDecision && !canResolveLine ? (
                                    <span className="text-[var(--wms-app-text-muted)]">—</span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="tasks"
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6"
              >
                {tasksLoading ? (
                  <p className="text-sm text-[var(--wms-app-text-muted)]">{t('messages.loading')}</p>
                ) : !tasks.length ? (
                  <div className="wms-ops-detail-empty flex flex-col items-center gap-2 border border-dashed border-[var(--wms-app-border)] p-8 text-center">
                    <Users className="size-8 opacity-40" aria-hidden />
                    <p className="text-sm text-slate-500">{t('detail.noTasks')}</p>
                  </div>
                ) : (
                  <div className="wms-ops-gr-detail-lines-wrap min-h-0 flex-1 overflow-auto">
                    <table className="wms-ops-gr-detail-lines-table w-full min-w-[880px] text-sm">
                      <thead>
                        <tr>
                          <th>{t('detail.colTaskNo')}</th>
                          <th>{t('detail.colTaskAssignee')}</th>
                          <th>{t('detail.colTaskLines')}</th>
                          <th>{t('grid.status')}</th>
                          <th>{t('detail.colTaskAssignedAt')}</th>
                          <th className="wms-ops-gr-detail-lines-table__actions">{t('grid.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => {
                          const active = ACTIVE_TASK_STATUSES.has(task.status);
                          const isPool = task.assignedUserId == null;
                          const mine = currentUserId != null && task.assignedUserId === currentUserId;
                          const statusToneValue = task.status === 'Completed'
                            ? 'Completed'
                            : task.status === 'Cancelled' || task.status === 'Returned'
                              ? 'Cancelled'
                              : task.status;
                          return (
                            <tr key={task.id} className={cn(
                              mine && active && 'bg-[var(--wms-brand-primary)]/[0.04]',
                              isPool && active && 'bg-cyan-500/[0.04]',
                            )}>
                              <td>
                                <div className="font-medium">{task.taskNo}</div>
                                {task.closureReason ? (
                                  <div className="text-xs text-rose-600">{task.closureReason}</div>
                                ) : null}
                              </td>
                              <td>
                                {isPool ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-cyan-600">
                                    <Users className="size-3.5" aria-hidden />
                                    {t('detail.taskPool')}
                                  </span>
                                ) : (
                                  <div>
                                    <div>{task.assignedUserName || '—'}</div>
                                    {task.originUserName ? (
                                      <div className="wms-ops-gr-detail-lines-table__muted text-xs">
                                        {t('detail.taskOrigin', { user: task.originUserName })}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__muted text-xs">
                                {task.lines.map((line) => (
                                  `#${line.lineNo} ${line.groupCode} (${formatQuantity(line.deliveredQuantity)}/${formatQuantity(line.quantity)})`
                                )).join(' · ')}
                              </td>
                              <td>
                                <OpsStatusBadge tone={inferOpsStatusTone(statusToneValue)}>
                                  {enumText('taskStatus', task.status)}
                                </OpsStatusBadge>
                              </td>
                              <td>{formatDateTime(task.assignedAtUtc)}</td>
                              <td className="wms-ops-gr-detail-lines-table__actions">
                                <div className="flex justify-center gap-1">
                                  {canClaim && active && isPool ? (
                                    <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.claimPool')} aria-label={t('actions.claimPool')} onClick={() => onClaimPool(task)}>
                                      <Users className="size-3.5" />
                                    </button>
                                  ) : null}
                                  {canPrepare && active && mine ? (
                                    <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.prepare')} aria-label={t('actions.prepare')} onClick={() => onPrepareTask(task.id)}>
                                      <PackageCheck className="size-3.5" />
                                    </button>
                                  ) : null}
                                  {task.warehouseOutboundId ? (
                                    <Link
                                      to={`/warehouse/warehouse-outbounds/${task.warehouseOutboundId}/operations`}
                                      className="wms-ops-grid-icon-btn"
                                      title={t('actions.operation')}
                                      aria-label={t('actions.operation')}
                                    >
                                      <PlayCircle className="size-3.5" />
                                    </Link>
                                  ) : null}
                                  {canAssign && active && !isPool ? (
                                    <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.handoff')} aria-label={t('actions.handoff')} onClick={() => onHandoff(task)}>
                                      <ArrowRightLeft className="size-3.5" />
                                    </button>
                                  ) : null}
                                  {!(
                                    (canClaim && active && isPool)
                                    || (canPrepare && active && mine)
                                    || task.warehouseOutboundId
                                    || (canAssign && active && !isPool)
                                  ) ? (
                                    <span className="text-[var(--wms-app-text-muted)]">—</span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KkdDetailField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}): ReactElement {
  return (
    <div className={cn('wms-ops-detail-field', wide && 'wms-ops-detail-field--wide')}>
      <span className="wms-ops-detail-field__label">{label}</span>
      <span className="wms-ops-detail-field__value">{children}</span>
    </div>
  );
}

function KkdDetailLifecycleButton({
  label,
  icon,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  icon: ReactElement;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'wms-ops-detail-lifecycle__btn',
        danger && 'wms-ops-detail-lifecycle__btn--danger',
        disabled && 'opacity-45',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Status({ value, text }: { value: string; text: string }): ReactElement {
  const tone = value === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : value === 'Cancelled' ? 'bg-rose-500/10 text-rose-600' : value.includes('Awaiting') ? 'bg-amber-500/10 text-amber-600' : 'bg-cyan-500/10 text-cyan-600';
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>{text}</span>;
}

function employeeOption(item: KkdEmployee) {
  return { value: String(item.id), label: `${item.employeeCode} · ${item.fullName}`, description: `${item.departmentName} · ${item.roleName}` };
}

function encodeStock(stock: KkdStockLookup): string {
  return encodeURIComponent(JSON.stringify({ id: stock.id, label: `${stock.code} · ${stock.name}` }));
}

function decodeStock(value: string): { id: number; label: string } {
  return JSON.parse(decodeURIComponent(value)) as { id: number; label: string };
}
