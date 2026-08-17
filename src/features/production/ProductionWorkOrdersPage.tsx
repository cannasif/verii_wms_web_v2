import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronUp, CircleHelp, Eye, Loader2, PackageOpen, Plus, UserPlus, UserRoundCog, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme-provider';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn } from '@/components/shared/GridSystemColumns';
import { OpsListPageShell } from '@/components/shared/OpsListPageShell';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { GridExportMenu } from '@/components/shared/GridExportMenu';
import { OpsCreatedPeriodTabs } from '@/components/shared/OpsCreatedPeriodTabs';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { buildTerminalEyebrowFromNav } from '@/components/shared/PremiumEyebrow';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildCreatedPeriodRange, toDateOnlyIso, type CreatedPeriod } from '@/lib/created-period';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { foldTurkishSearch } from '@/lib/turkish-search';
import { filterLocalGridPage } from '@/lib/local-grid-filter';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { productionTransferApi, type ProductionTransferPolicy, type ProductionWorkOrderTransferTab } from '@/features/production-transfer/api';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { ActiveUserOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import type { PagedResponse } from '@/types/api';
import type { ProductionSourceWorkOrder, PreparedNetsisProductionMaterial, PreparedNetsisProductionWorkOrder } from './types';
import {
  ProductionWorkOrderTransferTabPanel,
  PRODUCTION_WORK_ORDER_TRANSFER_TABS,
  isProductionWorkOrderPageTab,
  type ProductionWorkOrderPageTab,
} from './components/ProductionWorkOrderTransferTabPanel';
import { ProductionWorkOrderAssignmentCancelDialog } from './components/ProductionWorkOrderAssignmentDialogs';
import { ProductionWorkOrderDetailDialog } from './components/ProductionWorkOrderDetailDialog';
import { WorkOrderAssignmentProgressRing } from './components/WorkOrderAssignmentProgressRing';
import { fetchProductionWorkOrderTabCounts } from './production-work-order-tab-counts';
import {
  productionWorkOrderListQueryOptions,
  productionWorkOrderRecipeQueryOptions,
} from './production-work-order-recipe-query';

const todayIsoDate = (): string => new Date().toLocaleDateString('en-CA');

const DIALOG_DROPDOWN_CONTENT = 'z-[5000]';

async function buildAutoCompleteProductionTransferPayload(
  workOrder: PreparedNetsisProductionWorkOrder,
  materials: PreparedNetsisProductionMaterial[],
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

const RECIPE_EXPORT_COLUMNS = [
  { key: 'lineNo', label: 'Sıra' },
  { key: 'stockCode', label: 'Stok kodu' },
  { key: 'stockName', label: 'Stok adı' },
  { key: 'unitCode', label: 'Birim' },
  { key: 'operationNumber', label: 'Operasyon no' },
  { key: 'recipeQuantity', label: 'Reçete miktarı' },
  { key: 'wasteQuantity', label: 'Fire miktarı' },
  { key: 'requiredQuantity', label: 'Toplam ihtiyaç' },
  { key: 'sourceWarehouseQuantity', label: 'Depo bakiyesi' },
  { key: 'sourceWarehouseReservedQuantity', label: 'Rezerve miktar' },
  { key: 'sourceWarehouseAvailableQuantity', label: 'Kullanılabilir miktar' },
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

type AssignTargetMode = 'user' | 'warehouse';

type AssigneeRecipeGroup = {
  assignee: ActiveUserOption | null;
  warehouseId: number;
  lineIndices: number[];
};

function assigneeGroupKey(group: AssigneeRecipeGroup): string {
  return group.assignee ? String(group.assignee.id) : `pool:${group.warehouseId}`;
}

function assigneeGroupLabel(group: AssigneeRecipeGroup, warehouseLabel: (id: number) => string): string {
  if (group.assignee) return userDisplayName(group.assignee);
  return `Depo havuzu · ${warehouseLabel(group.warehouseId)}`;
}

async function applyProductionTransferGroupAssignment(
  transferId: number,
  taskId: number,
  group: AssigneeRecipeGroup,
): Promise<void> {
  await productionTransferApi.releaseTaskToPool(transferId, taskId, group.warehouseId);
  if (group.assignee) {
    await productionTransferApi.assignTask(transferId, taskId, group.assignee.id);
  }
}

/** Mobil kartlarda etiket/değer; hem liste hem dialog kapsamında çalışsın diye dialog'a scope'lu CSS yerine utility kullanır. */
function CardStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }): ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-app-text-muted)]">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-sm font-semibold', accent && 'text-[var(--wms-brand-primary)]')}>{value}</dd>
    </div>
  );
}

function formatWarehouseBalance(value: number | undefined): string {
  return value == null ? '—' : formatProjectNumber(value);
}

function WarehouseBalanceCell({
  value,
  tone = 'default',
  title,
}: {
  value: number | undefined;
  tone?: 'default' | 'reserved' | 'available';
  title: string;
}): ReactElement {
  return (
    <td
      title={title}
      className={cn(
        'wms-ops-gr-detail-lines-table__num font-semibold tabular-nums',
        tone === 'reserved' && 'text-amber-600 dark:text-amber-300',
        tone === 'available' && 'text-emerald-600 dark:text-emerald-300',
      )}
    >
      {formatWarehouseBalance(value)}
    </td>
  );
}

