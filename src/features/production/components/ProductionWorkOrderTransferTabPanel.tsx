import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  AlertTriangle,
  ArrowRightLeft,
  Eye,
  Loader2,
  PackageCheck,
  Pencil,
  RotateCcw,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { inferOpsStatusTone, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { AppInput } from '@/components/shared/AppInput';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { isInstantInCreatedPeriod, type CreatedPeriod } from '@/lib/created-period';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { foldTurkishSearch } from '@/lib/turkish-search';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import {
  ProductionTransferCancelBlockedDialog,
  ProductionTransferCancelConfirmDialog,
} from '@/features/production-transfer/components/ProductionTransferCancelDialogs';
import { ProductionTransferDetailDialog } from '@/features/production-transfer/components/ProductionTransferDetailDialog';
import { ProductionTransferDraftWithdrawDialog } from '@/features/production-transfer/components/ProductionTransferDraftWithdrawDialog';
import {
  productionTransferErpErrorMessage,
  productionTransferNeedsErpAttention,
} from '@/features/production-transfer/production-transfer-erp-posting';
import { useProductionTransferListCancel } from '@/features/production-transfer/hooks/useProductionTransferListCancel';
import {
  productionTransferApi,
  type ProductionTask,
  type ProductionTaskBoard,
  type ProductionTaskPoolRow,
  type ProductionWorkOrderTransferHeaderRow,
  type ProductionWorkOrderTransferTab,
} from '@/features/production-transfer/api';
import { productionWorkOrderTransferPickingStatusLabel } from '@/features/production-transfer/production-transfer-task-labels';
import { productionTransferEnumLabel } from '@/features/production-transfer/localization/enum-labels';
import { isReturnTaskType } from '@/features/production-transfer/production-transfer-task-chain';
import type { WarehouseTransferGridRow } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';
import type { ActiveUserOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { filterLocalGridPage } from '../production-work-order-transfer-grid.utils';
import { productionApi } from '../api';
import type { ProductionSourceWorkOrder } from '../types';
import { ProductionWorkOrderAssignmentRestoreDialog } from './ProductionWorkOrderAssignmentDialogs';
import { TransferPickingProgressRing } from './TransferPickingProgressRing';

const TRANSFER_TAB_GRID_PAGE_KEY = 'production-work-order-transfers-v4';

const TAB_LABELS: Record<ProductionWorkOrderTransferTab, string> = {
  Picking: 'Toplamada',
  Completed: 'Tamamlanan',
  Cancelled: 'İptal Edilen',
  MyAssignments: 'Benim İşlerim',
};

const usesPickingStatusLabel = (tab: ProductionWorkOrderTransferTab): boolean =>
  tab === 'Picking' || tab === 'MyAssignments';

const transferBaseUrl = '/warehouse/production-transfers';
const G = 'dataGrid.transferRecords';
const HANDOFF_DIALOG_DROPDOWN_CONTENT = 'z-[5000]';

const encodeHandoffUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeHandoffUser = (value: string): ActiveUserOption => JSON.parse(decodeURIComponent(value)) as ActiveUserOption;

function isActiveTaskStatus(status: string): boolean {
  return !['Completed', 'Cancelled'].includes(status);
}

function isHandoffEligibleLiveTask(
  liveTask: ProductionTaskBoard['tasks'][number],
): boolean {
  return !isReturnTaskType(liveTask.taskType)
    && isActiveTaskStatus(liveTask.status)
    && liveTask.assignments.length > 0
    && liveTask.lines.some((line) => line.processedQuantity < line.requestedQuantity);
}

function TransferHandoffAction({
  transferId,
  documentNo,
  tab,
  onCompleted,
}: {
  transferId: number;
  documentNo: string;
  tab: ProductionWorkOrderTransferTab;
  onCompleted: () => void;
}): ReactElement | null {
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const canAssign = can('WMS.PRODUCTION_TRANSFER.ASSIGN');
  const boardQueryKey = ['production-transfer', 'board', transferId] as const;
  const showHandoff = tab === 'Picking' && canAssign && transferId > 0;
  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => productionTransferApi.taskBoard(transferId),
    enabled: showHandoff,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [handoffTask, setHandoffTask] = useState<ProductionTask | null>(null);
  const [handoffUser, setHandoffUser] = useState<ActiveUserOption | null>(null);
  const [handoffReason, setHandoffReason] = useState('');
  const [busy, setBusy] = useState(false);
  const board = boardQuery.data;

  const eligibleLiveTasks = useMemo(
    () => (board?.tasks ?? []).filter(isHandoffEligibleLiveTask),
    [board?.tasks],
  );

  const eligibleHandoffUserIds = useMemo(() => {
    if (!board || !handoffTask) return new Set<number>();
    return new Set(
      board.eligibleAssignees
        .filter((user) =>
          (user.warehouseIds.length === 0 || user.warehouseIds.includes(handoffTask.warehouseId))
          && !handoffTask.assignments.some((assignment) => assignment.userId === user.userId))
        .map((user) => user.userId),
    );
  }, [board, handoffTask]);

  const openDialog = useCallback(() => {
    if (!board) return;
    const task = eligibleLiveTasks[eligibleLiveTasks.length - 1] ?? null;
    if (!task) {
      toast.error('Devredilebilir açık görev bulunamadı.');
      return;
    }
    setHandoffTask(task);
    setHandoffUser(null);
    setHandoffReason('');
    setDialogOpen(true);
  }, [board, eligibleLiveTasks]);

  const closeDialog = useCallback(() => {
    if (busy) return;
    setDialogOpen(false);
    setHandoffTask(null);
    setHandoffUser(null);
    setHandoffReason('');
  }, [busy]);

  const submit = useCallback(async () => {
    if (!handoffTask || !handoffUser) return;
    if (handoffReason.trim().length < 3) {
      toast.error('Devir nedeni en az 3 karakter olmalıdır.');
      return;
    }
    if (!eligibleHandoffUserIds.has(handoffUser.id)) {
      toast.error('Seçilen kullanıcı bu görev için devralamaz.');
      return;
    }
    setBusy(true);
    try {
      const nextBoard = await productionTransferApi.handoffTask(
        transferId,
        handoffTask.taskId,
        handoffUser.id,
        handoffReason.trim(),
      );
      queryClient.setQueryData(boardQueryKey, nextBoard);
      toast.success(`${documentNo} · Kalan iş devredildi.`);
      setDialogOpen(false);
      setHandoffTask(null);
      setHandoffUser(null);
      setHandoffReason('');
      onCompleted();
      await queryClient.invalidateQueries({ queryKey: ['advanced-grid', `${TRANSFER_TAB_GRID_PAGE_KEY}-${tab}`] });
      await queryClient.invalidateQueries({ queryKey: ['production-work-order-transfer-tasks', transferId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Devir başarısız.');
    } finally {
      setBusy(false);
    }
  }, [
    boardQueryKey,
    documentNo,
    eligibleHandoffUserIds,
    handoffReason,
    handoffTask,
    handoffUser,
    onCompleted,
    queryClient,
    tab,
    transferId,
  ]);

  if (!showHandoff || boardQuery.isLoading || eligibleLiveTasks.length === 0) return null;

  const assignedUsers = handoffTask?.assignments.map((assignment) => assignment.username).join(', ') ?? '';
  const remainingLineCount = handoffTask?.lines.filter((line) => line.processedQuantity < line.requestedQuantity).length ?? 0;

  return (
    <>
      <button
        type="button"
        title="Kalan işi devret"
        aria-label="Kalan işi devret"
        onClick={openDialog}
        className="wms-ops-grid-icon-btn"
      >
        <ArrowRightLeft className="size-3.5" aria-hidden />
      </button>
      {dialogOpen && handoffTask ? (
        <ResponsiveDialog
          onClose={closeDialog}
          title="Kalan işi devret"
          description={`${handoffTask.taskNo} görevi şu an ${assignedUsers || 'atanmış kullanıcı'} üzerinde. Kalan toplama işi seçeceğiniz depo çalışanına devredilir.`}
          className="!max-w-lg border-amber-500/30"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--wms-ops-card-border)] p-3 text-sm text-[var(--wms-app-text-muted)]">
              Devredilecek {remainingLineCount} kalem var. Toplanmış kısım mevcut görevde kalır; mevcut atananlar korunur.
            </div>
            <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
              Devralacak depo çalışanı
              <div className="wms-ops-field-shell w-full min-w-0">
                <PagedAppDropdown<ActiveUserOption>
                  queryKey={['production-transfer-handoff-users', transferId, handoffTask.taskId, board?.eligibleAssignees.length ?? 0]}
                  fetchPage={async (request) => {
                    if (!board) {
                      return {
                        items: [],
                        pageNumber: 1,
                        pageSize: request.pageSize,
                        totalCount: 0,
                        totalPages: 1,
                        hasNextPage: false,
                      };
                    }

                    const normalizedSearch = foldTurkishSearch(request.search?.trim() ?? '');
                    const filtered = board.eligibleAssignees
                      .filter((user) => eligibleHandoffUserIds.has(user.userId))
                      .filter((user) => !normalizedSearch
                        || foldTurkishSearch(user.username).includes(normalizedSearch))
                      .sort((left, right) => left.username.localeCompare(right.username, 'tr'));

                    const totalCount = filtered.length;
                    const start = (request.pageNumber - 1) * request.pageSize;
                    const items = filtered.slice(start, start + request.pageSize).map((assignee) => ({
                      id: assignee.userId,
                      username: assignee.username,
                      email: '',
                      firstName: '',
                      lastName: '',
                      isActive: true,
                    } satisfies ActiveUserOption));

                    return {
                      items,
                      totalCount,
                      pageNumber: request.pageNumber,
                      pageSize: request.pageSize,
                      totalPages: Math.max(1, Math.ceil(totalCount / Math.max(request.pageSize, 1))),
                      hasNextPage: start + request.pageSize < totalCount,
                    };
                  }}
                  toOption={(user) => ({
                    value: encodeHandoffUser(user),
                    label: `${user.firstName} ${user.lastName}`.trim() || user.username,
                    description: `${user.username} · ${user.email}`,
                  })}
                  value={handoffUser ? encodeHandoffUser(handoffUser) : null}
                  selectedOption={handoffUser ? {
                    value: encodeHandoffUser(handoffUser),
                    label: `${handoffUser.firstName} ${handoffUser.lastName}`.trim() || handoffUser.username,
                  } : undefined}
                  onValueChange={(value) => setHandoffUser(value ? decodeHandoffUser(value) : null)}
                  searchable
                  minSearchLength={1}
                  portalContainer={null}
                  contentClassName={HANDOFF_DIALOG_DROPDOWN_CONTENT}
                  className={cn(OPS_SELECT_TRIGGER_CLASS, 'w-full')}
                  placeholder="Depo çalışanı seçin"
                />
              </div>
            </label>
            <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">
              Devir nedeni
              <AppInput
                value={handoffReason}
                onChange={(event) => setHandoffReason(event.target.value)}
                maxLength={1000}
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-[var(--wms-ops-card-border)] pt-4">
              <OpsActionButton
                type="button"
                variant="secondary"
                className="wms-ops-list-toolbar-btn"
                disabled={busy}
                onClick={closeDialog}
              >
                Vazgeç
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="primary"
                className="wms-ops-list-toolbar-btn"
                disabled={busy || !handoffUser || handoffReason.trim().length < 3}
                onClick={() => void submit()}
              >
                <ArrowRightLeft className="size-3.5" aria-hidden />
                Kalan işi devret
              </OpsActionButton>
            </div>
          </div>
        </ResponsiveDialog>
      ) : null}
    </>
  );
}

export type ProductionWorkOrderTransferGridRow = WarehouseTransferGridRow & {
  source: ProductionWorkOrderTransferHeaderRow;
  warehouseFlow: string;
  projectCode?: string;
  externalReferenceNo?: string;
  productionOrderNo?: string;
  remainingQuantity: number;
  cancelledWorkOrder?: ProductionSourceWorkOrder;
  /** Toplamada sekmesinde Benim İşlerim API'si ile eşleşen transferler. */
  hasMyAssignment?: boolean;
  /** Depo havuzunda, henüz kimseye atanmamış açık toplama görevi. */
  hasPoolTask?: boolean;
  poolTaskId?: number;
};

function isClaimablePoolTaskRow(row: ProductionTaskPoolRow): boolean {
  return row.taskType === 'Pick'
    && row.taskStatus === 'Open'
    && row.assignedUsers.length === 0;
}

function buildPoolTaskIdsByTransferId(poolRows: ProductionTaskPoolRow[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const poolRow of poolRows) {
    if (!isClaimablePoolTaskRow(poolRow)) continue;
    map.set(poolRow.transferId, poolRow.taskId);
  }
  return map;
}

function canShowTransferOperations(
  row: ProductionWorkOrderTransferGridRow,
  tab: ProductionWorkOrderTransferTab,
): boolean {
  if (row.status === 'Cancelled') return false;
  if (tab === 'MyAssignments') return true;
  if (tab === 'Picking') return Boolean(row.hasMyAssignment) && row.status !== 'Draft';
  return row.status !== 'Draft';
}

const isCancelledWorkOrderAssignmentRow = (
  row: ProductionWorkOrderTransferGridRow,
): row is ProductionWorkOrderTransferGridRow & { cancelledWorkOrder: ProductionSourceWorkOrder } =>
  row.cancelledWorkOrder != null;

const SEARCHABLE_KEYS = [
  'documentNo',
  'warehouseFlow',
  'projectCode',
  'status',
  'externalReferenceNo',
  'productionOrderNo',
  'id',
  'createdBy',
  'updatedBy',
];

function warehouseFlowLabel(sourceCode: unknown, targetCode: unknown): string {
  return `${sourceCode} → ${targetCode}`;
}

function transferRemainingQuantity(requestedQuantity: number, pickedQuantity: number): number {
  return Math.max(0, requestedQuantity - pickedQuantity);
}

function toGridRow(row: ProductionWorkOrderTransferHeaderRow): ProductionWorkOrderTransferGridRow {
  return {
    id: row.transferId,
    branchCode: '0',
    documentNo: row.documentNo,
    documentDate: row.documentDate?.slice(0, 10) ?? row.createdDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    businessContext: 'ProductionMaterialSupply',
    initiationMode: (row.initiationMode ?? 'StockBased') as WarehouseTransferGridRow['initiationMode'],
    processType: 'PlannedTask',
    status: row.transferStatus as WarehouseTransferGridRow['status'],
    approvalStatus: 'NotRequired',
    erpIntegrationStatus: (row.erpIntegrationStatus ?? 'Pending') as WarehouseTransferGridRow['erpIntegrationStatus'],
    sourceWarehouseId: row.sourceWarehouseId,
    sourceWarehouseCode: row.sourceWarehouseCode,
    sourceWarehouseName: row.sourceWarehouseName,
    targetWarehouseId: row.targetWarehouseId,
    targetWarehouseCode: row.targetWarehouseCode,
    targetWarehouseName: row.targetWarehouseName,
    warehouseFlow: warehouseFlowLabel(row.sourceWarehouseCode, row.targetWarehouseCode),
    projectCode: row.projectCode,
    lineCount: row.lineCount ?? 0,
    requestedQuantity: row.requestedQuantity,
    pickedQuantity: row.pickedQuantity,
    shippedQuantity: row.shippedQuantity ?? 0,
    receivedQuantity: row.receivedQuantity ?? 0,
    putawayQuantity: row.putawayQuantity ?? 0,
    remainingQuantity: transferRemainingQuantity(row.requestedQuantity, row.pickedQuantity),
    priority: 3,
    plannedDispatchAtUtc: undefined,
    plannedArrivalAtUtc: undefined,
    createdBy: row.createdBy,
    createdDate: row.createdDate,
    updatedBy: row.updatedBy,
    updatedDate: row.updatedDate,
    externalReferenceNo: row.externalReferenceNo,
    productionOrderNo: row.productionOrderNo,
    source: row,
  };
}

function cancelledWorkOrderToGridRow(row: ProductionSourceWorkOrder): ProductionWorkOrderTransferGridRow {
  const cancellationId = row.cancellationId ?? 0;
  // Grid iç kimliği transfer satırlarıyla çakışmasın diye negatif; ekranda cancellationId gösterilir.
  const gridId = cancellationId > 0 ? -cancellationId : -1;
  const documentDate = row.workOrderDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const source: ProductionWorkOrderTransferHeaderRow = {
    transferId: gridId,
    documentNo: row.workOrderNumber,
    externalReferenceNo: row.workOrderNumber,
    productionOrderNo: row.workOrderNumber,
    transferStatus: 'Cancelled',
    workflowStatus: 'Cancelled',
    isResidualHeader: false,
    sourceWarehouseId: 0,
    sourceWarehouseCode: row.issueWarehouseCode,
    sourceWarehouseName: String(row.issueWarehouseCode),
    targetWarehouseId: 0,
    targetWarehouseCode: row.warehouseCode,
    targetWarehouseName: String(row.warehouseCode),
    requestedQuantity: row.workOrderQuantity,
    pickedQuantity: 0,
    documentDate,
    initiationMode: 'StockBasedTask',
    lineCount: row.recipeTotal ?? 0,
    shippedQuantity: 0,
    receivedQuantity: 0,
    putawayQuantity: 0,
    tasks: [],
    projectCode: row.projectCode,
  };

  return {
    ...toGridRow(source),
    id: gridId,
    cancelledWorkOrder: row,
  };
}

export function ProductionWorkOrderTransferTabPanel({
  tab,
  refreshKey = 0,
  hidden = false,
  createdPeriod = null,
  createdPeriodAnchor,
  toolbarBelowExtra,
  onPendingQueueChanged,
  onAfterPoolClaim,
}: {
  tab: ProductionWorkOrderTransferTab;
  refreshKey?: number;
  hidden?: boolean;
  createdPeriod?: CreatedPeriod | null;
  createdPeriodAnchor?: Date;
  toolbarBelowExtra?: ReactNode;
  onPendingQueueChanged?: () => void;
  /** Havuzdan üzerine alındıktan sonra (KKD Hazırlamada → Benim İşlerim geçişi gibi). */
  onAfterPoolClaim?: () => void;
}): ReactElement {
  const { t } = useModuleTranslation('production-transfer');
  const { t: tc, i18n } = useTranslation('common');
  const { can } = usePermissionAccess();
  const navigate = useNavigate();
  const isMyAssignmentsTab = tab === 'MyAssignments';
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const [detailTarget, setDetailTarget] = useState<ProductionWorkOrderTransferHeaderRow | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ProductionWorkOrderTransferHeaderRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ProductionSourceWorkOrder | null>(null);
  const {
    precheckId: cancelPrecheckId,
    blocked: productionCancelBlocked,
    confirm: productionCancelConfirm,
    beginCancel: beginProductionCancel,
    closeBlocked,
    closeConfirm,
  } = useProductionTransferListCancel();

  const periodAnchor = createdPeriodAnchor ?? new Date();
  const periodKey = `${createdPeriod ?? 'all'}:${periodAnchor.getTime()}`;

  const matchesPeriod = useCallback((row: { documentDate?: string; createdDate?: string }) => (
    isInstantInCreatedPeriod(row.documentDate ?? row.createdDate, createdPeriod, periodAnchor)
  ), [createdPeriod, periodAnchor]);

  const fetchPage = useCallback(async (request: GridRequest) => {
    if (tab === 'Cancelled') {
      const [transfers, cancelledWorkOrders] = await Promise.all([
        productionTransferApi.workOrderTransferGroups(tab),
        productionApi.cancelledWorkOrderAssignments(),
      ]);
      const rows = [
        ...cancelledWorkOrders.map(cancelledWorkOrderToGridRow),
        ...transfers.map(toGridRow),
      ].filter(matchesPeriod);
      return filterLocalGridPage(rows, request, SEARCHABLE_KEYS);
    }

    const rows = await productionTransferApi.workOrderTransferGroups(tab);
    if (tab === 'Picking') {
      const [myAssignments, poolRows] = await Promise.all([
        productionTransferApi.workOrderTransferGroups('MyAssignments'),
        productionTransferApi.taskPool(),
      ]);
      const myAssignmentIds = new Set(myAssignments.map((row) => row.transferId));
      const poolTaskIdsByTransferId = buildPoolTaskIdsByTransferId(poolRows);
      return filterLocalGridPage(
        rows.map((row) => {
          const poolTaskId = poolTaskIdsByTransferId.get(row.transferId);
          return {
            ...toGridRow(row),
            hasMyAssignment: myAssignmentIds.has(row.transferId),
            hasPoolTask: poolTaskId != null,
            poolTaskId,
          };
        }).filter(matchesPeriod),
        request,
        SEARCHABLE_KEYS,
      );
    }

    return filterLocalGridPage(
      rows.map((row) => ({
        ...toGridRow(row),
        hasMyAssignment: tab === 'MyAssignments' ? true : undefined,
      })).filter(matchesPeriod),
      request,
      SEARCHABLE_KEYS,
    );
  }, [matchesPeriod, tab, refreshKey]);

  const refreshGroups = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['advanced-grid', `${TRANSFER_TAB_GRID_PAGE_KEY}-${tab}`] });
  }, [queryClient, tab]);

  const refreshAllTransferGrids = useCallback(() => {
    for (const gridTab of ['Picking', 'MyAssignments', 'Completed', 'Cancelled'] as const) {
      void queryClient.invalidateQueries({ queryKey: ['advanced-grid', `${TRANSFER_TAB_GRID_PAGE_KEY}-${gridTab}`] });
    }
  }, [queryClient]);

  const claimPool = useMutation({
    mutationFn: async (payload: { transferId: number; taskId: number }) =>
      productionTransferApi.claimTask(payload.transferId, payload.taskId),
    onSuccess: () => {
      refreshAllTransferGrids();
      onAfterPoolClaim?.();
      toast.success('Görev depo havuzundan üzerinize alındı.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Görev üzerine alınamadı.'),
  });

  const openDetail = (row: ProductionWorkOrderTransferHeaderRow) => {
    setDetailTarget(row);
  };

  const handleRowDoubleClick = useCallback((row: ProductionWorkOrderTransferGridRow) => {
    if (isCancelledWorkOrderAssignmentRow(row)) return;
    if (isMyAssignmentsTab) {
      navigate(`${transferBaseUrl}/${row.id}/operations`);
      return;
    }
    openDetail(row.source);
  }, [isMyAssignmentsTab, navigate]);

  const openWithdrawDraft = (row: ProductionWorkOrderTransferHeaderRow) => {
    setWithdrawTarget(row);
  };

  const columns = useMemo<GridColumn<ProductionWorkOrderTransferGridRow>[]>(() => [
    ...systemColumns<ProductionWorkOrderTransferGridRow>({ searchable: ['id', 'createdBy', 'updatedBy'] })
      .filter((column) => column.key === 'id')
      .map((column) => (
        tab === 'Completed'
        ? {
            ...column,
            label: tc(`${G}.id`),
            render: (row: ProductionWorkOrderTransferGridRow) => {
              const erpError = productionTransferErpErrorMessage(row.source);
              const showErpWarning = productionTransferNeedsErpAttention(row.source);
              return (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold">{row.id}</span>
                  {showErpWarning ? (
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600"
                            aria-label="Netsis aktarım hatası"
                          >
                            <AlertTriangle className="size-3.5" aria-hidden />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {erpError ?? 'Netsis aktarımı başarısız veya belirsiz.'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                </span>
              );
            },
          }
        : tab === 'Cancelled'
          ? {
              ...column,
              label: tc(`${G}.id`),
              contextValue: (row: ProductionWorkOrderTransferGridRow) => (
                isCancelledWorkOrderAssignmentRow(row)
                  ? row.cancelledWorkOrder.cancellationId ?? row.id
                  : row.id
              ),
              render: (row: ProductionWorkOrderTransferGridRow) => (
                <span className="font-mono text-xs font-semibold">
                  {isCancelledWorkOrderAssignmentRow(row)
                    ? row.cancelledWorkOrder.cancellationId
                    : row.id}
                </span>
              ),
            }
          : {
              ...column,
              label: tc(`${G}.id`),
              render: (row: ProductionWorkOrderTransferGridRow) => (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold">{row.id}</span>
                  {tab === 'Picking' ? (
                    <TransferPickingProgressRing source={row.source} />
                  ) : null}
                </span>
              ),
            }
    )),
    {
      key: 'documentNo',
      label: tc(`${G}.documentNo`),
      sortable: true,
      filterable: true,
      render: (row) => {
        if (isCancelledWorkOrderAssignmentRow(row)) {
          const workOrder = row.cancelledWorkOrder;
          return (
            <>
              <strong className="font-mono font-semibold text-[var(--wms-brand-primary)]">{workOrder.workOrderNumber}</strong>
              <div className="mt-1">
                <OpsStatusBadge tone="pending">İş emri iptali</OpsStatusBadge>
              </div>
              <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
                {workOrder.stockCode}{workOrder.stockName ? ` · ${workOrder.stockName}` : ''}
              </div>
            </>
          );
        }

        return (
        <>
          <strong className="font-mono font-semibold text-[var(--wms-brand-primary)]">{row.documentNo}</strong>
          {row.source.isResidualHeader ? (
            <div className="mt-1">
              <OpsStatusBadge tone="pending">Kalan transfer</OpsStatusBadge>
            </div>
          ) : null}
          {row.source.residualDocumentNo ? (
            <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
              Kalan: {row.source.residualDocumentNo}
            </div>
          ) : null}
        </>
        );
      },
    },
    {
      key: 'documentDate',
      label: tc(`${G}.documentDate`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectDate(row.documentDate),
    },
    {
      key: 'warehouseFlow',
      label: 'Depo akışı',
      sortable: true,
      filterable: true,
      render: (row) => row.warehouseFlow,
    },
    {
      key: 'projectCode',
      label: 'Proje kodu',
      sortable: true,
      filterable: true,
      render: (row) => row.projectCode || '—',
    },
    {
      key: 'status',
      label: tc(`${G}.status`),
      sortable: true,
      filterable: true,
      render: (row) => {
        const label = isCancelledWorkOrderAssignmentRow(row)
          ? 'Atama iptali'
          : usesPickingStatusLabel(tab)
            ? productionWorkOrderTransferPickingStatusLabel(
                row.source,
                productionTransferEnumLabel(t, 'transferStatus', row.status),
              )
            : productionTransferEnumLabel(t, 'transferStatus', row.status);
        return (
          <div className="flex justify-center">
            <OpsStatusBadge tone={inferOpsStatusTone(`${row.status} ${label}`)}>
              {label}
            </OpsStatusBadge>
          </div>
        );
      },
    },
    {
      key: 'lineCount',
      label: tc(`${G}.lineCount`),
      sortable: true,
      filterable: true,
      render: (row) => row.lineCount,
    },
    {
      key: 'requestedQuantity',
      label: tc(`${G}.planned`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectNumber(row.requestedQuantity),
    },
    {
      key: 'remainingQuantity',
      label: tc(`${G}.remaining`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectNumber(row.remainingQuantity),
    },
    ...systemColumns<ProductionWorkOrderTransferGridRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }).filter((column) => column.key !== 'id'),
    {
      key: 'actions',
      label: tc(`${G}.actions`),
      ...requiredActionColumn,
      width: tab === 'Picking' ? 280 : tab === 'MyAssignments' ? 200 : 220,
      render: (row) => (
        <div className="wms-ops-row-actions" onClick={(event) => event.stopPropagation()}>
          {isCancelledWorkOrderAssignmentRow(row) ? (
            can('WMS.PRODUCTION_TRANSFER.CREATE') ? (
              <button
                type="button"
                title="İş emrini geri getir"
                aria-label="İş emrini geri getir"
                onClick={() => setRestoreTarget(row.cancelledWorkOrder)}
                className="wms-ops-grid-icon-btn"
              >
                <RotateCcw className="size-3.5" aria-hidden />
              </button>
            ) : null
          ) : (
          <>
          <button
            type="button"
            title="Detayı göster"
            aria-label="Detayı göster"
            onClick={() => openDetail(row.source)}
            className="wms-ops-grid-icon-btn"
          >
            <Eye className="size-3.5" aria-hidden />
          </button>
          <TransferHandoffAction
            transferId={row.id}
            documentNo={row.documentNo}
            tab={tab}
            onCompleted={refreshGroups}
          />
          {tab === 'Picking'
            && can('WMS.PRODUCTION_TRANSFER.OPERATE')
            && row.hasPoolTask
            && row.poolTaskId
            && !row.hasMyAssignment
            && row.status !== 'Cancelled' ? (
            <button
              type="button"
              className="wms-ops-grid-icon-btn"
              title="Havuzdan üzerime al"
              aria-label="Havuzdan üzerime al"
              disabled={claimPool.isPending}
              onClick={() => claimPool.mutate({ transferId: row.id, taskId: row.poolTaskId! })}
            >
              <Users className="size-3.5" aria-hidden />
            </button>
          ) : null}
          {canShowTransferOperations(row, tab) ? (
            <Link
              to={`${transferBaseUrl}/${row.id}/operations`}
              title="Toplama yap"
              aria-label="Toplama yap"
              className="wms-ops-grid-icon-btn"
            >
              <PackageCheck className="size-3.5" aria-hidden />
            </Link>
          ) : null}
          {row.status === 'Draft' && tab !== 'MyAssignments' ? (
            <button
              type="button"
              title="Atanan stokları geri al"
              aria-label="Atanan stokları geri al"
              onClick={() => openWithdrawDraft(row.source)}
              className="wms-ops-grid-icon-btn"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          ) : null}
          {row.status !== 'Cancelled' && tab !== 'MyAssignments' ? (
            <button
              type="button"
              title="Transferi iptal et"
              aria-label="Transferi iptal et"
              disabled={cancelPrecheckId === row.id}
              onClick={() => void beginProductionCancel(row)}
              className="wms-ops-grid-icon-btn !text-rose-600 disabled:opacity-50"
            >
              {cancelPrecheckId === row.id
                ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                : <Ban className="size-3.5" aria-hidden />}
            </button>
          ) : null}
          </>
          )}
        </div>
      ),
    },
  ], [
    can,
    beginProductionCancel,
    cancelPrecheckId,
    claimPool,
    gridLanguage,
    isMyAssignmentsTab,
    t,
    tab,
    tc,
    refreshGroups,
  ]);

  return (
    <div hidden={hidden}>
      <AdvancedDataGrid<ProductionWorkOrderTransferGridRow>
        compactShell
        title=""
        pageKey={`${TRANSFER_TAB_GRID_PAGE_KEY}-${tab}`}
        refreshKey={`${refreshKey}:${periodKey}`}
        retainQueryCache
        columns={columns}
        fetchPage={fetchPage}
        toolbarBelowExtra={toolbarBelowExtra}
        emptyMessage={`${TAB_LABELS[tab]} sekmesinde kayıt bulunamadı.`}
        onRowDoubleClick={handleRowDoubleClick}
      />

      {productionCancelBlocked ? (
        <ProductionTransferCancelBlockedDialog
          documentNo={productionCancelBlocked.row.documentNo}
          transferId={productionCancelBlocked.row.id}
          readiness={productionCancelBlocked.readiness}
          canAssign={can('WMS.PRODUCTION_TRANSFER.ASSIGN')}
          onClose={closeBlocked}
          onReturnTasksStarted={() => {
            closeBlocked();
            refreshGroups();
          }}
        />
      ) : null}
      {productionCancelConfirm ? (
        <ProductionTransferCancelConfirmDialog
          documentNo={productionCancelConfirm.row.documentNo}
          transferId={productionCancelConfirm.row.id}
          sourceWarehouseId={productionCancelConfirm.sourceWarehouseId}
          policy={productionCancelConfirm.policy}
          onClose={closeConfirm}
          onCompleted={() => { closeConfirm(); refreshGroups(); }}
        />
      ) : null}

      {detailTarget ? (
        <ProductionTransferDetailDialog
          transferId={detailTarget.transferId}
          summary={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      ) : null}

      {withdrawTarget ? (
        <ProductionTransferDraftWithdrawDialog
          row={withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          onCompleted={() => {
            refreshGroups();
            onPendingQueueChanged?.();
          }}
        />
      ) : null}

      {restoreTarget ? (
        <ProductionWorkOrderAssignmentRestoreDialog
          row={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onCompleted={() => {
            setRestoreTarget(null);
            refreshGroups();
          }}
        />
      ) : null}
    </div>
  );
}

export const PRODUCTION_WORK_ORDER_TRANSFER_TABS = [
  { key: 'pending', label: 'Atanmayanlar' },
  { key: 'picking', label: 'Toplamada', apiTab: 'Picking' as ProductionWorkOrderTransferTab },
  { key: 'completed', label: 'Tamamlanan', apiTab: 'Completed' as ProductionWorkOrderTransferTab },
  { key: 'cancelled', label: 'İptal Edilen', apiTab: 'Cancelled' as ProductionWorkOrderTransferTab },
  { key: 'mine', label: 'Benim İşlerim', apiTab: 'MyAssignments' as ProductionWorkOrderTransferTab },
] as const;

export type ProductionWorkOrderPageTab = typeof PRODUCTION_WORK_ORDER_TRANSFER_TABS[number]['key'];

export const PRODUCTION_WORK_ORDERS_PAGE_PATH = '/warehouse/production/work-orders';

export function isProductionWorkOrderPageTab(value: string | null | undefined): value is ProductionWorkOrderPageTab {
  return PRODUCTION_WORK_ORDER_TRANSFER_TABS.some((tab) => tab.key === value);
}

export function productionWorkOrdersPageUrl(tab: ProductionWorkOrderPageTab = 'pending'): string {
  return tab === 'pending'
    ? PRODUCTION_WORK_ORDERS_PAGE_PATH
    : `${PRODUCTION_WORK_ORDERS_PAGE_PATH}?tab=${tab}`;
}

export const PRODUCTION_WORK_ORDERS_MY_ASSIGNMENTS_URL = productionWorkOrdersPageUrl('mine');

export function workOrderTransferApiTab(tab: ProductionWorkOrderPageTab): ProductionWorkOrderTransferTab {
  const match = PRODUCTION_WORK_ORDER_TRANSFER_TABS.find((item) => item.key === tab);
  return match && 'apiTab' in match ? match.apiTab : 'Picking';
}
