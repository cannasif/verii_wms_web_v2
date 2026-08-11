import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, FileText, PackageOpen, Plus, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme-provider';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsListPageShell } from '@/components/shared/OpsListPageShell';
import { OpsListSearchField } from '@/components/shared/OpsListSearchField';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { GridExportMenu } from '@/components/shared/GridExportMenu';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { buildTerminalEyebrowFromNav } from '@/components/shared/PremiumEyebrow';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { appendFoldedSearchToken, foldTurkishSearch } from '@/lib/turkish-search';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { productionTransferApi, type ProductionTransferPolicy, type ProductionWorkOrderTransferTab } from '@/features/production-transfer/api';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { ActiveUserOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import type { PagedResponse } from '@/types/api';
import { productionApi } from './api';
import type { ProductionSourceWorkOrder, PreparedNetsisProductionMaterial, PreparedNetsisProductionWorkOrder } from './types';
import {
  ProductionWorkOrderTransferTabPanel,
  PRODUCTION_WORK_ORDER_TRANSFER_TABS,
  isProductionWorkOrderPageTab,
  type ProductionWorkOrderPageTab,
} from './components/ProductionWorkOrderTransferTabPanel';
import { ProductionWorkOrderAssignmentCancelDialog } from './components/ProductionWorkOrderAssignmentDialogs';
import { WorkOrderAssignmentProgressRing } from './components/WorkOrderAssignmentProgressRing';

const todayIsoDate = (): string => new Date().toLocaleDateString('en-CA');

async function buildAutoCompleteProductionTransferPayload(
  workOrder: PreparedNetsisProductionWorkOrder,
  materials: PreparedNetsisProductionMaterial[],
  assignee: ActiveUserOption,
  branchCode: string,
): Promise<unknown> {
  const series = await warehouseTransferApi.series('ProductionTransfer');
  const preferred = series.find((row) => row.isDefault) ?? series[0];
  if (!preferred) throw new Error('Üretim transfer belge serisi bulunamadı.');

  if (!workOrder.sourceWarehouseId || !workOrder.targetWarehouseId) {
    throw new Error('Kaynak veya hedef depo bilgisi eksik.');
  }

  let defaultTargetLocationId: number | null = null;
  try {
    const defaultTarget = await productionTransferApi.defaultTargetLocation(workOrder.sourceWarehouseId, branchCode);
    defaultTargetLocationId = defaultTarget.locationId ?? null;
  } catch {
    // Varsayılan hedef raf yoksa satırlar boş hedef rafla oluşturulur; backend politikası uygulanır.
  }

  const preparedLines = await Promise.all(materials.map(async (material) => {
    if (!material.stockId) throw new Error(`${material.stockCode} stok eşlemesi eksik.`);
    const trackingPolicy = await warehouseTransferApi.trackingPolicy(branchCode, material.stockId);
    return {
      stockId: material.stockId,
      yapCodeId: material.yapCodeId ?? null,
      quantity: material.requiredQuantity,
      unitCode: material.unitCode.trim(),
      trackingType: trackingPolicy.trackingType,
      requireHandlingUnit: false,
      defaultSourceLocationId: null,
      defaultTargetLocationId: defaultTargetLocationId,
      description: null,
      trackings: [],
      source: null,
    };
  }));

  return {
    autoAssignSources: true,
    transfer: {
      autoAssignSources: true,
      idempotencyKey: crypto.randomUUID(),
      branchCode,
      documentSeriesId: preferred.id,
      documentDate: todayIsoDate(),
      initiationMode: 'StockBasedTask',
      processType: 'InternalRequest',
      sourceWarehouseId: workOrder.sourceWarehouseId,
      targetWarehouseId: workOrder.targetWarehouseId,
      sourceStagingLocationId: null,
      targetReceivingLocationId: null,
      targetPutawayLocationId: null,
      plannedDispatchAtUtc: null,
      plannedArrivalAtUtc: null,
      priority: 3,
      projectCode: workOrder.projectCode?.trim() || null,
      externalReferenceNo: workOrder.workOrderNumber,
      description: `${workOrder.sourceSystemCode} ${workOrder.workOrderNumber} iş emri reçetesinden otomatik tamamlandı.`,
      lines: preparedLines,
      assignedUserIds: [assignee.id],
    },
    purpose: 'MaterialSupply',
    productionHeaderId: workOrder.existingProductionHeaderId ?? null,
    productionOrderId: workOrder.existingProductionOrderId ?? null,
    productionOperationId: null,
    productionPlanNo: null,
    productionOrderNo: workOrder.workOrderNumber,
    productionOperationCode: null,
    sourceWorkCenterCode: null,
    targetWorkCenterCode: null,
    triggeredByProduction: true,
    autoGenerated: false,
    requiredForOrderStart: true,
    requiredForOrderCompletion: false,
    lineContexts: materials.map((material, lineIndex) => ({
      lineIndex,
      lineRole: 'ConsumptionSupply',
      productionConsumptionId: null,
      productionOutputId: null,
      requirementReference: `${workOrder.workOrderNumber}#${material.operationNumber}`,
      requiredQuantity: material.requiredQuantity,
    })),
  };
}

const userDisplayName = (user: ActiveUserOption): string =>
  `${user.firstName} ${user.lastName}`.trim() || user.username;

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

const PAGE_DESCRIPTION = 'Şube politikasında seçilen kaynaktaki iş emrini ve reçetesini inceleyin; mevcut üretim transfer akışına aktarın.';

type DateSort = 'asc' | 'desc';

const CELL =
  'border-r border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-2 py-2 text-center align-middle last:border-r-0';

const HEAD_CELL = cn(
  CELL,
  'border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-ops-card-border))] bg-[var(--wms-ops-card-bg)] font-semibold uppercase tracking-wide text-[0.68rem] text-[var(--wms-app-text-muted)]',
);

const RECIPE_EXPORT_COLUMNS = [
  { key: 'lineNo', label: 'Sıra' },
  { key: 'stockCode', label: 'Stok kodu' },
  { key: 'stockName', label: 'Stok adı' },
  { key: 'unitCode', label: 'Birim' },
  { key: 'operationNumber', label: 'Operasyon no' },
  { key: 'recipeQuantity', label: 'Reçete miktarı' },
  { key: 'wasteQuantity', label: 'Fire miktarı' },
  { key: 'requiredQuantity', label: 'Toplam ihtiyaç' },
  { key: 'mappingStatus', label: 'Eşleme durumu' },
];

/**
 * Başlıktaki özet hücreleri, dialog panelinin skin DNA'sını kullanır:
 * terminal'de köşesiz accent çerçeve, premium'da yuvarlak cam kart.
 */
const HEADER_CARD_CLASS = 'wms-ops-detail-panel !px-3 !py-2 max-sm:!px-2.5 max-sm:!py-1.5';

/** Dialog CSS'i aksiyon butonlarına 2.75rem yükseklik dayatıyor; mobilde bunu kırıp kompakt tutar. */
const MODAL_CTA_CLASS =
  'max-sm:w-full max-sm:!min-h-9 max-sm:!gap-1.5 max-sm:!px-3 max-sm:!text-[0.62rem]';

type AssigneeRecipeGroup = {
  assignee: ActiveUserOption;
  lineIndices: number[];
};

/** Mobil kartlarda etiket/değer; hem liste hem dialog kapsamında çalışsın diye dialog'a scope'lu CSS yerine utility kullanır. */
function CardStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }): ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-app-text-muted)]">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-sm font-semibold', accent && 'text-[var(--wms-brand-primary)]')}>{value}</dd>
    </div>
  );
}