function allMaterialIndices(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function mergeAssigneeGroup(
  groups: AssigneeRecipeGroup[],
  assignee: ActiveUserOption | null,
  warehouseId: number,
  lineIndices: number[],
): AssigneeRecipeGroup[] {
  const key = assigneeGroupKey({ assignee, warehouseId, lineIndices: [] });
  const existingIndex = groups.findIndex((group) => assigneeGroupKey(group) === key);
  const sorted = [...lineIndices].sort((left, right) => left - right);
  if (existingIndex < 0) return [...groups, { assignee, warehouseId, lineIndices: sorted }];

  const merged = new Set([...groups[existingIndex].lineIndices, ...sorted]);
  return groups.map((group, index) => (index === existingIndex
    ? { ...group, lineIndices: [...merged].sort((left, right) => left - right) }
    : group));
}

function AssigneeGroupMaterialsPanel({
  group,
  materials,
  warehouseLabel,
  onRemoveLine,
}: {
  group: AssigneeRecipeGroup;
  materials: PreparedNetsisProductionMaterial[];
  warehouseLabel: (id: number) => string;
  onRemoveLine: (groupKey: string, lineIndex: number) => void;
}): ReactElement {
  const groupKey = assigneeGroupKey(group);
  const label = assigneeGroupLabel(group, warehouseLabel);
  return (
    <section className="mt-5 border-t border-[color-mix(in_oklab,var(--wms-ops-accent)_14%,var(--wms-app-border))] pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-[var(--wms-app-text)]">
          {label}
          <span className="ml-2 text-xs font-semibold text-[var(--wms-app-text-muted)]">
            · {group.lineIndices.length} bileşen · kayda hazır
          </span>
        </h4>
      </div>

      <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto max-sm:hidden">
        <table className="wms-ops-gr-detail-lines-table w-full min-w-[1120px] text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Bileşen</th>
              <th>Birim</th>
              <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
              <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
              <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
              <th className="wms-ops-gr-detail-lines-table__num" title="İş emrinin çıkış deposundaki fiziksel kullanılabilir statülü stok">Depo bakiyesi</th>
              <th className="wms-ops-gr-detail-lines-table__num" title="Çıkış deposunda açık emirlere ayrılmış miktar">Rezerve</th>
              <th className="wms-ops-gr-detail-lines-table__num" title="Çıkış deposunda yeni toplama için kullanılabilecek miktar">Kullanılabilir</th>
              <th className="w-24">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {group.lineIndices.map((index, rowNumber) => {
              const row = materials[index];
              return (
                <tr key={`${groupKey}-${materialRowKey(row, index)}`}>
                  <td>{rowNumber + 1}</td>
                  <td>
                    <strong>{row.stockCode}</strong>
                    <div className="text-xs">{row.stockName}</div>
                  </td>
                  <td>{row.unitCode}</td>
                  <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.recipeQuantity)}</td>
                  <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.wasteQuantity)}</td>
                  <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(row.requiredQuantity)}</td>
                  <WarehouseBalanceCell value={row.sourceWarehouseQuantity} title="Çıkış deposu bakiyesi" />
                  <WarehouseBalanceCell value={row.sourceWarehouseReservedQuantity} tone="reserved" title="Çıkış deposunda rezerve miktar" />
                  <WarehouseBalanceCell value={row.sourceWarehouseAvailableQuantity} tone="available" title="Çıkış deposunda kullanılabilir miktar" />
                  <td>
                    <button
                      type="button"
                      title="Atamadan kaldır"
                      aria-label={`${row.stockCode} bileşenini atamadan kaldır`}
                      onClick={() => onRemoveLine(groupKey, index)}
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
              key={`${groupKey}-${materialRowKey(row, index)}-card`}
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
                  onClick={() => onRemoveLine(groupKey, index)}
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
                <CardStat label="Depo bakiyesi" value={formatWarehouseBalance(row.sourceWarehouseQuantity)} />
                <CardStat label="Rezerve" value={formatWarehouseBalance(row.sourceWarehouseReservedQuantity)} />
                <CardStat label="Kullanılabilir" value={formatWarehouseBalance(row.sourceWarehouseAvailableQuantity)} accent />
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
        <table className="wms-ops-gr-detail-lines-table w-full min-w-[1120px] text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Bileşen</th>
              <th>Birim</th>
              <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
              <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
              <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
              <th className="wms-ops-gr-detail-lines-table__num">Depo bakiyesi</th>
              <th className="wms-ops-gr-detail-lines-table__num">Rezerve</th>
              <th className="wms-ops-gr-detail-lines-table__num">Kullanılabilir</th>
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
                <WarehouseBalanceCell value={row.sourceWarehouseQuantity} title="Çıkış deposu bakiyesi" />
                <WarehouseBalanceCell value={row.sourceWarehouseReservedQuantity} tone="reserved" title="Çıkış deposunda rezerve miktar" />
                <WarehouseBalanceCell value={row.sourceWarehouseAvailableQuantity} tone="available" title="Çıkış deposunda kullanılabilir miktar" />
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
              <CardStat label="Depo bakiyesi" value={formatWarehouseBalance(row.sourceWarehouseQuantity)} />
              <CardStat label="Rezerve" value={formatWarehouseBalance(row.sourceWarehouseReservedQuantity)} />
              <CardStat label="Kullanılabilir" value={formatWarehouseBalance(row.sourceWarehouseAvailableQuantity)} accent />
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
  || row.listingKind === 'PartialTransferRemainder'
  || row.listingKind === 'UnassignedCreatedTransfer'
  || (Number.isFinite(row.transferId) && (row.transferId ?? 0) > 0
    && Number.isFinite(row.kalanTaskId) && (row.kalanTaskId ?? 0) > 0);

/** Aynı iş emri numarası farklı kaynaklarda tekrar edebildiği için satır kimliği kaynakla birlikte kurulur. */
const workOrderKey = (row: ProductionSourceWorkOrder): string =>
  isCancellationReturnRemainderContext(row)
    ? `${row.sourceType}:${row.sourceSystemCode}:${row.workOrderNumber}:cancel:${row.transferId ?? 0}:${row.kalanTaskId ?? 0}`
    : `${row.sourceType}:${row.sourceSystemCode}:${row.workOrderNumber}`;

type PendingWorkOrderGridRow = ProductionSourceWorkOrder & {
  id: number;
  rowKey: string;
  listingKindLabel: string;
  warehouseFlow: string;
};

const PENDING_SEARCH_KEYS = [
  'workOrderNumber',
  'listingKindLabel',
  'stockCode',
  'stockName',
  'workOrderQuantity',
  'unitCode',
  'projectCode',
  'warehouseFlow',
  'description',
] as const;

const listingKindFilterOptions = [
  { value: 'İş emri', label: 'İş emri' },
  { value: 'Atama bekliyor', label: 'Atama bekliyor' },
  { value: 'Transfer iadesi', label: 'Transfer iadesi' },
  { value: 'Eksik teslim kalanı', label: 'Eksik teslim kalanı' },
];

function stableGridId(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function toPendingGridRow(row: ProductionSourceWorkOrder): PendingWorkOrderGridRow {
  const rowKey = workOrderKey(row);
  return {
    ...row,
    id: stableGridId(rowKey),
    rowKey,
    listingKindLabel: sourceListingKindLabel(row.listingKind),
    warehouseFlow: `${row.issueWarehouseCode} → ${row.warehouseCode}`,
  };
}

const sourceListingKindLabel = (kind: ProductionSourceWorkOrder['listingKind']): string => {
  if (kind === 'CancellationReturnRemainder') return 'Transfer iadesi';
  if (kind === 'PartialTransferRemainder') return 'Eksik teslim kalanı';
  if (kind === 'UnassignedCreatedTransfer') return 'Atama bekliyor';
  if (kind === 'ManagerCancelledAssignment') return 'İptal edildi';
  if (kind === 'RestoredCancelledAssignment') return 'İş emri';
  return 'İş emri';
};

const sourceListingKindBadgeClass = (kind: ProductionSourceWorkOrder['listingKind']): string => {
  if (kind === 'CancellationReturnRemainder') return 'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300';
  if (kind === 'PartialTransferRemainder') return 'bg-orange-500/15 text-orange-800 dark:text-orange-300';
  if (kind === 'UnassignedCreatedTransfer') return 'bg-violet-500/15 text-violet-800 dark:text-violet-300';
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

export function ProductionWorkOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { t: tProduction } = useModuleTranslation('production');
  const { skin } = useTheme();
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const isPremium = skin === 'premium';
  const [policy, setPolicy] = useState<ProductionTransferPolicy>();
  const [rows, setRows] = useState<ProductionSourceWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PreparedNetsisProductionWorkOrder>();
  const [detailTarget, setDetailTarget] = useState<ProductionSourceWorkOrder>();
  const [assignmentLoading, setAssignmentLoading] = useState<string>();
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);
  const [createdPeriod, setCreatedPeriod] = useState<CreatedPeriod | null>('month');
  const [createdPeriodAnchor, setCreatedPeriodAnchor] = useState(() => new Date());
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
  const [tabCountsRevision, setTabCountsRevision] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<ProductionSourceWorkOrder>();
  const canCancelAssignment = can('WMS.PRODUCTION_TRANSFER.CANCEL');
  const eyebrow = buildTerminalEyebrowFromNav(pathname, t, i18n.resolvedLanguage ?? i18n.language) ?? 'VERII WMS';
  const activeTabIndex = PRODUCTION_WORK_ORDER_TRANSFER_TABS.findIndex((tab) => tab.key === activeTab);

  const refreshTabCounts = useCallback(() => {
    setTabCountsRevision((current) => current + 1);
  }, []);

  const tabCounts = useQuery({
    queryKey: ['production', 'work-orders', 'tab-counts', tabCountsRevision],
    queryFn: fetchProductionWorkOrderTabCounts,
    refetchInterval: 60_000,
  });

  const tabCount = (tab: ProductionWorkOrderPageTab): number | null => {
    if (tab === 'pending') {
      if (loading && rows.length === 0) return null;
      return rows.filter((row) => row.listingKind !== 'ManagerCancelledAssignment').length;
    }
    if (!tabCounts.data) return null;
    return tabCounts.data[tab];
  };

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

  const createdRange = useMemo(() => {
    if (!createdPeriod) return undefined;
    const { start, end } = buildCreatedPeriodRange(createdPeriod, createdPeriodAnchor);
    return { fromDate: toDateOnlyIso(start), toDate: toDateOnlyIso(end) };
  }, [createdPeriod, createdPeriodAnchor]);

  const loadPending = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const query = productionWorkOrderListQueryOptions(branchCode, undefined, createdRange);
      if (force) {
        await queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
        setPendingRefreshKey((current) => current + 1);
      }
      setRows(await queryClient.fetchQuery(query));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Üretim iş emirleri yüklenemedi.');
    } finally {
      setLoading(false);
      refreshTabCounts();
    }
  }, [branchCode, createdRange, queryClient, refreshTabCounts]);
  useEffect(() => {
    void loadPending();
  }, [loadPending]);
  useEffect(() => { void productionTransferApi.effectivePolicy(branchCode).then(setPolicy).catch((error: Error) => toast.error(error.message)); }, [branchCode]);

  const fetchPendingPage = useCallback(async (request: GridRequest) => {
    const query = productionWorkOrderListQueryOptions(branchCode, undefined, createdRange);
    const items = await queryClient.fetchQuery(query);
    setRows(items);
    const gridRows = items
      .filter((row) => row.listingKind !== 'ManagerCancelledAssignment')
      .map(toPendingGridRow);
    const sortedRequest = request.sortBy
      ? request
      : { ...request, sortBy: 'workOrderDate', sortDirection: 'desc' as const };
    const visibleCellSearchFields = sortedRequest.searchFields?.flatMap((field) => {
      if (field === 'stockCode') return ['stockCode', 'stockName'];
      if (field === 'workOrderQuantity') return ['workOrderQuantity', 'unitCode'];
      return [field];
    });
    return filterLocalGridPage(
      gridRows,
      { ...sortedRequest, searchFields: visibleCellSearchFields },
      [...PENDING_SEARCH_KEYS],
    );
  }, [branchCode, createdRange, queryClient]);

  const openDetail = (row: ProductionSourceWorkOrder): void => {
    setDetailTarget(row);
  };

  const openAssignment = async (row: ProductionSourceWorkOrder) => {
    setAssignmentLoading(workOrderKey(row));
    try {
      setSelected(await queryClient.fetchQuery(productionWorkOrderRecipeQueryOptions(row)));
      setDetailTarget(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İş emri reçetesi hazırlanamadı.');
    } finally {
      setAssignmentLoading(undefined);
    }
  };

  const sourceLabel = policy?.productionOrderSource === 'ErpAndWms'
    ? `Netsis ERP + ${policy.wmsSourceSystemCode}`
    : policy?.productionOrderSource === 'WmsIntegrationTables' ? policy.wmsSourceSystemCode : 'Netsis ERP';

  const pendingColumns = useMemo<GridColumn<PendingWorkOrderGridRow>[]>(() => [
    {
      key: 'workOrderNumber',
      label: 'İş emri',
      width: 220,
      sortable: true,
      filterable: true,
      defaultSearch: true,
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <strong className="font-mono font-semibold text-[var(--wms-brand-primary)]">{row.workOrderNumber}</strong>
          <WorkOrderAssignmentProgressRing row={row} />
        </div>
      ),
    },
    {
      key: 'listingKindLabel',
      label: 'Tür',
      sortable: true,
      filterable: true,
      filterType: 'enum',
      filterOptions: listingKindFilterOptions,
      render: (row) => (
        <>
          <SourceListingKindBadge row={row} />
          {row.listingKind !== 'CancellationReturnRemainder'
            && row.listingKind !== 'PartialTransferRemainder'
            && row.listingKind !== 'UnassignedCreatedTransfer'
            && row.revisionNumber > 1 ? (
            <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Rev. {row.revisionNumber}</div>
          ) : null}
        </>
      ),
    },
    {
      key: 'stockCode',
      label: 'Mamul',
      sortable: true,
      filterable: true,
      defaultSearch: true,
      contextValue: (row) => [row.stockCode, row.stockName].filter(Boolean).join(' · '),
      render: (row) => (
        <>
          <strong className="block">{row.stockCode}</strong>
          <div className="mx-auto max-w-80 truncate text-xs text-[var(--wms-app-text-muted)]">{row.stockName}</div>
        </>
      ),
    },
    {
      key: 'workOrderQuantity',
      label: 'Miktar / birim',
      sortable: true,
      filterable: true,
      filterType: 'number',
      contextValue: (row) => `${formatProjectNumber(row.workOrderQuantity)} ${row.unitCode ?? ''}`.trim(),
      render: (row) => (
        <span className="font-bold">{formatProjectNumber(row.workOrderQuantity)} {row.unitCode ?? ''}</span>
      ),
    },
    {
      key: 'workOrderDate',
      label: 'Tarih',
      sortable: true,
      filterable: true,
      filterType: 'date',
      contextValue: (row) => formatProjectDate(row.workOrderDate),
      render: (row) => formatProjectDate(row.workOrderDate),
    },
    {
      key: 'projectCode',
      label: 'Proje',
      sortable: true,
      filterable: true,
      render: (row) => row.projectCode || '—',
    },
    {
      key: 'warehouseFlow',
      label: 'Depo akışı',
      sortable: true,
      filterable: true,
      render: (row) => row.warehouseFlow,
    },
    {
      key: 'description',
      label: tProduction('detail.description'),
      sortable: true,
      filterable: true,
      render: (row) => (
        <p className="mx-auto line-clamp-2 max-w-72 whitespace-pre-wrap text-center text-xs text-[var(--wms-app-text-muted)]" title={row.description?.trim()}>
          {row.description?.trim() || '—'}
        </p>
      ),
    },
    {
      key: 'actions',
      label: 'İşlem',
      ...requiredActionColumn,
      width: 160,
      render: (row) => (
        <div className="wms-ops-row-actions" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="wms-ops-grid-icon-btn"
            title="Detay"
            aria-label="Detay"
            onClick={() => openDetail(row)}
          >
            <Eye className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className="wms-ops-grid-icon-btn"
            title="Reçeteyi aç"
            aria-label="Reçeteyi aç"
            disabled={assignmentLoading === row.rowKey}
            onClick={() => void openAssignment(row)}
          >
            {assignmentLoading === row.rowKey ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <UserRoundCog className="size-3.5" aria-hidden />
            )}
          </button>
          {canCancelAssignment ? (
            <button
              type="button"
              className="wms-ops-grid-icon-btn !text-rose-600"
              title="İptal et"
              aria-label="İptal et"
              onClick={() => setCancelTarget(row)}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ),
    },
  ], [assignmentLoading, canCancelAssignment, tProduction]);

  const renderCreatedPeriodTabs = (): ReactElement => (
    <OpsCreatedPeriodTabs
      value={createdPeriod}
      onChange={setCreatedPeriod}
      anchor={createdPeriodAnchor}
      onAnchorChange={setCreatedPeriodAnchor}
      labels={{
        title: tProduction('workOrders.createdPeriodTitle'),
        prev: tProduction('workOrders.createdPeriodPrev'),
        next: tProduction('workOrders.createdPeriodNext'),
        now: {
          day: tProduction('workOrders.createdPeriodNow.day'),
          week: tProduction('workOrders.createdPeriodNow.week'),
          month: tProduction('workOrders.createdPeriodNow.month'),
          year: tProduction('workOrders.createdPeriodNow.year'),
        },
        periods: {
          day: tProduction('workOrders.createdPeriod.day'),
          week: tProduction('workOrders.createdPeriod.week'),
          month: tProduction('workOrders.createdPeriod.month'),
          year: tProduction('workOrders.createdPeriod.year'),
        },
      }}
    />
  );

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
              {PRODUCTION_WORK_ORDER_TRANSFER_TABS.map((tab) => {
                const count = tabCount(tab.key);
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="wms-ops-detail-main-tab">
                    {tab.label}
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

        <div className="wms-ops-pending-grid-center" hidden={activeTab !== 'pending'}>
          <AdvancedDataGrid<PendingWorkOrderGridRow>
            compactShell
            title=""
            pageKey="production-work-order-pending"
            refreshKey={`${pendingRefreshKey}:${createdRange?.fromDate ?? ''}:${createdRange?.toDate ?? ''}`}
            retainQueryCache
            columns={pendingColumns}
            fetchPage={fetchPendingPage}
            toolbarBelowExtra={renderCreatedPeriodTabs()}
            emptyMessage="Seçili kaynakta transfere hazır açık iş emri bulunamadı."
            onRowDoubleClick={(row) => openDetail(row)}
          />
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
                createdPeriod={createdPeriod}
                createdPeriodAnchor={createdPeriodAnchor}
                toolbarBelowExtra={renderCreatedPeriodTabs()}
                onPendingQueueChanged={() => void loadPending(true)}
                onAfterPoolClaim={() => {
                  refreshTabCounts();
                  setActiveTab('mine');
                  setTransferRefreshKeys((current) => ({
                    ...current,
                    picking: (current.picking ?? 0) + 1,
                    mine: (current.mine ?? 0) + 1,
                  }));
                }}
              />
            ) : null
          ))}
      </div>
    </OpsListPageShell>
    {detailTarget ? (
      <ProductionWorkOrderDetailDialog
        row={detailTarget}
        canCreateTransfer={can('WMS.PRODUCTION_TRANSFER.CREATE')}
        canCancel={canCancelAssignment}
        onClose={() => setDetailTarget(undefined)}
        onOpenAssignment={(row) => void openAssignment(row)}
        onCancel={(row) => {
          setDetailTarget(undefined);
          setCancelTarget(row);
        }}
      />
    ) : null}
    {selected && (
      <WorkOrderDrawer
        value={selected}
        branchCode={branchCode}
        close={() => setSelected(undefined)}
        onTransferCreated={() => {
          refreshTabCounts();
          void loadPending(true);
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
          refreshTabCounts();
          void loadPending(true);
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
  const { t: tProduction } = useModuleTranslation('production');
  const authUser = useAuthStore((state) => state.user);
  const blocked = value.mappingErrors.length > 0 || value.isClosed;
  const alreadyImported = Boolean(value.existingProductionOrderId);
  const defaultWarehouseId = value.sourceWarehouseId ? String(value.sourceWarehouseId) : '';
  const [headerOpen, setHeaderOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<AssignTargetMode>('user');
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [poolWarehouseId, setPoolWarehouseId] = useState(defaultWarehouseId);
  const [groupUser, setGroupUser] = useState<ActiveUserOption | null>(null);
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

  const warehousesQuery = useQuery({
    queryKey: ['production-work-order-assignment-warehouses', branchCode],
    queryFn: async () => {
      const page = await warehouseTransferApi.warehouses({
        pageNumber: 1,
        pageSize: 500,
        search: '',
        sortBy: 'warehouseCode',
        sortDirection: 'asc',
        signal: new AbortController().signal,
      }, branchCode);
      return page.items;
    },
    enabled: Boolean(branchCode),
  });
  const eligibleAssigneesQuery = useQuery({
    queryKey: ['production-work-order-eligible-assignees'],
    queryFn: () => productionTransferApi.eligibleAssignees(),
    enabled: canCreateTransfer,
  });

  const warehouseOptions = useMemo(
    () => (warehousesQuery.data ?? [])
      .sort((left, right) => left.warehouseCode - right.warehouseCode)
      .map((item) => ({ value: String(item.id), label: `${item.warehouseCode} · ${item.warehouseName}` })),
    [warehousesQuery.data],
  );
  const warehouseLabel = useCallback((id: number): string => {
    const match = warehouseOptions.find((item) => item.value === String(id));
    return match?.label ?? `#${id}`;
  }, [warehouseOptions]);
  const currentUserOption = useMemo<ActiveUserOption | null>(() => {
    if (!authUser) return null;
    const eligible = eligibleAssigneesQuery.data?.find((assignee) => assignee.userId === authUser.id);
    return {
      id: authUser.id,
      username: eligible?.username ?? authUser.email,
      email: authUser.email ?? '',
      firstName: '',
      lastName: '',
      isActive: true,
    };
  }, [authUser, eligibleAssigneesQuery.data]);
  const eligibleUserIdsForWarehouse = useMemo(() => {
    const selectedWarehouseId = Number(targetMode === 'warehouse' ? poolWarehouseId : warehouseId);
    if (!Number.isFinite(selectedWarehouseId) || selectedWarehouseId <= 0) return new Set<number>();
    return new Set(
      (eligibleAssigneesQuery.data ?? [])
        .filter((assignee) => assignee.warehouseIds.length === 0 || assignee.warehouseIds.includes(selectedWarehouseId))
        .map((assignee) => assignee.userId),
    );
  }, [eligibleAssigneesQuery.data, poolWarehouseId, targetMode, warehouseId]);

  useEffect(() => {
    const nextWarehouseId = value.sourceWarehouseId ? String(value.sourceWarehouseId) : '';
    setUnassignedLines(new Set(allMaterialIndices(value.materials.length)));
    setAssigneeGroups([]);
    setSelectedUnassigned(new Set(allMaterialIndices(value.materials.length)));
    setGroupUser(null);
    setTargetMode('user');
    setWarehouseId(nextWarehouseId);
    setPoolWarehouseId(nextWarehouseId);
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
    if (selectedUnassignedCount === 0) return;
    const indices = [...selectedUnassigned].filter((index) => unassignedLines.has(index));
    if (indices.length === 0) return;

    if (targetMode === 'warehouse') {
      const poolId = Number(poolWarehouseId);
      if (!Number.isFinite(poolId) || poolId <= 0) return;
      setUnassignedLines((current) => {
        const next = new Set(current);
        indices.forEach((index) => next.delete(index));
        return next;
      });
      setAssigneeGroups((current) => mergeAssigneeGroup(current, null, poolId, indices));
      setSelectedUnassigned(new Set());
      return;
    }

    const selectedWarehouseId = Number(warehouseId);
    if (!groupUser || !Number.isFinite(selectedWarehouseId) || selectedWarehouseId <= 0) return;
    setUnassignedLines((current) => {
      const next = new Set(current);
      indices.forEach((index) => next.delete(index));
      return next;
    });
    setAssigneeGroups((current) => mergeAssigneeGroup(current, groupUser, selectedWarehouseId, indices));
    setSelectedUnassigned(new Set());
  };

  const removeAssignedLine = (groupKey: string, lineIndex: number): void => {
    setAssigneeGroups((current) => current
      .map((group) => assigneeGroupKey(group) === groupKey
        ? { ...group, lineIndices: group.lineIndices.filter((index) => index !== lineIndex) }
        : group)
      .filter((group) => group.lineIndices.length > 0));
    setUnassignedLines((current) => new Set([...current, lineIndex]));
    setSelectedUnassigned((current) => new Set([...current, lineIndex]));
  };

  const canAssignSelected = selectedUnassignedCount > 0
    && (targetMode === 'warehouse'
      ? Boolean(poolWarehouseId)
      : Boolean(groupUser && warehouseId));
  const assignPreviewLabel = targetMode === 'warehouse'
    ? (poolWarehouseId ? warehouseLabel(Number(poolWarehouseId)) : null)
    : (groupUser ? userDisplayName(groupUser) : null);

  const footerHint = blocked || !canCreateTransfer
    ? null
    : assigneeGroups.length === 0
      ? unassignedLines.size > 0
        ? 'Kayıt için en az bir atama grubu oluşturun.'
        : 'Atanacak kalan bileşen bulunmuyor.'
      : unassignedLines.size > 0
        ? `${assigneeGroups.length} atama grubu kaydedilecek; ${unassignedLines.size} bileşen iş emrinde kalan olarak kalacak.`
        : selectedUnassignedCount > 0 && !canAssignSelected
          ? 'Seçili satırları atamak için depo ve hedef belirleyin.'
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
    sourceWarehouseQuantity: material.sourceWarehouseQuantity ?? '',
    sourceWarehouseReservedQuantity: material.sourceWarehouseReservedQuantity ?? '',
    sourceWarehouseAvailableQuantity: material.sourceWarehouseAvailableQuantity ?? '',
    mappingStatus: material.mappingError ?? 'Hazır',
  }));
  const recipeExportFileName = `Recete_${value.workOrderNumber.replace(/[^\p{L}\p{N}._-]+/gu, '_')}`;

  const completeAssignments = async (): Promise<void> => {
    if (blocked || !canCreateTransfer || assigneeGroups.length === 0) return;
    const remainingCount = unassignedLines.size;
    const isExistingUnlinkedRemainder =
      (value.listingKind === 'CancellationReturnRemainder' || value.listingKind === 'PartialTransferRemainder')
      && Number.isFinite(value.transferId) && (value.transferId ?? 0) > 0
      && Number.isFinite(value.kalanTaskId) && (value.kalanTaskId ?? 0) > 0
      && !value.existingProductionOrderId
      && !value.existingProductionHeaderId;
    const isExistingUnassignedCreated =
      value.listingKind === 'UnassignedCreatedTransfer'
      && Number.isFinite(value.transferId) && (value.transferId ?? 0) > 0
      && Number.isFinite(value.kalanTaskId) && (value.kalanTaskId ?? 0) > 0;
    setCompletingTransfer(true);
    try {
      if (isExistingUnlinkedRemainder || isExistingUnassignedCreated) {
        if (assigneeGroups.length !== 1) {
          throw new Error(
            value.listingKind === 'PartialTransferRemainder'
              ? 'Eksik teslim kalan transferi aynı oturumda yalnızca tek bir atama grubu ile kaydedilebilir.'
              : value.listingKind === 'UnassignedCreatedTransfer'
                ? 'Atama bekleyen transfer aynı oturumda yalnızca tek bir atama grubu ile kaydedilebilir.'
                : 'İptal kalan transferi aynı oturumda yalnızca tek bir atama grubu ile kaydedilebilir.',
          );
        }
        const group = assigneeGroups[0];
        await applyProductionTransferGroupAssignment(value.transferId!, value.kalanTaskId!, group);
        toast.success(group.assignee
          ? `Transfer ${value.workOrderNumber} · ${userDisplayName(group.assignee)} kullanıcısına atandı.`
          : `Transfer ${value.workOrderNumber} · ${warehouseLabel(group.warehouseId)} depo havuzuna bırakıldı.`);
        close();
        onTransferCreated?.();
        return;
      }

      const createdDocs: string[] = [];
      for (const group of assigneeGroups) {
        const materials = group.lineIndices.map((index) => value.materials[index]);
        const payload = await buildAutoCompleteProductionTransferPayload(value, materials, branchCode);
        const created = await warehouseTransferApi.createProductionDraft(payload);
        if (!created.taskId) throw new Error('Toplama görevi oluşturulamadı.');
        await applyProductionTransferGroupAssignment(created.id, created.taskId, group);
        const taskLabel = created.taskNo ? ` · ${created.taskNo}` : '';
        const targetLabel = group.assignee
          ? userDisplayName(group.assignee)
          : `Depo havuzu · ${warehouseLabel(group.warehouseId)}`;
        createdDocs.push(`${created.documentNo}${taskLabel} → ${targetLabel}`);
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
          // Bakiye kolonları geniş ekranda aynı bakışta görünür; dar ekranda tablo kendi içinde yatay kayar.
          '!max-w-[min(90rem,calc(100%-2.5rem))]',
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
            {value.description?.trim() ? (
              <div className="wms-ops-detail-panel p-3 sm:p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
                  {tProduction('detail.description')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--wms-app-text)]">
                  {value.description.trim()}
                </p>
              </div>
            ) : null}
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
                      Atanmamış listeden bileşen seçin; Kişi veya Depo sekmesinden hedef belirleyip &quot;Seçilenleri ata&quot; deyin.
                      Kişi modunda önce depo seçilir, kullanıcı listesi yalnızca o depodaki çalışanları gösterir.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="mt-3 wms-ops-production-work-order-tabs wms-ops-detail-dialog">
                <Tabs value={targetMode} onValueChange={(next) => setTargetMode(next as AssignTargetMode)}>
                  <TabsList
                    className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-2')}
                    data-active-index={targetMode === 'user' ? 0 : 1}
                  >
                    <span className="wms-ops-detail-tab-indicator" aria-hidden />
                    <TabsTrigger value="user" className="wms-ops-detail-main-tab">
                      Kişi
                    </TabsTrigger>
                    <TabsTrigger value="warehouse" className="wms-ops-detail-main-tab">
                      Depo
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-3">
                  {targetMode === 'user' ? (
                    <>
                      <div className="space-y-1.5">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Depo</p>
                        <div className="wms-ops-field-shell w-full min-w-0">
                          <AppDropdown
                            value={warehouseId || null}
                            onValueChange={(next) => setWarehouseId(next ?? '')}
                            options={warehouseOptions}
                            placeholder={warehousesQuery.isLoading ? 'Depolar yükleniyor…' : 'Depo seçin'}
                            searchable
                            portalContainer={null}
                            contentClassName={DIALOG_DROPDOWN_CONTENT}
                            className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                          />
                        </div>
                        <p className="text-xs text-[var(--wms-app-text-muted)]">Kişiye atanan kalemler seçilen depoda hazırlanır.</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Depo personeli</p>
                        <PagedLookupDialog<ActiveUserOption>
                          variant="ops"
                          triggerMode="combobox"
                          autoSearchMinLength={1}
                          popoverPortalContainer={null}
                          openDialogOnTouchTap
                          open={assigneeLookupOpen}
                          onOpenChange={setAssigneeLookupOpen}
                          title="Depo personeli seçin"
                          value={groupUser ? userDisplayName(groupUser) : null}
                          placeholder={warehouseId ? 'Depo personeli seçin' : 'Önce depo seçin'}
                          searchPlaceholder="Ad, kullanıcı adı veya e-posta ile arayın"
                          emptyText="Bu depoda eşleşen depo çalışanı bulunamadı."
                          triggerClassName="!h-11 !py-2 !pl-9 !pr-3"
                          queryKey={['production-work-order-assignee', warehouseId, eligibleAssigneesQuery.dataUpdatedAt]}
                          fetchPage={async ({ pageNumber, pageSize, search }) => {
                            const selectedWarehouseId = Number(warehouseId);
                            if (!Number.isFinite(selectedWarehouseId) || selectedWarehouseId <= 0) {
                              return toPagedResponse({
                                items: [],
                                totalCount: 0,
                                pageNumber: 1,
                                pageSize,
                                totalPages: 1,
                                hasNextPage: false,
                              });
                            }

                            const normalizedSearch = foldTurkishSearch(search?.trim() ?? '');
                            const filtered = (eligibleAssigneesQuery.data ?? [])
                              .filter((assignee) => assignee.warehouseIds.length === 0
                                || assignee.warehouseIds.includes(selectedWarehouseId))
                              .filter((assignee) => !normalizedSearch
                                || foldTurkishSearch(assignee.username).includes(normalizedSearch))
                              .sort((left, right) => left.username.localeCompare(right.username, 'tr'));

                            const totalCount = filtered.length;
                            const start = (pageNumber - 1) * pageSize;
                            const items = filtered.slice(start, start + pageSize).map((assignee) => ({
                              id: assignee.userId,
                              username: assignee.username,
                              email: '',
                              firstName: '',
                              lastName: '',
                              isActive: true,
                            } satisfies ActiveUserOption));

                            return toPagedResponse({
                              items,
                              totalCount,
                              pageNumber,
                              pageSize,
                              totalPages: Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1))),
                              hasNextPage: start + pageSize < totalCount,
                            });
                          }}
                          getKey={(user) => String(user.id)}
                          getLabel={(user) => userDisplayName(user)}
                          onSelect={setGroupUser}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Depo</p>
                      <div className="wms-ops-field-shell w-full min-w-0">
                        <AppDropdown
                          value={poolWarehouseId || null}
                          onValueChange={(next) => setPoolWarehouseId(next ?? '')}
                          options={warehouseOptions}
                          placeholder={warehousesQuery.isLoading ? 'Depolar yükleniyor…' : 'Depo seçin'}
                          searchable
                          portalContainer={null}
                          contentClassName={DIALOG_DROPDOWN_CONTENT}
                          className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                        />
                      </div>
                      <p className="text-xs text-[var(--wms-app-text-muted)]">
                        Görev seçilen depoya ortak olarak bırakılır; o depodaki bir çalışan üzerine alabilir.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:pb-0.5 sm:flex-row">
                  {targetMode === 'user' && currentUserOption && eligibleUserIdsForWarehouse.has(currentUserOption.id) ? (
                    <OpsActionButton
                      type="button"
                      variant="secondary"
                      className={cn('wms-ops-list-toolbar-btn', MODAL_CTA_CLASS)}
                      onClick={() => setGroupUser(currentUserOption)}
                    >
                      Kendimi seç
                    </OpsActionButton>
                  ) : null}
                  <OpsActionButton
                    variant="primary"
                    className={cn('shrink-0', MODAL_CTA_CLASS)}
                    disabled={blocked || !canCreateTransfer || !canAssignSelected}
                    onClick={assignSelectedLines}
                  >
                    <UserPlus className="size-4 max-sm:size-3.5" aria-hidden />
                    Seçilenleri ata
                  </OpsActionButton>
                </div>
              </div>

              {assignPreviewLabel && selectedUnassignedCount > 0 ? (
                <p className="mt-2 text-xs text-[var(--wms-app-text-muted)]">
                  <strong className="text-[var(--wms-brand-primary)]">{selectedUnassignedCount}</strong> seçili bileşen{' '}
                  <strong className="text-[var(--wms-brand-primary)]">{assignPreviewLabel}</strong>{' '}
                  {targetMode === 'warehouse' ? 'depo havuzuna' : 'kullanıcısına'} atanacak.
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
                      <table className="wms-ops-gr-detail-lines-table w-full min-w-[1120px] text-sm">
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
                            <th className="wms-ops-gr-detail-lines-table__num" title="İş emrinin çıkış deposundaki fiziksel kullanılabilir statülü stok">Depo bakiyesi</th>
                            <th className="wms-ops-gr-detail-lines-table__num" title="Çıkış deposunda açık emirlere ayrılmış miktar">Rezerve</th>
                            <th className="wms-ops-gr-detail-lines-table__num" title="Çıkış deposunda yeni toplama için kullanılabilecek miktar">Kullanılabilir</th>
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
                                <WarehouseBalanceCell value={row.sourceWarehouseQuantity} title="Çıkış deposu bakiyesi" />
                                <WarehouseBalanceCell value={row.sourceWarehouseReservedQuantity} tone="reserved" title="Çıkış deposunda rezerve miktar" />
                                <WarehouseBalanceCell value={row.sourceWarehouseAvailableQuantity} tone="available" title="Çıkış deposunda kullanılabilir miktar" />
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
                              <CardStat label="Depo bakiyesi" value={formatWarehouseBalance(row.sourceWarehouseQuantity)} />
                              <CardStat label="Rezerve" value={formatWarehouseBalance(row.sourceWarehouseReservedQuantity)} />
                              <CardStat label="Kullanılabilir" value={formatWarehouseBalance(row.sourceWarehouseAvailableQuantity)} accent />
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
                    key={assigneeGroupKey(group)}
                    group={group}
                    materials={value.materials}
                    warehouseLabel={warehouseLabel}
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
