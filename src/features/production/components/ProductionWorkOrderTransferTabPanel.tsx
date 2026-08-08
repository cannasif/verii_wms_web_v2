import { Fragment, useCallback, useMemo, useState, type ReactElement } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  PlayCircle,
  RotateCcw,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import {
  ProductionTransferCancelBlockedDialog,
  ProductionTransferCancelConfirmDialog,
} from '@/features/production-transfer/components/ProductionTransferCancelDialogs';
import { ProductionTransferDetailDialog } from '@/features/production-transfer/components/ProductionTransferDetailDialog';
import {
  describeHandoffRelation,
  mapBoardTasksToChainRows,
  orderTasksForDisplay,
  taskDisplayName,
} from '@/features/production-transfer/production-transfer-task-chain';
import { useProductionTransferListCancel } from '@/features/production-transfer/hooks/useProductionTransferListCancel';
import {
  productionTransferApi,
  type ProductionTaskBoard,
  type ProductionWorkOrderTransferHeaderRow,
  type ProductionWorkOrderTransferTab,
  type ProductionWorkOrderTransferTaskRow,
} from '@/features/production-transfer/api';
import { productionTaskTypeLabel } from '@/features/production-transfer/production-transfer-task-labels';
import { productionTransferEnumLabel } from '@/features/production-transfer/localization/enum-labels';
import { taskLineageHasProgress } from '@/features/production-transfer/production-transfer-task-progress';
import { transferApiFor } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import type { WarehouseTransferGridRow } from '@/features/warehouse-transfer-v2/types/warehouse-transfer.types';

const TAB_LABELS: Record<ProductionWorkOrderTransferTab, string> = {
  Picking: 'Toplamada',
  Completed: 'Tamamlanan',
  Cancelled: 'İptal Edilen',
};

const CELL =
  'border-r border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-2 py-2 text-center align-middle last:border-r-0';

const TASK_CELL =
  'border-r border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] px-2 py-2 align-top text-left last:border-r-0';

const TASK_HEAD = cn(
  TASK_CELL,
  'align-middle text-xs uppercase text-[var(--wms-app-text-muted)]',
);

const transferBaseUrl = '/warehouse/production-transfers';