function allMaterialIndices(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function mergeAssigneeGroup(
  groups: AssigneeRecipeGroup[],
  assignee: ActiveUserOption,
  lineIndices: number[],
): AssigneeRecipeGroup[] {
  const existingIndex = groups.findIndex((group) => group.assignee.id === assignee.id);
  const sorted = [...lineIndices].sort((left, right) => left - right);
  if (existingIndex < 0) return [...groups, { assignee, lineIndices: sorted }];

  const merged = new Set([...groups[existingIndex].lineIndices, ...sorted]);
  return groups.map((group, index) => (index === existingIndex
    ? { ...group, lineIndices: [...merged].sort((left, right) => left - right) }
    : group));
}

function AssigneeGroupMaterialsPanel({
  group,
  materials,
  onRemoveLine,
}: {
  group: AssigneeRecipeGroup;
  materials: PreparedNetsisProductionMaterial[];
  onRemoveLine: (assigneeId: number, lineIndex: number) => void;
}): ReactElement {
  return (
    <section className="mt-5 border-t border-[color-mix(in_oklab,var(--wms-ops-accent)_14%,var(--wms-app-border))] pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-[var(--wms-app-text)]">
          {userDisplayName(group.assignee)}
          <span className="ml-2 text-xs font-semibold text-[var(--wms-app-text-muted)]">
            · {group.lineIndices.length} bileşen · kayda hazır
          </span>
        </h4>
      </div>

      <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto max-sm:hidden">
        <table className="wms-ops-gr-detail-lines-table w-full min-w-[880px] text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Bileşen</th>
              <th>Birim</th>
              <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
              <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
              <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
              <th className="w-24">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {group.lineIndices.map((index, rowNumber) => {
              const row = materials[index];
              return (
                <tr key={`${group.assignee.id}-${materialRowKey(row, index)}`}>
                  <td>{rowNumber + 1}</td>
                  <td>
                    <strong>{row.stockCode}</strong>
                    <div className="text-xs">{row.stockName}</div>
                  </td>
                  <td>{row.unitCode}</td>
                  <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.recipeQuantity)}</td>
                  <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.wasteQuantity)}</td>
                  <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.requiredQuantity)}</td>
                  <td>
                    <button
                      type="button"
                      title="Atamadan kaldır"
                      aria-label={`${row.stockCode} bileşenini atamadan kaldır`}
                      onClick={() => onRemoveLine(group.assignee.id, index)}
                      className="inline-flex size-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {group.lineIndices.map((index) => {
          const row = materials[index];
          return (
            <article
              key={`${group.assignee.id}-${materialRowKey(row, index)}-card`}
              className="wms-ops-detail-panel overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))] px-3 py-2.5">
                <div className="min-w-0">
                  <strong className="block text-sm">{row.stockCode}</strong>
                  <div className="truncate text-xs">{row.stockName}</div>
                </div>
                <button
                  type="button"
                  title="Atamadan kaldır"
                  aria-label={`${row.stockCode} bileşenini atamadan kaldır`}
                  onClick={() => onRemoveLine(group.assignee.id, index)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
                <CardStat label="Birim" value={row.unitCode} />
                <CardStat label="Reçete" value={formatProjectNumber(row.recipeQuantity)} />
                <CardStat label="Fire" value={formatProjectNumber(row.wasteQuantity)} />
                <CardStat label="Toplam ihtiyaç" value={formatProjectNumber(row.requiredQuantity)} accent />
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TransferredMaterialsPanel({
  materials,
  fadedRowClass,
}: {
  materials: PreparedNetsisProductionMaterial[];
  fadedRowClass: string;
}): ReactElement {
  return (
    <section className="mt-5 border-t border-[color-mix(in_oklab,var(--wms-ops-accent)_14%,var(--wms-app-border))] pt-4">
      <h4 className="mb-3 text-sm font-bold text-[var(--wms-app-text-muted)]">
        Transfer edilmiş bileşenler
        <span className="ml-2 text-xs font-semibold">({materials.length})</span>
      </h4>

      <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto max-sm:hidden">
        <table className="wms-ops-gr-detail-lines-table w-full min-w-[880px] text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Bileşen</th>
              <th>Birim</th>
              <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
              <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
              <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((row, index) => (
              <tr key={`transferred-${materialRowKey(row, index)}`} className={fadedRowClass}>
                <td>{index + 1}</td>
                <td>
                  <strong>{row.stockCode}</strong>
                  <div className="text-xs">{row.stockName}</div>
                </td>
                <td>{row.unitCode}</td>
                <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.recipeQuantity)}</td>
                <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.wasteQuantity)}</td>
                <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.requiredQuantity)}</td>
                <td><span className="text-xs">Transfer edildi</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {materials.map((row, index) => (
          <article
            key={`transferred-${materialRowKey(row, index)}-card`}
            className={cn('wms-ops-detail-panel overflow-hidden', fadedRowClass)}
          >
            <div className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))] px-3 py-2.5">
              <strong className="block text-sm">{row.stockCode}</strong>
              <div className="truncate text-xs">{row.stockName}</div>
              <div className="mt-1 text-xs">Transfer edildi</div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
              <CardStat label="Birim" value={row.unitCode} />
              <CardStat label="Toplam ihtiyaç" value={formatProjectNumber(row.requiredQuantity)} accent />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function materialRowKey(material: PreparedNetsisProductionMaterial, index: number): string {
  return `${material.stockCode}-${material.operationNumber}-${index}`;
}

const isCancellationReturnRemainderContext = (
  row: Pick<ProductionSourceWorkOrder | PreparedNetsisProductionWorkOrder, 'listingKind' | 'transferId' | 'kalanTaskId'>,
): boolean =>
  row.listingKind === 'CancellationReturnRemainder'
  || (Number.isFinite(row.transferId) && (row.transferId ?? 0) > 0
    && Number.isFinite(row.kalanTaskId) && (row.kalanTaskId ?? 0) > 0);

/** Aynı iş emri numarası farklı kaynaklarda tekrar edebildiği için satır kimliği kaynakla birlikte kurulur. */
const workOrderKey = (row: ProductionSourceWorkOrder): string =>
  isCancellationReturnRemainderContext(row)
    ? `${row.sourceType}:${row.sourceSystemCode}:${row.workOrderNumber}:cancel:${row.transferId ?? 0}:${row.kalanTaskId ?? 0}`
    : `${row.sourceType}:${row.sourceSystemCode}:${row.workOrderNumber}`;

const sourceListingKindLabel = (kind: ProductionSourceWorkOrder['listingKind']): string => {
  if (kind === 'CancellationReturnRemainder') return 'Transfer iadesi';
  if (kind === 'ManagerCancelledAssignment') return 'İptal edildi';
  if (kind === 'RestoredCancelledAssignment') return 'İş emri';
  return 'İş emri';
};

const sourceListingKindBadgeClass = (kind: ProductionSourceWorkOrder['listingKind']): string => {
  if (kind === 'CancellationReturnRemainder') return 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300';
  if (kind === 'ManagerCancelledAssignment') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (kind === 'RestoredCancelledAssignment') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
  return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
};

function SourceListingKindBadge({ row }: { row: ProductionSourceWorkOrder }): ReactElement {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide', sourceListingKindBadgeClass(row.listingKind))}>
      {sourceListingKindLabel(row.listingKind)}
    </span>
  );
}

