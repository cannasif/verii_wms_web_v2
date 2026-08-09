import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  PlayCircle,
  RotateCcw,
  UserPlus,
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
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { localizeEnumValue } from '@/lib/enum-localization';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import {
  ProductionTransferCancelBlockedDialog,
  ProductionTransferCancelConfirmDialog,
} from '@/features/production-transfer/components/ProductionTransferCancelDialogs';
import { ProductionTransferDetailDialog } from '@/features/production-transfer/components/ProductionTransferDetailDialog';
import {
  productionTransferErpErrorMessage,
  productionTransferNeedsErpAttention,
} from '@/features/production-transfer/production-transfer-erp-posting';
import {
  describeHandoffRelation,
  mapBoardTasksToChainRows,
  formatTaskAssignees,
  orderTasksForDisplay,
  taskDisplayName,
} from '@/features/production-transfer/production-transfer-task-chain';
import { useProductionTransferListCancel } from '@/features/production-transfer/hooks/useProductionTransferListCancel';
import {
  productionTransferApi,
  type ProductionTask,
  type ProductionTaskBoard,
  type ProductionWorkOrderTransferHeaderRow,
  type ProductionWorkOrderTransferTab,
  type ProductionWorkOrderTransferTaskRow,
} from '@/features/production-transfer/api';
import {
  productionTaskTypeLabel,
  productionWorkOrderTransferPickingStatusLabel,
} from '@/features/production-transfer/production-transfer-task-labels';
import { productionTransferEnumLabel } from '@/features/production-transfer/localization/enum-labels';
import { taskLineageHasProgress } from '@/features/production-transfer/production-transfer-task-progress';
import { isReturnTaskType } from '@/features/production-transfer/production-transfer-task-chain';
import { transferApiFor } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { WarehouseTransferGridRow } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';
import { filterLocalGridPage } from '../production-work-order-transfer-grid.utils';

const TAB_LABELS: Record<ProductionWorkOrderTransferTab, string> = {
  Picking: 'Toplamada',
  Completed: 'Tamamlanan',
  Cancelled: 'İptal Edilen',
  MyAssignments: 'Benim İşlerim',
};

const usesPickingStatusLabel = (tab: ProductionWorkOrderTransferTab): boolean =>
  tab === 'Picking' || tab === 'MyAssignments';

const TASK_CELL =
  'border-r border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-2 py-2 text-center align-middle last:border-r-0';

const TASK_NAME_COL = cn(
  TASK_CELL,
  'min-w-[20rem] w-[20rem] whitespace-normal text-left',
);

const TASK_NAME_HEAD = cn(
  TASK_CELL,
  'min-w-[20rem] w-[20rem] text-left',
);

const TASK_ACTIONS_COL = cn(
  TASK_CELL,
  'min-w-[22rem] w-[22rem] whitespace-normal text-right',
);

const TASK_HEAD = TASK_CELL;

const TASK_ACTIONS_HEAD = cn(
  TASK_CELL,
  'min-w-[22rem] w-[22rem] text-right',
);

const transferBaseUrl = '/warehouse/production-transfers';
const G = 'dataGrid.transferRecords';

function isActiveTaskStatus(status: string): boolean {
  return !['Completed', 'Cancelled'].includes(status);
}

function canRequestAssignmentReturn(
  task: ProductionWorkOrderTransferTaskRow,
  liveTask: ProductionTask | undefined,
  boardTasks: ProductionTask[] | undefined,
  hasProgress: boolean,
): boolean {
  if (!liveTask || isReturnTaskType(task.taskType) || !isActiveTaskStatus(task.status)) return false;
  if (liveTask.assignments.length === 0 || !hasProgress) return false;

  const hasCompletedReturn = boardTasks?.some((item) =>
    item.taskType === 'AssignmentReturn'
    && item.originTaskId === task.taskId
    && item.status === 'Completed') ?? false;
  if (hasCompletedReturn) return false;

  const hasOpenReturn = boardTasks?.some((item) =>
    item.taskType === 'AssignmentReturn'
    && item.originTaskId === task.taskId
    && !['Completed', 'Cancelled'].includes(item.status)) ?? false;
  return !hasOpenReturn;
}

export type ProductionWorkOrderTransferGridRow = WarehouseTransferGridRow & {
  source: ProductionWorkOrderTransferHeaderRow;
  externalReferenceNo?: string;
  productionOrderNo?: string;
};