function toGridRow(row: ProductionWorkOrderTransferHeaderRow): WarehouseTransferGridRow {
  return {
    id: row.transferId,
    branchCode: '0',
    documentNo: row.documentNo,
    documentDate: row.createdDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    businessContext: 'ProductionMaterialSupply',
    initiationMode: 'StockBased',
    processType: 'PlannedTask',
    status: row.transferStatus as WarehouseTransferGridRow['status'],
    approvalStatus: 'NotRequired',
    erpIntegrationStatus: 'Pending',
    sourceWarehouseId: row.sourceWarehouseId,
    sourceWarehouseCode: row.sourceWarehouseCode,
    sourceWarehouseName: row.sourceWarehouseName,
    targetWarehouseId: row.targetWarehouseId,
    targetWarehouseCode: row.targetWarehouseCode,
    targetWarehouseName: row.targetWarehouseName,
    lineCount: row.tasks.length,
    requestedQuantity: row.requestedQuantity,
    pickedQuantity: row.pickedQuantity,
    shippedQuantity: 0,
    receivedQuantity: 0,
    putawayQuantity: 0,
    priority: 3,
    plannedDispatchAtUtc: undefined,
    plannedArrivalAtUtc: undefined,
    createdBy: undefined,
    createdDate: row.createdDate,
    updatedBy: undefined,
    updatedDate: undefined,
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
  const readOnly = tab === 'Cancelled';
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const boardQueryKey = ['production-transfer', 'board', transferId] as const;
  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => productionTransferApi.taskBoard(transferId),
    enabled: !readOnly && Number.isFinite(transferId) && transferId > 0,
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
          ? { ...row, displayLabel: meta.displayLabel, displaySuffix: meta.displaySuffix }
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
      await queryClient.invalidateQueries({ queryKey: ['production-work-order-transfer-groups'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }, [boardQueryKey, onBoardChanged, queryClient]);

  if (!readOnly && boardQuery.isLoading) {
    return (
      <div className="px-4 py-3">
        <OpsLoadingState message="Görevler yükleniyor…" code="TASKS" compact />
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_4%,transparent)] px-3 py-4">
      <table
        className={cn(
          'wms-ops-data-grid w-full min-w-[920px] border-collapse text-sm',
          tab !== 'Picking' && 'wms-ops-data-grid--no-row-hover',
        )}
      >
        <thead>
          <tr className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_16%,var(--wms-ops-card-border))]">
            <th className={TASK_HEAD}>Görev</th>
            <th className={TASK_HEAD}>Tür</th>
            <th className={TASK_HEAD}>Durum</th>
            <th className={cn(TASK_HEAD, 'text-right')}>Planlanan</th>
            <th className={cn(TASK_HEAD, 'text-right')}>Yapılan</th>
            <th className={TASK_HEAD}>Atananlar</th>
            {!readOnly ? <th className={cn(TASK_HEAD, 'w-[1%] whitespace-nowrap')}>İşlem</th> : null}
          </tr>
        </thead>
        <tbody>
          {orderedTasks.map((task) => {
            const liveTask = board?.tasks.find((item) => item.taskId === task.taskId);
            const hasProgress = liveTask ? taskLineageHasProgress(liveTask, board?.tasks ?? []) : false;
            const returnTask = board?.tasks.find((item) =>
              item.originTaskId === task.taskId && item.status !== 'Cancelled');
            const assignableUserId = selectedUsers[task.taskId];
            const handoffHint = describeHandoffRelation(task, orderedTasks);
            return (
              <tr key={task.taskId} className="border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_12%,var(--wms-ops-card-border))]">
                <td className={TASK_CELL}>
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
                <td className={cn(TASK_CELL, 'text-right')}>{formatProjectNumber(task.plannedQuantity)}</td>
                <td className={cn(TASK_CELL, 'text-right')}>{formatProjectNumber(task.processedQuantity)}</td>
                <td className={TASK_CELL}>{task.assignedUsernames.join(', ') || 'Atanmamış'}</td>
                {!readOnly ? (
                  <td className={cn(TASK_CELL, 'w-[1%] whitespace-nowrap')}>
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                      {canAssign && liveTask && hasProgress && !returnTask ? (
                        <button
                          type="button"
                          title="İade ataması oluştur"
                          disabled={busy}
                          onClick={() => {
                            const assignment = liveTask.assignments[0];
                            if (!assignment) {
                              toast.error('İade için atanmış kullanıcı bulunamadı.');
                              return;
                            }
                            void run(() =>
                              productionTransferApi.requestAssignmentReturn(
                                transferId,
                                liveTask.taskId,
                                assignment.userId,
                              ));
                          }}
                          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-500/10 disabled:opacity-40"
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          İade
                        </button>
                      ) : null}
                      {tab === 'Picking'
                        && canAssign && liveTask
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
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductionWorkOrderTransferTabPanel({
  tab,
  search,
}: {
  tab: ProductionWorkOrderTransferTab;
  search?: string;
}): ReactElement {
  const { t } = useModuleTranslation('production-transfer');
  const transferApi = useMemo(() => transferApiFor('production'), []);
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [detailTarget, setDetailTarget] = useState<ProductionWorkOrderTransferHeaderRow | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionWorkOrderTransferHeaderRow | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const {
    precheckId: cancelPrecheckId,
    blocked: productionCancelBlocked,
    confirm: productionCancelConfirm,
    beginCancel: beginProductionCancel,
    closeBlocked,
    closeConfirm,
  } = useProductionTransferListCancel();

  const query = useQuery({
    queryKey: ['production-work-order-transfer-groups', tab, search ?? ''],
    queryFn: () => productionTransferApi.workOrderTransferGroups(tab, search),
    refetchOnWindowFocus: true,
  });

  const refreshGroups = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['production-work-order-transfer-groups'] });
  }, [queryClient]);

  const toggleExpanded = (transferId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(transferId)) next.delete(transferId);
      else next.add(transferId);
      return next;
    });
  };

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

  const deleteDraft = async () => {
    if (!deleteTarget) return;
    setDeletingDraft(true);
    try {
      await transferApi.deleteDraft(deleteTarget.transferId);
      toast.success('Taslak silindi.');
      setDeleteTarget(null);
      refreshGroups();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Taslak silinemedi.');
    } finally {
      setDeletingDraft(false);
    }
  };

  const rows = query.data ?? [];

  return (
    <>
      <div className="relative mt-4 block max-h-[max(20rem,calc(100dvh-26rem))] overflow-x-auto overflow-y-auto border border-[var(--wms-ops-card-border)]">
        <table className="wms-ops-data-grid w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={cn(CELL, 'w-10')} aria-label="Genişlet" />
              <th className={CELL}>Transfer</th>
              <th className={CELL}>İş emri</th>
              <th className={CELL}>Akış</th>
              <th className={CELL}>Depo akışı</th>
              <th className={CELL}>Plan / toplanan</th>
              <th className={CELL}>Tarih</th>
              <th className={CELL} aria-label="İşlem" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={8} className="wms-ops-grid-state-cell">
                  <OpsLoadingState message={`${TAB_LABELS[tab]} transferleri yükleniyor…`} code="FETCH" compact />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message={`${TAB_LABELS[tab]} sekmesinde transfer bulunamadı.`} />
                </td>
              </tr>
            ) : rows.map((row) => {
              const expanded = expandedIds.has(row.transferId);
              const gridRow = toGridRow(row);
              return (
                <Fragment key={row.transferId}>
                  <tr className="align-top">
                    <td className={CELL}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Satırı daralt' : 'Görevleri göster'}
                        onClick={() => toggleExpanded(row.transferId)}
                        className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-[var(--wms-brand-primary)]/10"
                      >
                        {expanded
                          ? <ChevronDown className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />
                          : <ChevronRight className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />}
                      </button>
                    </td>
                    <td className={cn(CELL, 'text-left')}>
                      <strong className="font-mono text-[var(--wms-brand-primary)]">{row.documentNo}</strong>
                      {row.isResidualHeader ? (
                        <div className="mt-1">
                          <OpsStatusBadge tone="pending">Kalan transfer</OpsStatusBadge>
                        </div>
                      ) : null}
                      {row.residualDocumentNo ? (
                        <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
                          Kalan: {row.residualDocumentNo}
                        </div>
                      ) : null}
                    </td>
                    <td className={CELL}>{row.productionOrderNo || row.externalReferenceNo || '—'}</td>
                    <td className={CELL}>
                      <div>{productionTransferEnumLabel(t, 'transferStatus', row.transferStatus)}</div>
                      <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
                        {productionTransferEnumLabel(t, 'workflowStatus', row.workflowStatus)}
                      </div>
                    </td>
                    <td className={CELL}>
                      {row.sourceWarehouseCode} → {row.targetWarehouseCode}
                    </td>
                    <td className={CELL}>
                      {formatProjectNumber(row.requestedQuantity)} / {formatProjectNumber(row.pickedQuantity)}
                    </td>
                    <td className={CELL}>{formatProjectDate(row.createdDate)}</td>
                    <td className={CELL}>
                      <div className="flex items-center justify-center gap-1">
                        {row.transferStatus !== 'Cancelled' ? (
                          <Link
                            to={`${transferBaseUrl}/${row.transferId}/operations`}
                            title="Operasyonu yürüt"
                            className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10"
                          >
                            <PlayCircle className="size-4" aria-hidden />
                          </Link>
                        ) : null}
                        {row.transferStatus === 'Draft' ? (
                          <>
                            <button
                              type="button"
                              title="Taslağı düzenle"
                              disabled={loadingEditId === row.transferId}
                              onClick={() => void openEdit(row)}
                              className="rounded-lg p-2 text-amber-500 hover:bg-amber-500/10"
                            >
                              {loadingEditId === row.transferId
                                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                                : <Pencil className="size-4" aria-hidden />}
                            </button>
                            <button
                              type="button"
                              title="Taslağı sil"
                              onClick={() => setDeleteTarget(row)}
                              className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </>
                        ) : null}
                        {row.transferStatus !== 'Cancelled' ? (
                          <button
                            type="button"
                            title="Transferi iptal et"
                            disabled={cancelPrecheckId === row.transferId}
                            onClick={() => void beginProductionCancel(gridRow)}
                            className="rounded-lg p-2 text-orange-500 hover:bg-orange-500/10 disabled:opacity-50"
                          >
                            {cancelPrecheckId === row.transferId
                              ? <Loader2 className="size-4 animate-spin" aria-hidden />
                              : <Ban className="size-4" aria-hidden />}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Detayı göster"
                          onClick={() => openDetail(row)}
                          className="rounded-lg p-2 text-violet-500 hover:bg-violet-500/10"
                        >
                          <Eye className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <ExpandedTransferTasks
                          transferId={row.transferId}
                          tasks={row.tasks}
                          tab={tab}
                          onBoardChanged={refreshGroups}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        title="Taslağı sil"
        description={deleteTarget ? `${deleteTarget.documentNo} taslağı kalıcı olarak silinecek.` : undefined}
        confirmLabel="Sil"
        isPending={deletingDraft}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={deleteDraft}
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
] as const;

export type ProductionWorkOrderPageTab = typeof PRODUCTION_WORK_ORDER_TRANSFER_TABS[number]['key'];

export function workOrderTransferApiTab(tab: ProductionWorkOrderPageTab): ProductionWorkOrderTransferTab {
  const match = PRODUCTION_WORK_ORDER_TRANSFER_TABS.find((item) => item.key === tab);
  return match && 'apiTab' in match ? match.apiTab : 'Picking';
}