function matchesSearch(row: ProductionSourceWorkOrder, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = foldTurkishSearch([
    row.workOrderNumber,
    row.stockCode,
    row.stockName ?? '',
    row.sourceSystemCode,
    sourceListingKindLabel(row.listingKind),
  ].join(' '));
  return terms.every((term) => {
    const folded = foldTurkishSearch(term);
    return !folded || haystack.includes(folded);
  });
}

function dateValue(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function ProductionWorkOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { skin } = useTheme();
  const { can } = usePermissionAccess();
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const isPremium = skin === 'premium';
  const [policy, setPolicy] = useState<ProductionTransferPolicy>();
  const [searchInput, setSearchInput] = useState('');
  const [searchTokens, setSearchTokens] = useState<string[]>([]);
  const [activeSearch, setActiveSearch] = useState<string[]>([]);
  const [rows, setRows] = useState<ProductionSourceWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PreparedNetsisProductionWorkOrder>();
  const [detailLoading, setDetailLoading] = useState<string>();
  const [dateSort, setDateSort] = useState<DateSort>('desc');
  const [activeTab, setActiveTab] = useState<ProductionWorkOrderPageTab>(() => {
    const tab = searchParams.get('tab');
    return isProductionWorkOrderPageTab(tab) ? tab : 'pending';
  });
  const [visitedTabs, setVisitedTabs] = useState<Set<ProductionWorkOrderPageTab>>(() => {
    const tab = searchParams.get('tab');
    const initial = isProductionWorkOrderPageTab(tab) ? tab : 'pending';
    return new Set([initial]);
  });
  const [transferRefreshKeys, setTransferRefreshKeys] = useState<Partial<Record<ProductionWorkOrderPageTab, number>>>({});
  const [cancelTarget, setCancelTarget] = useState<ProductionSourceWorkOrder>();
  const canCancelAssignment = can('WMS.PRODUCTION_TRANSFER.CANCEL');
  const eyebrow = buildTerminalEyebrowFromNav(pathname, t, i18n.resolvedLanguage ?? i18n.language) ?? 'VERII WMS';
  const activeTabIndex = PRODUCTION_WORK_ORDER_TRANSFER_TABS.findIndex((tab) => tab.key === activeTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isProductionWorkOrderPageTab(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setVisitedTabs((current) => {
      if (current.has(activeTab)) return current;
      return new Set(current).add(activeTab);
    });
  }, [activeTab]);

  const loadPending = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      setRows(await productionApi.sourceWorkOrders(term));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Üretim iş emirleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadPending();
  }, [loadPending]);
  useEffect(() => { void productionTransferApi.policy(branchCode).then(setPolicy).catch((error: Error) => toast.error(error.message)); }, [branchCode]);

  // Rozet varken serbest metin aramaya karışmaz; rozetsizken yazarken canlı aranır.
  useEffect(() => {
    if (searchTokens.length > 0) {
      setActiveSearch(searchTokens);
      return;
    }
    const timer = window.setTimeout(() => {
      const term = searchInput.trim();
      setActiveSearch(term ? [term] : []);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchTokens]);

  // Servis en fazla 200 kayıt döndürdüğü için rozet eklenirken sunucu tarafında da aranır.
  const commitSearchToken = () => {
    const term = searchInput.trim();
    setSearchTokens((current) => appendFoldedSearchToken(current, searchInput));
    if (term) setSearchInput('');
    if (activeTab === 'pending') void loadPending(term || undefined);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTokens([]);
    setActiveSearch([]);
    if (activeTab === 'pending') void loadPending();
  };

  const refreshActiveTab = () => {
    if (activeTab === 'pending') void loadPending(activeSearch[0] || undefined);
    else setTransferRefreshKeys((current) => ({
      ...current,
      [activeTab]: (current[activeTab] ?? 0) + 1,
    }));
  };

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      row.listingKind !== 'ManagerCancelledAssignment' && matchesSearch(row, activeSearch));
    return [...filtered].sort((a, b) => {
      const delta = dateValue(a.workOrderDate) - dateValue(b.workOrderDate);
      return dateSort === 'asc' ? delta : -delta;
    });
  }, [rows, activeSearch, dateSort]);

  const open = async (row: ProductionSourceWorkOrder) => {
    setDetailLoading(workOrderKey(row));
    try { setSelected(await productionApi.prepareSourceWorkOrder(row)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'İş emri reçetesi hazırlanamadı.'); }
    finally { setDetailLoading(undefined); }
  };

  const sourceLabel = policy?.productionOrderSource === 'ErpAndWms'
    ? `Netsis ERP + ${policy.wmsSourceSystemCode}`
    : policy?.productionOrderSource === 'WmsIntegrationTables' ? policy.wmsSourceSystemCode : 'Netsis ERP';

  const toggleDateSort = () => setDateSort((current) => (current === 'asc' ? 'desc' : 'asc'));

  const title = (
    <span className="inline-flex items-center gap-2">
      Üretime Transfer İş Emirleri
      {isPremium ? (
        <TooltipProvider delayDuration={160}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="wms-ops-gr-page-hero__hint" aria-label="Sayfa bilgilendirmesi">
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
                  <span className="size-1.5 rounded-full bg-[var(--wms-ops-accent)] shadow-[0_0_8px_var(--wms-ops-accent)]" aria-hidden />
                  Bilgilendirme
                </span>
              </div>
              <p className="px-3.5 py-3 text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">{PAGE_DESCRIPTION}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );

  return <>
    <OpsListPageShell
      eyebrow={eyebrow}
      title={title}
      description={isPremium ? undefined : PAGE_DESCRIPTION}
      actions={(
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center justify-end gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-app-text-muted)]">
            <span>Kaynak</span>
            <OpsCodeBadge>{sourceLabel}</OpsCodeBadge>
          </div>
          {can('WMS.PRODUCTION_TRANSFER.CREATE') ? (
            <OpsActionButton
              variant="primary"
              // Taslak sayfası varsayılan olarak plansız/manuel (StockBased) emirli akışla açılır.
              onClick={() => navigate('/warehouse/production-transfers/new')}
            >
              <Plus className="size-3.5" aria-hidden />
              Yeni kayıt
            </OpsActionButton>
          ) : null}
        </div>
      )}
    >
      <div className="wms-ops-data-grid min-w-0 space-y-0">
        <div className="wms-ops-production-work-order-tabs wms-ops-detail-dialog mb-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ProductionWorkOrderPageTab)}
          >
            <TabsList
              className={cn(
                'w-full',
                'wms-ops-detail-main-tabs',
                'wms-ops-detail-main-tabs--cols-5',
              )}
              data-active-index={Math.max(activeTabIndex, 0)}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
              {PRODUCTION_WORK_ORDER_TRANSFER_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="wms-ops-detail-main-tab">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div hidden={activeTab !== 'pending'}>
        <div className="wms-ops-data-grid-toolbar flex flex-wrap items-start justify-between gap-2">
          <div className="wms-ops-data-grid-toolbar__start flex min-w-0 !grow flex-wrap items-start gap-2">
            <div className="wms-ops-grid-search wms-ops-grid-search--tokens" data-no-auto-localize="true">
              <OpsListSearchField
                value={searchInput}
                placeholder="İş emri veya mamul ara..."
                title="Enter ile rozet ekleyin"
                onValueChange={setSearchInput}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitSearchToken();
                }}
                className="!w-full !max-w-none"
                rightSlot={searchInput || searchTokens.length > 0 ? (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onClick={clearSearch}
                    className="wms-ops-voice-btn grid place-items-center"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined}
              />
              {searchTokens.length > 0 ? (
                <div className="wms-ops-grid-search__chips" aria-label="Aktif arama rozetleri">
                  {searchTokens.map((token) => (
                    <span key={token} className="wms-ops-grid-search__chip">
                      <span className="wms-ops-grid-search__chip-text">{token}</span>
                      <button
                        type="button"
                        className="wms-ops-grid-search__chip-remove"
                        onClick={() => setSearchTokens((current) => current.filter((item) => item !== token))}
                        aria-label={`${token} rozetini kaldır`}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="wms-ops-grid-search__clear" onClick={clearSearch}>
                    Rozetleri temizle
                  </button>
                </div>
              ) : null}
            </div>
            <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" onClick={commitSearchToken} disabled={loading}>
              <Search className="size-3.5" aria-hidden />
              <span>Ara</span>
            </OpsActionButton>
            <OpsActionButton
              variant="secondary"
              className="wms-ops-list-toolbar-btn"
              onClick={refreshActiveTab}
              disabled={loading}
              title="Atanmayan iş emirlerini yenile"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} aria-hidden />
              <span className="hidden md:inline">Yenile</span>
            </OpsActionButton>
          </div>
        </div>

        <>
        {/* Skin'in tablo sarmalayıcı sınıfları yatay kaydırmayı zorunlu kıldığı için burada kullanılmaz; kolonlar sığıyor. */}
        <div className="wms-ops-scrollbar relative mt-4 block max-h-[max(20rem,calc(100dvh-26rem))] overflow-x-auto overflow-y-auto border border-[var(--wms-ops-card-border)] max-sm:hidden">
          <table className="wms-ops-data-grid w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--wms-ops-card-bg)] shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-ops-card-border))]">
              <tr>
                <th className={HEAD_CELL}>İş emri</th>
                <th className={HEAD_CELL}>Tür</th>
                <th className={HEAD_CELL}>Mamul</th>
                <th className={HEAD_CELL}>Miktar / birim</th>
                <th className={HEAD_CELL}>
                  <button
                    type="button"
                    onClick={toggleDateSort}
                    className="inline-flex items-center justify-center gap-1.5 font-semibold uppercase tracking-wide"
                    title={dateSort === 'asc' ? 'Tarihe göre artan (tıkla: azalan)' : 'Tarihe göre azalan (tıkla: artan)'}
                    aria-label="Tarihe göre sırala"
                  >
                    Tarih
                    {dateSort === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                  </button>
                </th>
                <th className={HEAD_CELL}>Proje</th>
                <th className={HEAD_CELL}>Depo akışı</th>
                <th className={HEAD_CELL} aria-label="İşlem" />
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wms-ops-grid-state-cell">
                    <OpsLoadingState message="İş emirleri yükleniyor…" code="FETCH" compact />
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState message={activeSearch.length > 0 ? 'Aramaya uygun açık iş emri bulunamadı.' : 'Seçili kaynakta transfere hazır açık iş emri bulunamadı.'} />
                  </td>
                </tr>
              ) : visibleRows.map((row) => (
                <tr key={workOrderKey(row)} onClick={() => void open(row)} className="cursor-pointer">
                  <td className={cn(CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                    <div className="flex items-center justify-center gap-2">
                      <span>{row.workOrderNumber}</span>
                      <WorkOrderAssignmentProgressRing row={row} />
                    </div>
                  </td>
                  <td className={CELL}>
                    <SourceListingKindBadge row={row} />
                    {row.listingKind !== 'CancellationReturnRemainder' && row.revisionNumber > 1 ? (
                      <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Rev. {row.revisionNumber}</div>
                    ) : null}
                  </td>
                  <td className={CELL}>
                    <strong className="block">{row.stockCode}</strong>
                    <div className="mx-auto max-w-80 truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                  </td>
                  <td className={cn(CELL, 'font-bold')}>{formatProjectNumber(row.workOrderQuantity)} {row.unitCode ?? ''}</td>
                  <td className={CELL}>{formatProjectDate(row.workOrderDate)}</td>
                  <td className={CELL}>{row.projectCode || '—'}</td>
                  <td className={CELL}>{row.issueWarehouseCode} → {row.warehouseCode}</td>
                  <td className={CELL}>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <OpsActionButton
                        variant="secondary"
                        className="wms-ops-list-toolbar-btn"
                        loading={detailLoading === workOrderKey(row)}
                        onClick={(event) => {
                          event.stopPropagation();
                          void open(row);
                        }}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        <span>Reçeteyi aç</span>
                      </OpsActionButton>
                      {canCancelAssignment ? (
                        <OpsActionButton
                          variant="secondary"
                          className="wms-ops-list-toolbar-btn !border-rose-500/30 !text-rose-600 dark:!text-rose-300"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCancelTarget(row);
                          }}
                        >
                          <Ban className="size-3.5" aria-hidden />
                          <span>İptal</span>
                        </OpsActionButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3 sm:hidden" aria-live="polite">
          {loading && rows.length === 0 ? (
            <div className="border border-[color-mix(in_oklab,var(--wms-ops-accent)_28%,transparent)] p-4">
              <OpsLoadingState message="İş emirleri yükleniyor…" code="FETCH" compact />
            </div>
          ) : visibleRows.length === 0 ? (
            <OpsGridEmptyState message={activeSearch.length > 0 ? 'Aramaya uygun açık iş emri bulunamadı.' : 'Seçili kaynakta transfere hazır açık iş emri bulunamadı.'} />
          ) : (
            <>
              <button
                type="button"
                onClick={toggleDateSort}
                className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--wms-brand-primary)]"
              >
                Tarih {dateSort === 'asc' ? 'artan' : 'azalan'}
                {dateSort === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
              </button>
              {visibleRows.map((row) => (
                <article key={`${workOrderKey(row)}-card`} className="overflow-hidden border border-[var(--wms-ops-card-border)] bg-[var(--wms-ops-card-bg)]">
                  <div className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 font-mono text-sm font-black text-[var(--wms-brand-primary)]">
                        <span className="truncate">{row.workOrderNumber}</span>
                        <WorkOrderAssignmentProgressRing row={row} />
                      </div>
                      <SourceListingKindBadge row={row} />
                    </div>
                    <strong className="mt-1 block text-sm">{row.stockCode}</strong>
                    <div className="truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
                    <CardStat label="Miktar" value={`${formatProjectNumber(row.workOrderQuantity)} ${row.unitCode ?? ''}`} />
                    <CardStat label="Tarih" value={formatProjectDate(row.workOrderDate)} />
                    <CardStat label="Proje" value={row.projectCode || '—'} />
                    <CardStat label="Depo akışı" value={`${row.issueWarehouseCode} → ${row.warehouseCode}`} />
                  </dl>
                  <div className="border-t border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-3 py-2.5">
                    <div className="flex flex-col gap-2">
                      <OpsActionButton
                        variant="secondary"
                        className="wms-ops-list-toolbar-btn w-full"
                        loading={detailLoading === workOrderKey(row)}
                        onClick={() => void open(row)}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        <span>Reçeteyi aç</span>
                      </OpsActionButton>
                      {canCancelAssignment ? (
                        <OpsActionButton
                          variant="secondary"
                          className="wms-ops-list-toolbar-btn w-full !border-rose-500/30 !text-rose-600 dark:!text-rose-300"
                          onClick={() => setCancelTarget(row)}
                        >
                          <Ban className="size-3.5" aria-hidden />
                          <span>İptal</span>
                        </OpsActionButton>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
        </>
        </div>

        {PRODUCTION_WORK_ORDER_TRANSFER_TABS
          .filter((tab): tab is typeof PRODUCTION_WORK_ORDER_TRANSFER_TABS[number] & { apiTab: ProductionWorkOrderTransferTab } => 'apiTab' in tab)
          .map((tabDef) => (
            visitedTabs.has(tabDef.key) ? (
              <ProductionWorkOrderTransferTabPanel
                key={tabDef.key}
                tab={tabDef.apiTab}
                hidden={activeTab !== tabDef.key}
                refreshKey={transferRefreshKeys[tabDef.key] ?? 0}
                onPendingQueueChanged={() => void loadPending(activeSearch[0] || undefined)}
              />
            ) : null
          ))}
      </div>
    </OpsListPageShell>
    {selected && (
      <WorkOrderDrawer
        value={selected}
        branchCode={branchCode}
        close={() => setSelected(undefined)}
        onTransferCreated={() => {
          void loadPending();
          setTransferRefreshKeys((current) => ({
            ...current,
            picking: (current.picking ?? 0) + 1,
          }));
        }}
        canCreateTransfer={can('WMS.PRODUCTION_TRANSFER.CREATE')}
      />
    )}
    {cancelTarget ? (
      <ProductionWorkOrderAssignmentCancelDialog
        row={cancelTarget}
        onClose={() => setCancelTarget(undefined)}
        onCompleted={() => {
          setCancelTarget(undefined);
          void loadPending(activeSearch[0] || undefined);
          setTransferRefreshKeys((current) => ({
            ...current,
            cancelled: (current.cancelled ?? 0) + 1,
          }));
        }}
      />
    ) : null}
  </>;
}

function WorkOrderDrawer({
  value,
  branchCode,
  close,
  onTransferCreated,
  canCreateTransfer,
}: {
  value: PreparedNetsisProductionWorkOrder;
  branchCode: string;
  close: () => void;
  onTransferCreated?: () => void;
  canCreateTransfer: boolean;
}): ReactElement {
  const blocked = value.mappingErrors.length > 0 || value.isClosed;
  const alreadyImported = Boolean(value.existingProductionOrderId);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [assignee, setAssignee] = useState<ActiveUserOption | null>(null);
  const [assigneeLookupOpen, setAssigneeLookupOpen] = useState(false);
  const [assigneeHintOpen, setAssigneeHintOpen] = useState(false);
  const [completingTransfer, setCompletingTransfer] = useState(false);
  const [unassignedLines, setUnassignedLines] = useState<ReadonlySet<number>>(
    () => new Set(allMaterialIndices(value.materials.length)),
  );
  const [assigneeGroups, setAssigneeGroups] = useState<AssigneeRecipeGroup[]>([]);
  const [selectedUnassigned, setSelectedUnassigned] = useState<ReadonlySet<number>>(
    () => new Set(allMaterialIndices(value.materials.length)),
  );

  useEffect(() => {
    setUnassignedLines(new Set(allMaterialIndices(value.materials.length)));
    setAssigneeGroups([]);
    setSelectedUnassigned(new Set(allMaterialIndices(value.materials.length)));
    setAssignee(null);
  }, [value]);

  const unassignedList = useMemo(
    () => [...unassignedLines].sort((left, right) => left - right),
    [unassignedLines],
  );
  const selectedUnassignedCount = selectedUnassigned.size;
  const allUnassignedSelected = unassignedList.length > 0 && selectedUnassignedCount === unassignedList.length;
  const assignedCount = value.materials.length - unassignedLines.size;
  const transferredAssignedMaterials = value.assignedMaterials ?? [];
  const hasAssignedPreview = transferredAssignedMaterials.length > 0 || assigneeGroups.length > 0;
  const FADED_ASSIGNED_ROW_CLASS = 'opacity-45 text-[var(--wms-app-text-muted)]';

  const toggleUnassignedLine = (index: number): void =>
    setSelectedUnassigned((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const toggleAllUnassigned = (): void =>
    setSelectedUnassigned(allUnassignedSelected ? new Set() : new Set(unassignedList));

  const assignSelectedLines = (): void => {
    if (!assignee || selectedUnassignedCount === 0) return;
    const indices = [...selectedUnassigned].filter((index) => unassignedLines.has(index));
    if (indices.length === 0) return;

    setUnassignedLines((current) => {
      const next = new Set(current);
      indices.forEach((index) => next.delete(index));
      return next;
    });
    setAssigneeGroups((current) => mergeAssigneeGroup(current, assignee, indices));
    setSelectedUnassigned(new Set());
  };

  const removeAssignedLine = (assigneeId: number, lineIndex: number): void => {
    setAssigneeGroups((current) => current
      .map((group) => group.assignee.id === assigneeId
        ? { ...group, lineIndices: group.lineIndices.filter((index) => index !== lineIndex) }
        : group)
      .filter((group) => group.lineIndices.length > 0));
    setUnassignedLines((current) => new Set([...current, lineIndex]));
    setSelectedUnassigned((current) => new Set([...current, lineIndex]));
  };

  const footerHint = blocked || !canCreateTransfer
    ? null
    : assigneeGroups.length === 0
      ? unassignedLines.size > 0
        ? 'Kayıt için en az bir atama grubu oluşturun.'
        : 'Atanacak kalan bileşen bulunmuyor.'
      : unassignedLines.size > 0
        ? `${assigneeGroups.length} atama grubu kaydedilecek; ${unassignedLines.size} bileşen iş emrinde kalan olarak kalacak.`
        : selectedUnassignedCount > 0 && !assignee
          ? 'Seçili satırları atamak için depo çalışanı seçin.'
          : null;

  const recipeExportRows = value.materials.map((material, index) => ({
    lineNo: index + 1,
    stockCode: material.stockCode,
    stockName: material.stockName ?? '',
    unitCode: material.unitCode,
    operationNumber: material.operationNumber,
    recipeQuantity: material.recipeQuantity,
    wasteQuantity: material.wasteQuantity,
    requiredQuantity: material.requiredQuantity,
    mappingStatus: material.mappingError ?? 'Hazır',
  }));
  const recipeExportFileName = `Recete_${value.workOrderNumber.replace(/[^\p{L}\p{N}._-]+/gu, '_')}`;

  const completeAssignments = async (): Promise<void> => {
    if (blocked || !canCreateTransfer || assigneeGroups.length === 0) return;
    const remainingCount = unassignedLines.size;
    setCompletingTransfer(true);
    try {
      const createdDocs: string[] = [];
      for (const group of assigneeGroups) {
        const materials = group.lineIndices.map((index) => value.materials[index]);
        const payload = await buildAutoCompleteProductionTransferPayload(value, materials, group.assignee, branchCode);
        const created = await warehouseTransferApi.createProductionDraft(payload);
        const taskLabel = created.taskNo ? ` · ${created.taskNo}` : '';
        createdDocs.push(`${created.documentNo}${taskLabel}`);
      }
      toast.success(
        remainingCount > 0
          ? createdDocs.length === 1
            ? `Transfer oluşturuldu: ${createdDocs[0]}. ${remainingCount} bileşen iş emrinde kaldı.`
            : `${createdDocs.length} transfer oluşturuldu. ${remainingCount} bileşen iş emrinde kaldı.`
          : createdDocs.length === 1
            ? `Transfer oluşturuldu: ${createdDocs[0]}`
            : `${createdDocs.length} transfer oluşturuldu: ${createdDocs.join(', ')}`,
      );
      close();
      onTransferCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Atamalar kaydedilemedi.');
    } finally {
      setCompletingTransfer(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        className={cn(
          'wms-ops-detail-dialog wms-ops-form flex !h-[min(90dvh,880px)] !max-h-[calc(100dvh-2.5rem)] w-full flex-col !gap-0 overflow-hidden border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] !p-0',
          // Geniş ekranda 72rem; dar ekranda kenarlara yaslanmasın diye pay bırakılır.
          '!max-w-[min(72rem,calc(100%-2.5rem))]',
          '[scrollbar-gutter:auto]',
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0 max-sm:!py-2.5">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="min-w-0 pr-2 lg:w-[20rem] lg:shrink-0">
            <p className={cn('mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300', !headerOpen && 'max-sm:hidden')}>
              {value.sourceSystemCode} · İş emri / reçete
            </p>
            <DialogTitle className="wms-ops-detail-dialog__title max-sm:!text-[0.72rem]">
              <span className="whitespace-nowrap">İş emri</span>
              <span className="ml-2 font-mono text-base font-bold text-cyan-600 max-sm:text-sm dark:text-cyan-300">
                {value.workOrderNumber}
              </span>
            </DialogTitle>
            <DialogDescription className={cn('wms-ops-detail-dialog__description', !headerOpen && 'max-sm:hidden')}>
              {value.productCode} · {value.productName}
            </DialogDescription>
            <div className={cn('mt-3 flex flex-wrap gap-2', !headerOpen && 'max-sm:hidden')}>
              <OpsStatusBadge tone={value.isClosed ? 'danger' : 'active'}>
                {value.isClosed ? 'Kapalı iş emri' : 'Açık iş emri'}
              </OpsStatusBadge>
              <OpsStatusBadge
                tone={value.mappingErrors.length > 0 ? 'danger' : 'done'}
                title={value.mappingErrors.length > 0 ? 'ERP mirror eşlemeleri tamamlanmadan aktarım yapılamaz.' : undefined}
              >
                {value.mappingErrors.length > 0 ? `${value.mappingErrors.length} eşleme hatası` : 'Eşlemeler hazır'}
              </OpsStatusBadge>
              {alreadyImported ? (
                <OpsStatusBadge tone="pending">WMS’e alınmış</OpsStatusBadge>
              ) : null}
              <OpsCodeBadge className="max-sm:hidden">{value.unitCode || '—'}</OpsCodeBadge>
            </div>
            <button
              type="button"
              onClick={() => setHeaderOpen((current) => !current)}
              aria-expanded={headerOpen}
              className="mt-2 inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-brand-primary)] sm:hidden"
            >
              {headerOpen ? 'Bilgileri gizle' : 'Bilgileri göster'}
              {headerOpen ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            </button>
          </div>
          <div
            className={cn(
              'grid min-w-0 grid-cols-2 gap-2 lg:flex-1 lg:grid-cols-4',
              !headerOpen && 'max-sm:hidden',
            )}
          >
            <SummaryCell className={HEADER_CARD_CLASS} label="İş emri miktarı" value={`${formatProjectNumber(value.plannedQuantity)} ${value.unitCode}`} />
            <SummaryCell className={HEADER_CARD_CLASS} label="Proje" value={value.projectCode || '—'} />
            <SummaryCell className={HEADER_CARD_CLASS} label="Çıkış deposu" value={`${value.sourceWarehouseCode} · ${value.sourceWarehouseName ?? 'Eşleşmedi'}`} />
            <SummaryCell className={HEADER_CARD_CLASS} label="Üretim deposu" value={`${value.targetWarehouseCode} · ${value.targetWarehouseName ?? 'Eşleşmedi'}`} />
          </div>
          </div>
        </header>

        <div className="wms-ops-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <section className="space-y-4">
            <div className="wms-ops-detail-panel p-3 sm:p-4">
              <div className="flex items-center gap-1.5">
                <h3 className="wms-ops-detail-section-title !border-0 !p-0">Atama</h3>
                <TooltipProvider delayDuration={160}>
                  <Tooltip
                    open={assigneeHintOpen}
                    onOpenChange={(next) => {
                      if (!next) setAssigneeHintOpen(false);
                    }}
                  >
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Atama hakkında"
                        onClick={() => setAssigneeHintOpen((current) => !current)}
                        className="inline-flex size-5 items-center justify-center rounded-full text-[var(--wms-app-text-muted)] transition hover:text-[var(--wms-brand-primary)]"
                      >
                        <CircleHelp className="size-4" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="max-w-[18rem]">
                      Atanmamış listeden bileşen seçin, depo çalışanını belirleyin ve &quot;Seçilenleri ata&quot; ile gruba ekleyin.
                      Her kullanıcı için ayrı transfer belgesi oluşturulur.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <PagedLookupDialog<ActiveUserOption>
                    variant="ops"
                    triggerMode="combobox"
                    autoSearchMinLength={1}
                    popoverPortalContainer={null}
                    openDialogOnTouchTap
                    open={assigneeLookupOpen}
                    onOpenChange={setAssigneeLookupOpen}
                    title="Depo çalışanı seçin"
                    value={assignee ? userDisplayName(assignee) : null}
                    placeholder="Depo çalışanı seçin"
                    searchPlaceholder="Ad, kullanıcı adı veya e-posta ile arayın"
                    emptyText="Eşleşen depo çalışanı bulunamadı."
                    triggerClassName="!h-11 !py-2 !pl-9 !pr-3"
                    queryKey={['production-work-order-assignee']}
                    fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                      toPagedResponse(await warehouseTransferApi.activeUsers({
                        pageNumber,
                        pageSize,
                        search,
                        sortBy: 'username',
                        sortDirection: 'asc',
                        signal: signal ?? new AbortController().signal,
                      }))
                    }
                    getKey={(user) => String(user.id)}
                    getLabel={(user) => userDisplayName(user)}
                    onSelect={setAssignee}
                  />
                </div>
                <OpsActionButton
                  variant="primary"
                  className={cn('shrink-0', MODAL_CTA_CLASS)}
                  disabled={blocked || !canCreateTransfer || !assignee || selectedUnassignedCount === 0}
                  onClick={assignSelectedLines}
                >
                  <UserPlus className="size-4 max-sm:size-3.5" aria-hidden />
                  Seçilenleri ata
                </OpsActionButton>
              </div>
              {assignee && selectedUnassignedCount > 0 ? (
                <p className="mt-2 text-xs text-[var(--wms-app-text-muted)]">
                  <strong className="text-[var(--wms-brand-primary)]">{selectedUnassignedCount}</strong> seçili bileşen{' '}
                  <strong className="text-[var(--wms-brand-primary)]">{userDisplayName(assignee)}</strong> kullanıcısına atanacak.
                </p>
              ) : null}
            </div>

            {alreadyImported ? (
              <div className="wms-ops-detail-panel p-4 text-sm">
                <strong className="text-amber-500">Bu {value.sourceSystemCode} iş emri daha önce WMS’e alındı.</strong>
                <div className="mt-1 text-[var(--wms-app-text-muted)]">
                  WMS belgesi: {value.existingProductionDocumentNo}. Yeni WMS emri oluşturulamaz; bağlı transfer hazırlanabilir.
                </div>
              </div>
            ) : null}

            {value.mappingErrors.length > 0 ? (
              <div className="wms-ops-detail-panel p-4 text-sm">
                <strong className="text-red-500">Aktarım öncesi ERP mirror eşlemeleri tamamlanmalı:</strong>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--wms-app-text-muted)]">
                  {value.mappingErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="wms-ops-detail-section-title !border-0 !p-0">
                  Reçete bileşenleri
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {unassignedList.length} atanmamış · <strong className="text-[var(--wms-brand-primary)]">{selectedUnassignedCount}</strong> seçili
                  {assignedCount > 0 ? (
                    <> · <strong className="text-[var(--wms-brand-primary)]">{assignedCount}</strong> bu oturumda atandı</>
                  ) : null}
                  {transferredAssignedMaterials.length > 0 ? (
                    <> · <strong className="text-[var(--wms-app-text-muted)]">{transferredAssignedMaterials.length}</strong> transfer edildi</>
                  ) : null}
                </p>
              </div>
              <GridExportMenu
                fileName={recipeExportFileName}
                columns={RECIPE_EXPORT_COLUMNS}
                rows={recipeExportRows}
                compactMobile
                portalContainer={typeof document === 'undefined' ? undefined : document.body}
              />
            </div>

            {value.materials.length === 0 && !hasAssignedPreview ? (
              <div className="wms-ops-detail-empty flex flex-col items-center gap-2 p-8 text-center">
                <PackageOpen className="wms-ops-detail-empty__icon size-8 opacity-40" aria-hidden />
                <p className="wms-ops-detail-empty__title text-sm text-slate-500">Bu iş emrine bağlı reçete bileşeni bulunamadı.</p>
              </div>
            ) : (
              <>
                {unassignedList.length === 0 && !hasAssignedPreview ? (
                  <div className="wms-ops-detail-panel p-4 text-sm text-[var(--wms-app-text-muted)]">
                    Bu iş emrinde atanmayı bekleyen bileşen kalmadı.
                  </div>
                ) : null}

                {unassignedList.length > 0 ? (
                  <>
                    <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto max-sm:hidden">
                      <table className="wms-ops-gr-detail-lines-table w-full min-w-[880px] text-sm">
                        <thead>
                          <tr>
                            <th className="w-10">
                              <OpsSkinCheckbox
                                aria-label="Tüm atanmamış bileşenleri seç"
                                checked={allUnassignedSelected}
                                indeterminate={selectedUnassignedCount > 0 && !allUnassignedSelected}
                                onCheckedChange={toggleAllUnassigned}
                              />
                            </th>
                            <th>#</th>
                            <th>Bileşen</th>
                            <th>Birim</th>
                            <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
                            <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
                            <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
                            <th>Eşleme</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassignedList.map((index) => {
                            const row = value.materials[index];
                            return (
                              <tr
                                key={materialRowKey(row, index)}
                              >
                                <td>
                                  <OpsSkinCheckbox
                                    aria-label={`${row.stockCode} bileşenini seç`}
                                    checked={selectedUnassigned.has(index)}
                                    onCheckedChange={() => toggleUnassignedLine(index)}
                                  />
                                </td>
                                <td>{index + 1}</td>
                                <td>
                                  <strong>{row.stockCode}</strong>
                                  <div className="wms-ops-gr-detail-lines-table__muted text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                                </td>
                                <td>{row.unitCode}</td>
                                <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.recipeQuantity)}</td>
                                <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.wasteQuantity)}</td>
                                <td className="wms-ops-gr-detail-lines-table__num wms-ops-gr-detail-lines-table__accent">
                                  {formatProjectNumber(row.requiredQuantity)}
                                </td>
                                <td>
                                  <OpsStatusBadge tone={row.mappingError ? 'danger' : 'done'} title={row.mappingError ?? undefined}>
                                    {row.mappingError ?? 'Hazır'}
                                  </OpsStatusBadge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--wms-app-text-muted)] sm:hidden">
                      <OpsSkinCheckbox
                        aria-label="Tüm atanmamış bileşenleri seç"
                        checked={allUnassignedSelected}
                        indeterminate={selectedUnassignedCount > 0 && !allUnassignedSelected}
                        onCheckedChange={toggleAllUnassigned}
                      />
                      <button type="button" onClick={toggleAllUnassigned}>Tümünü seç</button>
                    </div>

                    <div className="space-y-3 sm:hidden">
                      {unassignedList.map((index) => {
                        const row = value.materials[index];
                        return (
                          <article
                            key={`${materialRowKey(row, index)}-card`}
                            className="wms-ops-detail-panel overflow-hidden"
                          >
                            <div className="flex items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))] px-3 py-2.5">
                              <div className="flex min-w-0 items-start gap-2">
                                <OpsSkinCheckbox
                                  aria-label={`${row.stockCode} bileşenini seç`}
                                  className="mt-0.5"
                                  checked={selectedUnassigned.has(index)}
                                  onCheckedChange={() => toggleUnassignedLine(index)}
                                />
                                <div className="min-w-0">
                                  <strong className="block text-sm">{row.stockCode}</strong>
                                  <div className="truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
                                </div>
                              </div>
                              <OpsStatusBadge tone={row.mappingError ? 'danger' : 'done'} title={row.mappingError ?? undefined}>
                                {row.mappingError ? 'Hata' : 'Hazır'}
                              </OpsStatusBadge>
                            </div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
                              <CardStat label="Birim" value={row.unitCode} />
                              <CardStat label="Reçete" value={formatProjectNumber(row.recipeQuantity)} />
                              <CardStat label="Fire" value={formatProjectNumber(row.wasteQuantity)} />
                              <CardStat label="Toplam ihtiyaç" value={formatProjectNumber(row.requiredQuantity)} accent />
                            </dl>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : assigneeGroups.length > 0 ? (
                  <div className="wms-ops-detail-panel p-4 text-sm text-[var(--wms-app-text-muted)]">
                    Seçili atamalar kaydedilmeye hazır. Kalan bileşen yok;{' '}
                    <strong className="text-[var(--wms-brand-primary)]">Atamaları kaydet</strong> butonunu kullanın.
                  </div>
                ) : null}

                {assigneeGroups.map((group) => (
                  <AssigneeGroupMaterialsPanel
                    key={group.assignee.id}
                    group={group}
                    materials={value.materials}
                    onRemoveLine={removeAssignedLine}
                  />
                ))}

                {transferredAssignedMaterials.length > 0 ? (
                  <TransferredMaterialsPanel
                    materials={transferredAssignedMaterials}
                    fadedRowClass={FADED_ASSIGNED_ROW_CLASS}
                  />
                ) : null}
              </>
            )}

          </section>
        </div>

        <footer className="wms-ops-actions wms-ops-detail-dialog__footer flex shrink-0 flex-col-reverse gap-1.5 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 sm:px-6 sm:py-4">
          {footerHint ? (
            <span className="text-xs text-[var(--wms-app-text-muted)] max-sm:text-[0.62rem] sm:mr-auto">{footerHint}</span>
          ) : null}
          <OpsActionButton
            variant="primary"
            className={MODAL_CTA_CLASS}
            disabled={blocked || !canCreateTransfer || assigneeGroups.length === 0}
            loading={completingTransfer}
            onClick={() => void completeAssignments()}
          >
            <CheckCircle2 className="size-4 max-sm:size-3.5" aria-hidden />
            {unassignedLines.size > 0 ? 'Atamaları kaydet' : 'Atamayı yap'}
            {assigneeGroups.length > 1 ? ` (${assigneeGroups.length} belge)` : null}
          </OpsActionButton>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCell({ label, value, className }: { label: string; value: string; className?: string }): ReactElement {
  return (
    <div className={cn('wms-ops-detail-summary-cell', className)}>
      <span className="wms-ops-detail-summary-cell__label">{label}</span>
      <span className="wms-ops-detail-summary-cell__value">{value}</span>
    </div>
  );
}