const SEARCHABLE_KEYS = [
  'documentNo',
  'sourceWarehouseCode',
  'sourceWarehouseName',
  'targetWarehouseCode',
  'targetWarehouseName',
  'initiationMode',
  'status',
  'externalReferenceNo',
  'productionOrderNo',
];

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
    lineCount: row.lineCount ?? 0,
    requestedQuantity: row.requestedQuantity,
    pickedQuantity: row.pickedQuantity,
    shippedQuantity: row.shippedQuantity ?? 0,
    receivedQuantity: row.receivedQuantity ?? 0,
    putawayQuantity: row.putawayQuantity ?? 0,
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

function ExpandedTransferTasks({
  transferId,
  tasks,
  tab,
  onBoardChanged,
}: {
  transferId: number;
  tasks: ProductionWorkOrderTransferTaskRow[];
  tab: ProductionWorkOrderTransferTab;
  onBoardChanged: () => void;
}): ReactElement {
  const { t } = useModuleTranslation('production-transfer');
  const canManageAssignments = tab !== 'Cancelled';
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const boardQueryKey = ['production-transfer', 'board', transferId] as const;
  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => productionTransferApi.taskBoard(transferId),
    enabled: canManageAssignments && Number.isFinite(transferId) && transferId > 0,
  });
  const [busy, setBusy] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Record<number, number>>({});
  const canAssign = can('WMS.PRODUCTION_TRANSFER.ASSIGN');
  const board = boardQuery.data;
  const orderedTasks = useMemo(() => {
    if (board?.tasks.length) {
      const metaById = new Map(tasks.map((task) => [task.taskId, task]));
      const merged = mapBoardTasksToChainRows(board.tasks).map((row) => {
        const meta = metaById.get(row.taskId);
        return meta
          ? {
              ...row,
              displayLabel: meta.displayLabel,
              displaySuffix: meta.displaySuffix,
              assignedUsernames: row.assignedUsernames.length > 0
                ? row.assignedUsernames
                : meta.assignedUsernames,
            }
          : row;
      });
      return orderTasksForDisplay(merged);
    }
    return orderTasksForDisplay(tasks);
  }, [board?.tasks, tasks]);

  const run = useCallback(async (action: () => Promise<ProductionTaskBoard>) => {
    setBusy(true);
    try {
      queryClient.setQueryData(boardQueryKey, await action());
      onBoardChanged();
      await queryClient.invalidateQueries({ queryKey: ['advanced-grid', `production-work-order-transfers-${tab}`] });
      await queryClient.invalidateQueries({ queryKey: ['production-work-order-transfer-tasks', transferId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }, [boardQueryKey, onBoardChanged, queryClient, tab]);

  if (canManageAssignments && boardQuery.isLoading) {
    return (
      <div className="wms-ops-grid-state-cell px-4 py-3">
        <OpsLoadingState message="Görevler yükleniyor…" code="TASKS" compact />
      </div>
    );
  }

  return (
    <div className="wms-ops-scrollbar relative block overflow-x-auto overflow-y-auto border border-[var(--wms-ops-card-border)]">
      <table className="wms-ops-data-grid w-full min-w-[1180px] border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={TASK_NAME_HEAD}>Görev</th>
            <th className={TASK_HEAD}>Tür</th>
            <th className={TASK_HEAD}>Durum</th>
            <th className={TASK_HEAD}>Planlanan</th>
            <th className={TASK_HEAD}>Yapılan</th>
            <th className={TASK_HEAD}>Atananlar</th>
            <th className={TASK_ACTIONS_HEAD}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {orderedTasks.map((task) => {
            const liveTask = board?.tasks.find((item) => item.taskId === task.taskId);
            const hasProgress = liveTask ? taskLineageHasProgress(liveTask, board?.tasks ?? []) : false;
            const assignableUserId = selectedUsers[task.taskId];
            const handoffHint = describeHandoffRelation(task, orderedTasks);
            const showExecuteOperation = isReturnTaskType(task.taskType) && isActiveTaskStatus(task.status);
            const showRequestReturn = canManageAssignments
              && canAssign
              && canRequestAssignmentReturn(task, liveTask, board?.tasks, hasProgress);
            return (
              <tr key={task.taskId}>
                <td className={TASK_NAME_COL}>
                  <strong>{taskDisplayName(task)}</strong>
                  {task.displaySuffix ? (
                    <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[0.65rem] font-bold text-cyan-600 dark:text-cyan-300">
                      {task.displaySuffix.replace(/^-/, '')}
                    </span>
                  ) : null}
                  <div className="text-xs text-[var(--wms-app-text-muted)]">{task.taskNo}</div>
                  {handoffHint ? (
                    <div className="mt-1 text-[0.65rem] text-[var(--wms-app-text-muted)]">{handoffHint}</div>
                  ) : null}
                </td>
                <td className={TASK_CELL}>{productionTaskTypeLabel(task.taskType)}</td>
                <td className={TASK_CELL}>{productionTransferEnumLabel(t, 'taskStatus', task.status)}</td>
                <td className={TASK_CELL}>{formatProjectNumber(task.plannedQuantity)}</td>
                <td className={TASK_CELL}>{formatProjectNumber(task.processedQuantity)}</td>
                <td className={TASK_CELL}>{formatTaskAssignees(task.assignedUsernames)}</td>
                <td className={TASK_ACTIONS_COL}>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {showExecuteOperation ? (
                      <Link
                        to={`${transferBaseUrl}/${transferId}/operations`}
                        title="Operasyonu yürüt"
                        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-cyan-500/50 px-3 py-2 text-xs font-bold text-cyan-600 hover:bg-cyan-500/10"
                      >
                        <PlayCircle className="size-4" aria-hidden />
                        Operasyonu yürüt
                      </Link>
                    ) : null}
                    {showRequestReturn ? (
                        <button
                          type="button"
                          title="İade ataması oluştur"
                          disabled={busy}
                          onClick={() => {
                            const assignment = liveTask!.assignments[0];
                            void run(() =>
                              productionTransferApi.requestAssignmentReturn(
                                transferId,
                                liveTask!.taskId,
                                assignment.userId,
                              ));
                          }}
                          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-500/10 disabled:opacity-40"
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          İade
                        </button>
                      ) : null}
                      {canManageAssignments
                        && tab === 'Picking'
                        && canAssign && liveTask
                        && !isReturnTaskType(task.taskType)
                        && isActiveTaskStatus(task.status)
                        && liveTask.assignments.length > 0
                        && liveTask.lines.some((line) => line.processedQuantity < line.requestedQuantity) ? (
                          <>
                            <select
                              className="input !h-8 !min-h-8 !w-auto min-w-32 shrink-0 !rounded-lg !px-3 !py-0 !text-xs leading-8"
                              value={assignableUserId ?? ''}
                              onChange={(event) =>
                                setSelectedUsers((current) => ({
                                  ...current,
                                  [task.taskId]: Number(event.target.value),
                                }))}
                            >
                              <option value="">Depo çalışanı seçin</option>
                              {(board?.eligibleAssignees ?? [])
                                .filter((user) =>
                                  (user.warehouseIds.length === 0 || user.warehouseIds.includes(liveTask.warehouseId))
                                  && !liveTask.assignments.some((assignment) => assignment.userId === user.userId))
                                .map((user) => (
                                  <option key={user.userId} value={user.userId}>{user.username}</option>
                                ))}
                            </select>
                            <button
                              type="button"
                              disabled={busy || !assignableUserId}
                              onClick={() => void run(() =>
                                productionTransferApi.handoffTask(
                                  transferId,
                                  liveTask.taskId,
                                  assignableUserId,
                                ))}
                              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
                            >
                              <UserPlus className="size-4" aria-hidden />
                              Kalan işi devret
                            </button>
                          </>
                        ) : null}
                    </div>
                  </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductionWorkOrderTransferTaskList({
  transferId,
  tab,
  onBoardChanged,
}: {
  transferId: number;
  tab: ProductionWorkOrderTransferTab;
  onBoardChanged: () => void;
}): ReactElement {
  const tasksQuery = useQuery({
    queryKey: ['production-work-order-transfer-tasks', transferId],
    queryFn: () => productionTransferApi.workOrderTransferGroupTasks(transferId),
    enabled: Number.isFinite(transferId) && transferId > 0,
  });

  if (tasksQuery.isLoading) {
    return (
      <div className="wms-ops-grid-state-cell px-4 py-3">
        <OpsLoadingState message="Görevler yükleniyor…" code="TASKS" compact />
      </div>
    );
  }

  if (tasksQuery.isError) {
    return (
      <div className="wms-ops-grid-state-cell px-4 py-3 text-sm text-rose-500">
        {tasksQuery.error instanceof Error ? tasksQuery.error.message : 'Görevler yüklenemedi.'}
      </div>
    );
  }

  return (
    <ExpandedTransferTasks
      transferId={transferId}
      tasks={tasksQuery.data ?? []}
      tab={tab}
      onBoardChanged={onBoardChanged}
    />
  );
}

export function ProductionWorkOrderTransferTabPanel({
  tab,
  refreshKey = 0,
}: {
  tab: ProductionWorkOrderTransferTab;
  refreshKey?: number;
}): ReactElement {
  const { t } = useModuleTranslation('production-transfer');
  const { t: tc, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const isMyAssignmentsTab = tab === 'MyAssignments';
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const transferApi = useMemo(() => transferApiFor('production'), []);
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailTarget, setDetailTarget] = useState<ProductionWorkOrderTransferHeaderRow | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const {
    precheckId: cancelPrecheckId,
    blocked: productionCancelBlocked,
    confirm: productionCancelConfirm,
    beginCancel: beginProductionCancel,
    closeBlocked,
    closeConfirm,
  } = useProductionTransferListCancel();

  const fetchPage = useCallback(async (request: GridRequest) => {
    const rows = await productionTransferApi.workOrderTransferGroups(tab);
    return filterLocalGridPage(rows.map(toGridRow), request, SEARCHABLE_KEYS);
  }, [tab, refreshKey]);

  const refreshGroups = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['advanced-grid', `production-work-order-transfers-${tab}`] });
  }, [queryClient, tab]);

  const toggleExpanded = useCallback((transferId: number) => {
    setExpandedId((current) => (current === transferId ? null : transferId));
  }, []);

  const handleRowDoubleClick = useCallback((row: ProductionWorkOrderTransferGridRow) => {
    if (isMyAssignmentsTab) {
      navigate(`${transferBaseUrl}/${row.id}/operations`);
      return;
    }
    toggleExpanded(row.id);
  }, [isMyAssignmentsTab, navigate, toggleExpanded]);

  const openDetail = (row: ProductionWorkOrderTransferHeaderRow) => {
    setDetailTarget(row);
  };

  const openEdit = async (row: ProductionWorkOrderTransferHeaderRow) => {
    setLoadingEditId(row.transferId);
    try {
      await transferApi.detail(row.transferId);
      window.open(`${transferBaseUrl}/${row.transferId}`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Taslak açılamadı.');
    } finally {
      setLoadingEditId(null);
    }
  };

  const columns = useMemo<GridColumn<ProductionWorkOrderTransferGridRow>[]>(() => [
    ...(!isMyAssignmentsTab ? [{
      key: 'expand',
      label: '',
      width: 48,
      sortable: false,
      filterable: false,
      searchable: false,
      hideable: false,
      render: (row: ProductionWorkOrderTransferGridRow) => (
        <button
          type="button"
          aria-expanded={expandedId === row.id}
          aria-label={expandedId === row.id ? 'Satırı daralt' : 'Görevleri göster'}
          onClick={() => toggleExpanded(row.id)}
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-[var(--wms-brand-primary)]/10"
        >
          {expandedId === row.id
            ? <ChevronDown className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />
            : <ChevronRight className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />}
        </button>
      ),
    }] satisfies GridColumn<ProductionWorkOrderTransferGridRow>[] : []),
    ...systemColumns<ProductionWorkOrderTransferGridRow>().map((column) => (
      tab === 'Completed' && column.key === 'id'
        ? {
            ...column,
            render: (row: ProductionWorkOrderTransferGridRow) => {
              const erpError = productionTransferErpErrorMessage(row.source);
              const showErpWarning = productionTransferNeedsErpAttention(row.source);
              return (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold">#{row.id}</span>
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
        : column
    )),
    {
      key: 'documentNo',
      label: tc(`${G}.documentNo`),
      sortable: true,
      filterable: true,
      render: (row) => (
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
      ),
    },
    {
      key: 'documentDate',
      label: tc(`${G}.documentDate`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectDate(row.documentDate),
    },
    {
      key: 'sourceWarehouseCode',
      label: tc(`${G}.sourceWarehouseCode`),
      sortable: true,
      filterable: true,
      render: (row) => row.sourceWarehouseCode,
    },
    {
      key: 'sourceWarehouseName',
      label: tc(`${G}.sourceWarehouseName`),
      sortable: true,
      filterable: true,
      render: (row) => row.sourceWarehouseName,
    },
    {
      key: 'targetWarehouseCode',
      label: tc(`${G}.targetWarehouseCode`),
      sortable: true,
      filterable: true,
      render: (row) => row.targetWarehouseCode,
    },
    {
      key: 'targetWarehouseName',
      label: tc(`${G}.targetWarehouseName`),
      sortable: true,
      filterable: true,
      render: (row) => row.targetWarehouseName,
    },
    {
      key: 'initiationMode',
      label: tc(`${G}.flow`),
      sortable: true,
      filterable: true,
      render: (row) => localizeEnumValue(row.initiationMode),
    },
    {
      key: 'status',
      label: tc(`${G}.status`),
      sortable: true,
      filterable: true,
      render: (row) => (usesPickingStatusLabel(tab)
        ? productionWorkOrderTransferPickingStatusLabel(
            row.source,
            productionTransferEnumLabel(t, 'transferStatus', row.status),
          )
        : productionTransferEnumLabel(t, 'transferStatus', row.status)),
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
      key: 'pickedQuantity',
      label: tc(`${G}.picked`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectNumber(row.pickedQuantity),
    },
    {
      key: 'shippedQuantity',
      label: tc(`${G}.shipped`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectNumber(row.shippedQuantity),
    },
    {
      key: 'receivedQuantity',
      label: tc(`${G}.received`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectNumber(row.receivedQuantity),
    },
    {
      key: 'putawayQuantity',
      label: tc(`${G}.putaway`),
      sortable: true,
      filterable: true,
      render: (row) => formatProjectNumber(row.putawayQuantity),
    },
    {
      key: 'actions',
      label: tc(`${G}.actions`),
      ...requiredActionColumn,
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          {row.status !== 'Draft' ? (
            <Link
              to={`${transferBaseUrl}/${row.id}/operations`}
              title="Operasyonu yürüt"
              className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10"
            >
              <PlayCircle className="size-4" aria-hidden />
            </Link>
          ) : null}
          {row.status === 'Draft' && tab !== 'MyAssignments' ? (
            <button
              type="button"
              title="Taslağı düzenle"
              disabled={loadingEditId === row.id}
              onClick={() => void openEdit(row.source)}
              className="rounded-lg p-2 text-amber-500 hover:bg-amber-500/10"
            >
              {loadingEditId === row.id
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : <Pencil className="size-4" aria-hidden />}
            </button>
          ) : null}
          {row.status !== 'Cancelled' && tab !== 'MyAssignments' ? (
            <button
              type="button"
              title="Transferi iptal et"
              disabled={cancelPrecheckId === row.id}
              onClick={() => void beginProductionCancel(row)}
              className="rounded-lg p-2 text-orange-500 hover:bg-orange-500/10 disabled:opacity-50"
            >
              {cancelPrecheckId === row.id
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : <Ban className="size-4" aria-hidden />}
            </button>
          ) : null}
          <button
            type="button"
            title="Detayı göster"
            onClick={() => openDetail(row.source)}
            className="rounded-lg p-2 text-violet-500 hover:bg-violet-500/10"
          >
            <Eye className="size-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ], [
    beginProductionCancel,
    cancelPrecheckId,
    expandedId,
    gridLanguage,
    isMyAssignmentsTab,
    loadingEditId,
    t,
    tab,
    tc,
    toggleExpanded,
  ]);

  return (
    <>
      <AdvancedDataGrid<ProductionWorkOrderTransferGridRow>
        compactShell
        title=""
        pageKey={`production-work-order-transfers-${tab}`}
        refreshKey={refreshKey}
        columns={columns}
        fetchPage={fetchPage}
        emptyMessage={`${TAB_LABELS[tab]} sekmesinde transfer bulunamadı.`}
        expandedRowId={isMyAssignmentsTab ? undefined : expandedId}
        onRowDoubleClick={handleRowDoubleClick}
        renderExpandedRow={isMyAssignmentsTab ? undefined : (row) => (
          <ProductionWorkOrderTransferTaskList
            transferId={row.id}
            tab={tab}
            onBoardChanged={refreshGroups}
          />
        )}
      />

      {productionCancelBlocked ? (
        <ProductionTransferCancelBlockedDialog
          documentNo={productionCancelBlocked.row.documentNo}
          transferId={productionCancelBlocked.row.id}
          readiness={productionCancelBlocked.readiness}
          onClose={closeBlocked}
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
    </>
  );
}

export const PRODUCTION_WORK_ORDER_TRANSFER_TABS = [
  { key: 'pending', label: 'Beklemede' },
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
