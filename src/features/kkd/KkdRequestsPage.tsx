import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, ChevronDown, ChevronRight, ClipboardList, Eye, Hand, PackageCheck, PlayCircle, Plus, RefreshCw, SearchCheck, Trash2, Undo2, UserPlus, UserRoundCog, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn, type GridRequest } from '@/components/shared/AdvancedDataGrid';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
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
import type { PagedResponse } from '@/types/api';
import {
  kkdApi,
  type KkdEmployee,
  type KkdPreparationTaskRow,
  type KkdRequestBoardTab,
  type KkdRequestCreatePayload,
  type KkdRequestDetail,
  type KkdRequestLine,
  type KkdRequestRow,
  type KkdStockLookup,
} from './kkd-api';
import { KkdField, KkdPanel } from './kkd-ops-ui';

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
  quantity: number;
};

const newLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  groupCode: '',
  groupName: '',
  stockId: null,
  stockLabel: '',
  quantity: 1,
});

const CLOSED = new Set(['Completed', 'Cancelled']);

/** Üretim iş emirleri sayfasındaki yaşam döngüsü sekmeleri; server-side filtrelenir. */
const PAGE_TABS = ['pending', 'preparing', 'completed', 'cancelled', 'mine'] as const;
type PageTab = (typeof PAGE_TABS)[number];
const isPageTab = (value: string | null): value is PageTab => PAGE_TABS.includes(value as PageTab);

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
  const canPrepare = can('WMS.KKD.DISTRIBUTION.OPERATE');
  const canCancel = can('WMS.KKD.REQUESTS.CANCEL');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageTab>(() => {
    const tab = searchParams.get('tab');
    return isPageTab(tab) ? tab : 'pending';
  });
  const [revision, setRevision] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
  const [returnTask, setReturnTask] = useState<KkdPreparationTaskRow | null>(null);
  const [returnReason, setReturnReason] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isPageTab(tab)) setActiveTab(tab);
  }, [searchParams]);

  const goToTab = useCallback((tab: PageTab) => {
    setActiveTab(tab);
    setExpandedId(null);
    setSearchParams((params) => { params.set('tab', tab); return params; }, { replace: true });
  }, [setSearchParams]);

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
   * Müdür / kısıtsız kullanıcı: kalem bazlı ata.
   * warehouse-access mal kabul yetkisi/şube header yüzünden düşse bile ata kaybolmasın —
   * sadece açıkça isRestricted=true ise gizlenir. Claim (üzerime al) her RESOLVE yetkilisinde kalır.
   */
  const canAssignToOthers = canResolve && warehouseAccess.data?.isRestricted !== true;
  const canClaimSelf = canResolve;
  const openPrepare = useCallback((target: PrepTarget) => setPrepTarget(target), []);

  const formatDateTime = useCallback((value?: string | null): string => value
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—', [i18n.language]);
  const formatQuantity = useCallback((value: number): string =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(value), [i18n.language]);
  const enumText = useCallback((scope: string, value: string): string =>
    t(`${scope}.${value}`, { defaultValue: value }), [t]);
  /** Görev modunda tezgahı açar; taskId verilirse tezgah yalnızca o görevin kalemlerini ön doldurur. */
  const navigatePrepare = useCallback((row: { id: number; employeeId: number }, taskId?: number | null): void => {
    const params = new URLSearchParams({ employeeId: String(row.employeeId), requestId: String(row.id), taskMode: '1' });
    if (taskId) params.set('taskId', String(taskId));
    navigate(`/warehouse/kkd/distributions/new?${params.toString()}`);
  }, [navigate]);

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

  const returnWork = useMutation({
    mutationFn: async () => {
      if (!returnTask) throw new Error(t('messages.failed'));
      if (returnReason.trim().length < 3) throw new Error(t('validation.reason'));
      return kkdApi.returnPreparationTask(returnTask.id, {
        reason: returnReason.trim(), expectedRowVersion: returnTask.rowVersion,
      });
    },
    onSuccess: () => {
      setReturnTask(null); setReturnReason(''); invalidateBoard();
      toast.success(t('messages.returned'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const erpRetry = useMutation({
    mutationFn: async (distributionId: number) => kkdApi.complete(distributionId),
    onSuccess: () => { invalidateBoard(); toast.success(t('messages.erpRetried')); },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const cancelPrecheck = useQuery({
    queryKey: ['kkd', 'requests', cancelTarget?.id, 'cancel-precheck'],
    queryFn: () => kkdApi.requestCancelPrecheck(cancelTarget!.id),
    enabled: Boolean(cancelTarget),
  });

  const columns = useMemo<GridColumn<KkdRequestRow>[]>(() => [
    {
      key: 'expand', label: '', width: 48, sortable: false, filterable: false, searchable: false,
      render: (row) => (
        <button
          type="button"
          aria-expanded={expandedId === row.id}
          aria-label={expandedId === row.id ? t('actions.collapse') : t('actions.expand')}
          onClick={(event) => { event.stopPropagation(); setExpandedId((current) => (current === row.id ? null : row.id)); }}
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-[var(--wms-brand-primary)]/10"
        >
          {expandedId === row.id
            ? <ChevronDown className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />
            : <ChevronRight className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />}
        </button>
      ),
    },
    { key: 'id', label: t('grid.id'), width: 88, render: (row) => row.id, filterType: 'number', sortable: true },
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
        const names = row.activeAssigneeNames.length > 0
          ? row.activeAssigneeNames
          : (row.assignedUserName ? [row.assignedUserName] : []);
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
              <span key={name} className="inline-flex max-w-full truncate rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">{name}</span>
            ))}
            {names.length > 2 ? (
              <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">+{names.length - 2}</span>
            ) : null}
          </span>
        );
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
      key: 'actions', label: t('grid.actions'), width: 230, filterable: false, searchable: false,
      render: (row) => {
        const open = !CLOSED.has(row.status);
        const hasUnassigned = row.unassignedLineCount > 0;
        return (
          <div className="wms-ops-row-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.detail')} aria-label={t('actions.detail')} onClick={() => setDetailId(row.id)}>
              <Eye className="size-3.5" />
            </button>
            {canAssignToOthers && open && hasUnassigned ? (
              <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.assign')} aria-label={t('actions.assign')} onClick={() => openPrepare(row)}>
                <UserRoundCog className="size-3.5" />
              </button>
            ) : null}
            {canClaimSelf && open && row.hasPoolTask && row.poolTaskId && !row.myActiveTaskId ? (
              <button
                type="button" className="wms-ops-grid-icon-btn" title={t('actions.claimPool')} aria-label={t('actions.claimPool')}
                disabled={claimPool.isPending}
                onClick={() => claimPool.mutate({ taskId: row.poolTaskId!, expectedRowVersion: null })}
              >
                <Users className="size-3.5" />
              </button>
            ) : null}
            {canClaimSelf && open && hasUnassigned && !row.hasPoolTask && !row.myActiveTaskId ? (
              <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.claim')} aria-label={t('actions.claim')} onClick={() => claimSelf(row)}>
                <Hand className="size-3.5" />
              </button>
            ) : null}
            {canPrepare && open && (row.myActiveTaskId || (row.hasPoolTask && row.poolTaskId)) && row.unresolvedLineCount === 0 ? (
              <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.prepare')} aria-label={t('actions.prepare')} onClick={() => prepare(row, row.myActiveTaskId ?? row.poolTaskId)}>
                <PackageCheck className="size-3.5" />
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
            {canCancel && open ? (
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
          </div>
        );
      },
    },
  ], [canAssignToOthers, canCancel, canClaimSelf, canPrepare, claimPool, claimSelf, enumText, erpRetry, expandedId, formatDateTime, formatQuantity, openPrepare, prepare, t, warehouseFilterOptions, warehouseLabel]);

  const createRequest = useMutation({
    mutationFn: async () => {
      const normalized = lines.filter((line) => line.groupCode.trim());
      if (!employeeId || normalized.length === 0) throw new Error(t('validation.employeeAndLine'));
      if (normalized.some((line) => line.quantity <= 0)) throw new Error(t('validation.quantity'));
      return kkdApi.createRequest({
        idempotencyKey: crypto.randomUUID(), employeeId: Number(employeeId), warehouseId: null, assignedUserId: null,
        sourceType: 'Wms', externalRequestNo: null, priority,
        neededAtUtc: neededAt ? new Date(neededAt).toISOString() : null,
        description: description.trim() || null,
        lines: normalized.map((line) => ({
          groupCode: line.groupCode, groupName: line.groupName || null, stockId: line.stockId,
          quantity: line.quantity, externalOrderNo: null, externalOrderLineId: null,
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
  const tabCount = (tab: PageTab): number | null => {
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
      aboveToolbarExtra={(
        <div className="wms-ops-production-work-order-tabs wms-ops-detail-dialog mb-4">
          <Tabs value={activeTab} onValueChange={(value) => goToTab(value as PageTab)}>
            <TabsList
              className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-5')}
              data-active-index={Math.max(activeTabIndex, 0)}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
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
      expandedRowId={expandedId}
      renderExpandedRow={(row) => (
        <RequestExpanded
          row={row}
          t={t}
          formatQuantity={formatQuantity}
          formatDateTime={formatDateTime}
          enumText={enumText}
          canResolve={canResolve}
          canPrepare={canPrepare}
          canClaimSelf={canClaimSelf}
          currentUserId={currentUserOption?.id ?? null}
          onResolve={(line) => openResolve(row.id, line)}
          onPrepareTask={(taskId) => prepare(row, taskId)}
          onHandoff={(task) => { setHandoffUser(null); setHandoffReason(''); setHandoffTask(task); }}
          onReturn={(task) => { setReturnReason(''); setReturnTask(task); }}
          onClaimPool={(task) => claimPool.mutate({ taskId: task.id, expectedRowVersion: task.rowVersion })}
        />
      )}
      onRowDoubleClick={(row) => {
        if (activeTab === 'mine' && row.unresolvedLineCount === 0 && (row.myActiveTaskId || row.poolTaskId)) {
          prepare(row, row.myActiveTaskId ?? row.poolTaskId);
        }
        else setDetailId(row.id);
      }}
      toolbarAction={can('WMS.KKD.REQUESTS.CREATE') ? {
        label: t('actions.new'), icon: <Plus className="size-4"/>, run: async () => setCreateOpen(true),
      } : undefined}
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
                className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
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
                className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                options={['Low', 'Normal', 'High', 'Urgent'].map((value) => ({ value, label: enumText('priority', value) }))}
              />
            </div>
          </KkdField>
          <KkdField label={t('create.neededAt')}>
            <AppInput type="datetime-local" value={neededAt} onChange={(event) => setNeededAt(event.target.value)}/>
          </KkdField>
          <KkdField label={t('create.description')}>
            <AppInput value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000}/>
          </KkdField>
        </div>

        <KkdPanel title={t('create.lines')} description={t('create.linesHelp')} icon={<ClipboardList className="size-4" strokeWidth={1.75}/>}>
          <div className="space-y-3">
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

    {detailId ? <ResponsiveDialog onClose={() => { setDetailId(null); setCancelReason(''); }} title={detail.data?.requestNo ?? t('detail.title')} description={t('detail.description')} className="!max-w-6xl">
      {detail.isLoading ? <p>{t('messages.loading')}</p> : detail.isError || !detail.data ? <p className="text-rose-600">{t('messages.detailFailed')}</p> : <RequestDetailView
        value={detail.data} t={t} formatDateTime={formatDateTime} formatQuantity={formatQuantity} enumText={enumText}
        canResolve={canResolve} canAssign={canAssignToOthers} canClaim={canClaimSelf} canCancel={can('WMS.KKD.REQUESTS.CANCEL')} canPrepare={canPrepare}
        warehouseLabel={warehouseLabel} cancelReason={cancelReason} setCancelReason={setCancelReason} cancelling={cancel.isPending}
        onResolve={(line) => openResolve(detail.data!.id, line)}
        onAssign={() => openPrepare(detail.data!)}
        onClaim={() => claimSelf(detail.data!)}
        onCancel={() => cancel.mutate({ id: detail.data!.id, rowVersion: detail.data!.rowVersion })} onPrepare={() => prepare(detail.data!)}/>} 
    </ResponsiveDialog> : null}

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

    {returnTask ? <ResponsiveDialog
      onClose={() => setReturnTask(null)}
      title={t('returnDialog.title')}
      description={t('returnDialog.description', { no: returnTask.taskNo })}
      className="!max-w-lg"
    >
      <div className="space-y-4">
        <KkdField label={t('returnDialog.reason')}>
          <AppInput value={returnReason} onChange={(event) => setReturnReason(event.target.value)} maxLength={1000} autoFocus/>
        </KkdField>
        <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
          <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => setReturnTask(null)}>
            {t('actions.close')}
          </OpsActionButton>
          <OpsActionButton
            type="button" variant="primary" className="wms-ops-list-toolbar-btn"
            disabled={returnWork.isPending || returnReason.trim().length < 3}
            onClick={() => returnWork.mutate()}
          >
            <Undo2 className="size-3.5"/>{t('actions.returnWork')}
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

const ACTIVE_TASK_STATUSES = new Set(['Assigned', 'InPreparation']);

/**
 * Grid satırı genişletildiğinde talebin kalemlerini ve hazırlama görevlerini gösterir.
 * Kalem tarafında stok/beden seçimi, görev tarafında hazırlama / devir / iade aksiyonları sunar.
 */
function RequestExpanded({ row, t, formatQuantity, formatDateTime, enumText, canResolve, canPrepare, canClaimSelf, currentUserId, onResolve, onPrepareTask, onHandoff, onReturn, onClaimPool }: {
  row: KkdRequestRow;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatQuantity: (value: number) => string;
  formatDateTime: (value?: string | null) => string;
  enumText: (scope: string, value: string) => string;
  canResolve: boolean;
  canPrepare: boolean;
  canClaimSelf: boolean;
  currentUserId: number | null;
  onResolve: (line: KkdRequestLine) => void;
  onPrepareTask: (taskId: number) => void;
  onHandoff: (task: KkdPreparationTaskRow) => void;
  onReturn: (task: KkdPreparationTaskRow) => void;
  onClaimPool: (task: KkdPreparationTaskRow) => void;
}): ReactElement {
  const requestId = row.id;
  const detail = useQuery({
    queryKey: ['kkd', 'requests', requestId],
    queryFn: () => kkdApi.requestDetail(requestId),
  });
  const tasks = useQuery({
    queryKey: ['kkd', 'requests', requestId, 'preparation-tasks'],
    queryFn: () => kkdApi.requestPreparationTasks(requestId),
  });
  if (detail.isLoading) return <p className="text-sm text-[var(--wms-app-text-muted)]">{t('messages.loading')}</p>;
  if (detail.isError || !detail.data) return <p className="text-sm text-rose-600">{t('messages.detailFailed')}</p>;
  const assignedLineIds = new Set(
    (tasks.data ?? [])
      .filter((task) => ACTIVE_TASK_STATUSES.has(task.status))
      .flatMap((task) => task.lines.map((line) => line.requestLineId)),
  );
  return (
    <div className="space-y-3">
      <section className="space-y-2">
        <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{t('expanded.lines')}</h4>
        {detail.data.lines.map((line) => (
          <article key={line.id} className={cn('rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface)] p-3', !line.stockId && line.status !== 'Cancelled' && 'border-amber-500/50 bg-amber-500/5')}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <strong className="text-sm">#{line.lineNo} · {line.groupCode}{line.groupName ? ` · ${line.groupName}` : ''}</strong>
                <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
                  {line.stockId ? `${line.stockCode} · ${line.stockName}` : t('detail.stockAwaiting')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--wms-app-text-muted)]">
                  {t('grid.requested')}: <strong>{formatQuantity(line.requestedQuantity)}</strong>
                  {' · '}{t('grid.delivered')}: <strong>{formatQuantity(line.deliveredQuantity)}</strong>
                </span>
                {line.status !== 'Cancelled' && line.status !== 'Completed' ? (
                  assignedLineIds.has(line.id)
                    ? <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-600">{t('expanded.lineAssigned')}</span>
                    : <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-600">{t('expanded.lineUnassigned')}</span>
                ) : null}
                <Status value={line.status} text={enumText('lineStatus', line.status)}/>
                {canResolve && !line.stockId && line.status !== 'Cancelled' && line.allocatedQuantity === 0 && line.deliveredQuantity === 0 ? (
                  <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.selectStock')} aria-label={t('actions.selectStock')} onClick={() => onResolve(line)}>
                    <SearchCheck className="size-3.5"/>
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-2">
        <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{t('expanded.tasks')}</h4>
        {tasks.isLoading ? <p className="text-sm text-[var(--wms-app-text-muted)]">{t('messages.loading')}</p>
          : (tasks.data ?? []).length === 0 ? <p className="text-sm text-[var(--wms-app-text-muted)]">{t('expanded.noTasks')}</p>
          : (tasks.data ?? []).map((task) => {
            const active = ACTIVE_TASK_STATUSES.has(task.status);
            const isPool = task.assignedUserId == null;
            const mine = currentUserId != null && task.assignedUserId === currentUserId;
            const hasProgress = task.lines.some((line) => line.preparedQuantity > 0 || line.deliveredQuantity > 0);
            const unresolved = task.lines.some((line) => !line.stockId && line.lineStatus !== 'Cancelled');
            return (
              <article key={task.id} className={cn(
                'rounded-xl border border-[var(--wms-ops-card-border)] bg-[var(--wms-app-surface)] p-3',
                mine && active && 'border-[var(--wms-brand-primary)]/50 bg-[var(--wms-brand-primary)]/5',
                isPool && active && 'border-cyan-500/40 bg-cyan-500/5',
              )}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="text-sm">{task.taskNo}</strong>
                    <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
                      {isPool ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-cyan-600"><Users className="size-3" aria-hidden/>{t('expanded.taskPool')}</span>
                      ) : t('expanded.taskAssignee', { user: task.assignedUserName })}
                      {task.originUserName ? ` · ${t('expanded.taskOrigin', { user: task.originUserName })}` : ''}
                      {' · '}{formatDateTime(task.assignedAtUtc)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--wms-app-text-muted)]">
                      {task.lines.map((line) => `#${line.lineNo} ${line.groupCode} (${formatQuantity(line.deliveredQuantity)}/${formatQuantity(line.quantity)})`).join(' · ')}
                    </p>
                    {task.closureReason ? <p className="mt-0.5 text-xs text-rose-600">{task.closureReason}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <Status value={task.status === 'Completed' ? 'Completed' : task.status === 'Cancelled' || task.status === 'Returned' ? 'Cancelled' : task.status} text={enumText('taskStatus', task.status)}/>
                    {canClaimSelf && active && isPool ? (
                      <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.claimPool')} aria-label={t('actions.claimPool')} onClick={() => onClaimPool(task)}>
                        <Users className="size-3.5"/>
                      </button>
                    ) : null}
                    {canPrepare && active && mine && !unresolved ? (
                      <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.prepare')} aria-label={t('actions.prepare')} onClick={() => onPrepareTask(task.id)}>
                        <PackageCheck className="size-3.5"/>
                      </button>
                    ) : null}
                    {task.warehouseOutboundId ? (
                      <Link
                        to={`/warehouse/warehouse-outbounds/${task.warehouseOutboundId}/operations`}
                        className="wms-ops-grid-icon-btn"
                        title={t('actions.operation')}
                        aria-label={t('actions.operation')}
                      >
                        <PlayCircle className="size-3.5"/>
                      </Link>
                    ) : null}
                    {canResolve && active && !isPool ? (
                      <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.handoff')} aria-label={t('actions.handoff')} onClick={() => onHandoff(task)}>
                        <ArrowRightLeft className="size-3.5"/>
                      </button>
                    ) : null}
                    {canResolve && active && !isPool && !hasProgress ? (
                      <button type="button" className="wms-ops-grid-icon-btn !text-rose-600" title={t('actions.returnWork')} aria-label={t('actions.returnWork')} onClick={() => onReturn(task)}>
                        <Undo2 className="size-3.5"/>
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
      </section>
    </div>
  );
}

/**
 * Üretim reçete atama tezgâhının KKD karşılığı.
 * Fark: hedef olarak kişi VEYA depo seçilir; depo = o deponun havuzu.
 * Kalem bölme opsiyoneldir (hepsini seçip tek hedefe verebilirsin).
 */
const POOL_GROUP_KEY = 'pool';
type PrepareGroup = { user: ActiveUserOption | null; lineIds: number[] };
type AssignTargetMode = 'user' | 'warehouse';

function PrepareRequestDialog({ target, t, warehouseOptions, formatQuantity, currentUserOption, onClose, onDone }: {
  target: PrepTarget;
  t: (key: string, options?: Record<string, unknown>) => string;
  warehouseOptions: Array<{ value: string; label: string }>;
  formatQuantity: (value: number) => string;
  currentUserOption: ActiveUserOption | null;
  onClose: () => void;
  onDone: () => void;
}): ReactElement {
  const [warehouseId, setWarehouseId] = useState(target.warehouseId ? String(target.warehouseId) : (warehouseOptions[0]?.value ?? ''));
  const [targetMode, setTargetMode] = useState<AssignTargetMode>('user');
  const [groupUser, setGroupUser] = useState<ActiveUserOption | null>(null);
  const [assigneeLookupOpen, setAssigneeLookupOpen] = useState(false);
  const [poolWarehouseId, setPoolWarehouseId] = useState(warehouseId);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<PrepareGroup[]>([]);
  const [didAutoSelect, setDidAutoSelect] = useState(false);

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
  const remainingLines = assignableLines.filter((line) => !groupedIds.has(line.id));
  const allCovered = assignableLines.length > 0 && remainingLines.length === 0;
  const selectedUnassignedCount = remainingLines.filter((line) => selectedLineIds.has(line.id)).length;
  const allUnassignedSelected = remainingLines.length > 0 && selectedUnassignedCount === remainingLines.length;
  const assignedCount = assignableLines.length - remainingLines.length;

  useEffect(() => {
    if (didAutoSelect || remainingLines.length === 0) return;
    setSelectedLineIds(new Set(remainingLines.map((line) => line.id)));
    setDidAutoSelect(true);
  }, [didAutoSelect, remainingLines]);

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
      : new Set(remainingLines.map((line) => line.id)));
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
    const lineIds = remainingLines.filter((line) => selectedLineIds.has(line.id)).map((line) => line.id);
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

  const footerHint = remainingLines.length > 0
    ? t('prepareDialog.remainingLines', { count: remainingLines.length })
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
                    </tr>
                  </thead>
                  <tbody>
                    {remainingLines.map((line) => (
                      <tr
                        key={line.id}
                        className={cn('cursor-pointer', !selectedLineIds.has(line.id) && 'opacity-55')}
                        onClick={() => toggleLine(line.id)}
                      >
                        <td>
                          <OpsSkinCheckbox
                            aria-label={`#${line.lineNo}`}
                            checked={selectedLineIds.has(line.id)}
                            onCheckedChange={() => toggleLine(line.id)}
                          />
                        </td>
                        <td className="font-mono text-xs">{line.lineNo}</td>
                        <td>
                          <div className="font-semibold">{line.groupCode}{line.groupName ? ` · ${line.groupName}` : ''}</div>
                        </td>
                        <td className="wms-ops-gr-detail-lines-table__num">{formatQuantity(line.remainingQuantity)}</td>
                        <td className="wms-ops-gr-detail-lines-table__muted text-xs">
                          {line.stockId ? `${line.stockCode} · ${line.stockName}` : t('detail.stockAwaiting')}
                        </td>
                      </tr>
                    ))}
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
                                  {line.stockId ? `${line.stockCode} · ${line.stockName}` : t('detail.stockAwaiting')}
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
  return (
    <article className="rounded-xl border border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_4%,transparent)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <strong className="text-sm">{t('create.lineNo', { no: index + 1 })}</strong>
        {canRemove ? (
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-500/10"
            onClick={onRemove}
            aria-label={t('actions.removeLine')}
          >
            <Trash2 className="size-4"/>
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem]">
        <KkdField label={t('create.group')}>
          <div className="wms-ops-field-shell w-full min-w-0">
            <PagedAppDropdown
              queryKey={['kkd-request-groups', line.key]}
              fetchPage={kkdApi.entitlementGroupsPaged}
              toOption={(item) => ({
                value: encodeURIComponent(JSON.stringify({ code: item.code, name: item.name })),
                label: `${item.code} · ${item.name}`,
              })}
              value={line.groupCode ? encodeURIComponent(JSON.stringify({ code: line.groupCode, name: line.groupName })) : null}
              selectedOption={line.groupCode ? {
                value: encodeURIComponent(JSON.stringify({ code: line.groupCode, name: line.groupName })),
                label: `${line.groupCode} · ${line.groupName}`,
              } : undefined}
              onValueChange={(value) => {
                const item = value
                  ? JSON.parse(decodeURIComponent(value)) as { code: string; name: string }
                  : { code: '', name: '' };
                onChange({ ...line, groupCode: item.code, groupName: item.name, stockId: null, stockLabel: '' });
              }}
              searchable
              minSearchLength={1}
              portalContainer={null}
              contentClassName={DIALOG_DROPDOWN_CONTENT}
              className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
              placeholder={t('create.groupPlaceholder')}
            />
          </div>
        </KkdField>
        <KkdField label={t('create.stock')} hint={t('create.stockOptional')}>
          <div className="wms-ops-field-shell w-full min-w-0">
            <PagedAppDropdown<KkdStockLookup>
              queryKey={['kkd-request-line-stock', line.key, line.groupCode]}
              fetchPage={(request) => kkdApi.stocksPaged(request, line.groupCode)}
              enabled={Boolean(line.groupCode)}
              toOption={(item) => ({
                value: encodeStock(item),
                label: `${item.code} · ${item.name}`,
                description: item.unitCode,
              })}
              value={line.stockId ? encodeURIComponent(JSON.stringify({ id: line.stockId, label: line.stockLabel })) : null}
              selectedOption={line.stockId ? {
                value: encodeURIComponent(JSON.stringify({ id: line.stockId, label: line.stockLabel })),
                label: line.stockLabel,
              } : undefined}
              onValueChange={(value) => {
                const stock = value ? decodeStock(value) : null;
                onChange({ ...line, stockId: stock?.id ?? null, stockLabel: stock?.label ?? '' });
              }}
              searchable
              minSearchLength={1}
              portalContainer={null}
              contentClassName={DIALOG_DROPDOWN_CONTENT}
              className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
              placeholder={line.groupCode ? t('create.stockPlaceholder') : t('create.selectGroupFirst')}
            />
          </div>
        </KkdField>
        <KkdField label={t('create.quantity')}>
          <AppInput
            type="number"
            min="0.000001"
            step="any"
            value={line.quantity}
            onChange={(event) => onChange({ ...line, quantity: Number(event.target.value) })}
          />
        </KkdField>
      </div>
    </article>
  );
}

function RequestDetailView({ value, t, formatDateTime, formatQuantity, enumText, canResolve, canAssign, canClaim, canCancel, canPrepare,
  warehouseLabel, cancelReason, setCancelReason, cancelling, onResolve, onAssign, onClaim, onCancel, onPrepare }: {
  value: KkdRequestDetail; t: (key: string, options?: Record<string, unknown>) => string;
  formatDateTime: (value?: string | null) => string; formatQuantity: (value: number) => string;
  enumText: (scope: string, value: string) => string; canResolve: boolean; canAssign: boolean; canClaim: boolean; canCancel: boolean; canPrepare: boolean;
  warehouseLabel: (id?: number | null) => string;
  cancelReason: string; setCancelReason: (value: string) => void; cancelling: boolean;
  onResolve: (line: KkdRequestLine) => void; onAssign: () => void; onClaim: () => void; onCancel: () => void; onPrepare: () => void;
}): ReactElement {
  const unresolved = value.lines.some((line) => !line.stockId && line.status !== 'Cancelled');
  const open = !CLOSED.has(value.status);
  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Info label={t('detail.person')} value={`${value.employeeCode} · ${value.employeeName}`}/>
      <Info label={t('detail.departmentRole')} value={`${value.departmentName} · ${value.roleName}`}/>
      <Info label={t('grid.status')} value={enumText('status', value.status)}/>
      <Info label={t('grid.priority')} value={enumText('priority', value.priority)}/>
      <Info label={t('grid.requestedAt')} value={formatDateTime(value.requestedAtUtc)}/>
      <Info label={t('grid.neededAt')} value={formatDateTime(value.neededAtUtc)}/>
      <Info label={t('detail.warehouse')} value={warehouseLabel(value.warehouseId)}/>
      <Info label={t('detail.assignedUser')} value={value.assignedUserId ? t('grid.assigned') : t('grid.unassigned')}/>
    </div>
    {open && (canAssign || (canClaim && !value.assignedUserId)) ? (
      <div className="flex justify-end gap-1.5">
        {canAssign ? (
          <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.assign')} aria-label={t('actions.assign')} onClick={onAssign}>
            <UserRoundCog className="size-3.5" />
          </button>
        ) : null}
        {canClaim && !value.assignedUserId ? (
          <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.claim')} aria-label={t('actions.claim')} onClick={onClaim}>
            <Hand className="size-3.5" />
          </button>
        ) : null}
      </div>
    ) : null}
    <div className="space-y-2">
      {value.lines.map((line) => <article key={line.id} className={cn('rounded-xl border p-3', !line.stockId && 'border-amber-500/50 bg-amber-500/5')}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><strong>#{line.lineNo} · {line.groupCode}{line.groupName ? ` · ${line.groupName}` : ''}</strong>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{line.stockId ? `${line.stockCode} · ${line.stockName}` : t('detail.stockAwaiting')}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Status value={line.status} text={enumText('lineStatus', line.status)}/>
            {canResolve && !line.stockId && line.allocatedQuantity === 0 && line.deliveredQuantity === 0 ? (
              <button type="button" className="wms-ops-grid-icon-btn" title={t('actions.selectStock')} aria-label={t('actions.selectStock')} onClick={() => onResolve(line)}>
                <SearchCheck className="size-3.5"/>
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Info label={t('grid.requested')} value={formatQuantity(line.requestedQuantity)}/>
          <Info label={t('grid.allocated')} value={formatQuantity(line.allocatedQuantity)}/>
          <Info label={t('grid.delivered')} value={formatQuantity(line.deliveredQuantity)}/>
          <Info label={t('detail.remaining')} value={formatQuantity(line.remainingQuantity)}/>
        </div>
      </article>)}
    </div>
    <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-end lg:justify-between">
      {canCancel && open ? <KkdField label={t('detail.cancelReason')} className="w-full lg:max-w-xl"><AppInput value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={t('detail.cancelReasonPlaceholder')}/></KkdField> : <span/>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {canCancel && open ? <button type="button" disabled={cancelling} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-500 px-4 text-rose-600 disabled:opacity-50" onClick={onCancel}><X className="size-4"/>{t('actions.cancel')}</button> : null}
        {canPrepare && !unresolved && open ? <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 font-semibold text-white" onClick={onPrepare}><PackageCheck className="size-4"/>{t('actions.prepare')}</button> : null}
      </div>
    </div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }): ReactElement {
  return <div className="rounded-lg border border-[var(--wms-ops-card-border)] p-2.5"><span className="block text-[0.68rem] uppercase tracking-wide text-[var(--wms-app-text-muted)]">{label}</span><strong className="mt-1 block break-words text-sm">{value}</strong></div>;
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
