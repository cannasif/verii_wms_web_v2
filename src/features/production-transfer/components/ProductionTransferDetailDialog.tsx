import { useMemo, useState, type ReactElement } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatProjectDate, formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { transferApiFor } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import {
  productionTransferApi,
  type ProductionWorkOrderTransferHeaderRow,
} from '../api';
import { ErpPostingPanel, ErpPostingTriggerButton } from './ProductionTransferErpPostingControls';
import {
  productionTransferCanRetryErp,
  productionTransferErpPanelSource,
  productionTransferShowErpControls,
} from '../production-transfer-erp-posting';
import { productionTaskTypeLabel } from '../production-transfer-task-labels';
import {
  describeHandoffRelation,
  formatTaskAssignees,
  orderTasksForDisplay,
  resolveTaskAssignedUsernames,
  taskDisplayName,
} from '../production-transfer-task-chain';

type MainTab = 'info' | 'content' | 'tasks';

const MAIN_TABS: MainTab[] = ['info', 'content', 'tasks'];

const transferBaseUrl = '/warehouse/production-transfers';

export function ProductionTransferDetailDialog({
  transferId,
  summary,
  onClose,
}: {
  transferId: number;
  summary?: ProductionWorkOrderTransferHeaderRow;
  onClose: () => void;
}): ReactElement {
  const { t } = useModuleTranslation('production-transfer');
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTab>('info');
  const [erpPanelOpen, setErpPanelOpen] = useState(false);
  const [erpBusy, setErpBusy] = useState(false);
  const transferApi = useMemo(() => transferApiFor('production'), []);

  const detailQuery = useQuery({
    queryKey: ['production-transfer-detail', transferId],
    queryFn: () => transferApi.detail(transferId),
    enabled: transferId > 0,
  });
  const executionQuery = useQuery({
    queryKey: ['production-transfer-execution', transferId],
    queryFn: () => productionTransferApi.execution(transferId),
    enabled: transferId > 0,
  });
  const boardQuery = useQuery({
    queryKey: ['production-transfer-board', transferId],
    queryFn: () => productionTransferApi.taskBoard(transferId),
    enabled: transferId > 0,
  });

  const loading = detailQuery.isLoading || executionQuery.isLoading || boardQuery.isLoading;
  const detail = detailQuery.data;
  const execution = executionQuery.data;
  const board = boardQuery.data;
  const header = detail?.header;

  const taskRows = useMemo(() => {
    const source = summary?.tasks.length
      ? summary.tasks
      : (board?.tasks.map((task) => ({
          taskId: task.taskId,
          taskNo: task.taskNo,
          displayLabel: task.taskNo,
          displaySuffix: undefined,
          taskType: task.taskType,
          status: task.status,
          warehouseId: task.warehouseId,
          plannedQuantity: task.lines.reduce((sum, line) => sum + line.requestedQuantity, 0),
          processedQuantity: task.lines.reduce((sum, line) => sum + line.processedQuantity, 0),
          remainingQuantity: task.lines.reduce(
            (sum, line) => sum + Math.max(0, line.requestedQuantity - line.processedQuantity),
            0,
          ),
          assignedUsernames: resolveTaskAssignedUsernames(task),
          previousTaskId: task.previousTaskId,
          originTaskId: task.originTaskId,
          originUserId: task.originUserId,
          completedAtUtc: task.completedAtUtc,
        })) ?? []);
    return orderTasksForDisplay(source);
  }, [board?.tasks, summary?.tasks]);

  const documentNo = header?.documentNo ?? summary?.documentNo ?? `#${transferId}`;
  const workflowStatus = execution?.workflowStatus ?? summary?.workflowStatus ?? '—';
  const productionOrderNo = summary?.productionOrderNo ?? summary?.externalReferenceNo ?? header?.documentNo;
  const mainTabIndex = MAIN_TABS.indexOf(mainTab);

  const erpInfo = useMemo(() => {
    const erpPostingPolicy = execution?.erpPostingPolicy ?? summary?.erpPostingPolicy ?? 'Disabled';
    const erpIntegrationStatus = execution?.erpIntegrationStatus
      ?? summary?.erpIntegrationStatus
      ?? 'Pending';
    const workflow = execution?.workflowStatus ?? summary?.workflowStatus ?? 'Planned';
    return {
      erpPostingPolicy,
      erpIntegrationStatus,
      workflowStatus: workflow,
      erpErrorMessage: execution?.erpErrorMessage ?? summary?.erpErrorMessage,
      erpErrorCode: execution?.erpErrorCode ?? summary?.erpErrorCode,
    };
  }, [execution, summary]);

  const showErpControls = productionTransferShowErpControls(erpInfo);
  const erpPanelSource = productionTransferErpPanelSource(execution, summary);
  const canRetryErp = productionTransferCanRetryErp(
    erpInfo.erpIntegrationStatus,
    erpInfo.erpPostingPolicy,
    can('WMS.PRODUCTION_TRANSFER.APPROVE'),
  );

  const postErp = async (): Promise<void> => {
    if (!execution) return;
    setErpBusy(true);
    try {
      const result = await productionTransferApi.postErp(transferId);
      queryClient.setQueryData(['production-transfer-execution', transferId], result);
      await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'production-work-order-transfers-Completed'] });
      if (result.erpIntegrationStatus === 'Succeeded') toast.success(t('execution.erp.retrySucceeded'));
      else if (result.erpIntegrationStatus === 'CommitUncertain') toast.warning(t('execution.erp.uncertainAfterCompletion'));
      else toast.error(result.erpErrorMessage || t('execution.erp.retryFailed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('execution.erp.retryFailed'));
    } finally {
      setErpBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        showCloseButton
        className={cn(
          'wms-ops-detail-dialog wms-ops-form flex !h-[min(90vh,880px)] !max-h-[calc(100dvh-2rem)] w-full !max-w-6xl flex-col !gap-0 overflow-hidden border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] !p-0',
          '[scrollbar-gutter:auto]',
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
                Üretim transferi
              </p>
              <DialogTitle className="wms-ops-detail-dialog__title">
                Belge
                <span className="ml-2 font-mono text-base font-bold text-cyan-600 dark:text-cyan-300">
                  {documentNo}
                </span>
              </DialogTitle>
              <DialogDescription className="wms-ops-detail-dialog__description">
                {productionOrderNo ? `İş emri ${productionOrderNo}` : 'Üretime transfer detayı'}
                {execution ? ` · ${execution.sourceWarehouseName} → ${execution.targetWarehouseName}` : null}
              </DialogDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {header ? <OpsStatusBadge tone="active">{header.status}</OpsStatusBadge> : null}
                <OpsStatusBadge tone="pending">{workflowStatus}</OpsStatusBadge>
                {summary?.isResidualHeader ? <OpsCodeBadge>Kalan transfer</OpsCodeBadge> : null}
                {summary?.residualDocumentNo ? (
                  <OpsCodeBadge>Kalan belge: {summary.residualDocumentNo}</OpsCodeBadge>
                ) : null}
              </div>
            </div>
            {showErpControls && erpPanelSource ? (
              <div className="wms-ops-detail-dialog__header-actions shrink-0 self-end mb-1">
                <ErpPostingTriggerButton
                  status={erpInfo.erpIntegrationStatus}
                  label={t('execution.erp.openPanel')}
                  onClick={() => setErpPanelOpen(true)}
                />
              </div>
            ) : null}
          </div>
        </header>

        {showErpControls && erpPanelSource && erpPanelOpen ? (
          <ErpPostingPanel
            erp={erpPanelSource}
            canRetry={canRetryErp}
            erpBusy={erpBusy}
            onClose={() => setErpPanelOpen(false)}
            onRetry={() => void postErp()}
            t={t}
          />
        ) : null}

        <Tabs
          value={mainTab}
          onValueChange={(value) => setMainTab(value as MainTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="wms-ops-production-work-order-tabs wms-ops-detail-dialog shrink-0 px-4 pt-4 sm:px-6">
            <TabsList
              className={cn(
                'w-full',
                'wms-ops-detail-main-tabs',
                'wms-ops-detail-main-tabs--cols-3',
              )}
              data-active-index={Math.max(mainTabIndex, 0)}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
              <TabsTrigger value="info" className="wms-ops-detail-main-tab">
                Bilgi
              </TabsTrigger>
              <TabsTrigger value="content" className="wms-ops-detail-main-tab">
                İçerik
              </TabsTrigger>
              <TabsTrigger value="tasks" className="wms-ops-detail-main-tab">
                Görevler
              </TabsTrigger>
            </TabsList>
          </div>

          {loading || !detail || !execution || !header ? (
            <div className="grid min-h-0 flex-1 place-items-center px-6 py-10">
              <OpsLoadingState message="Transfer detayı yükleniyor…" code="SYNC" />
            </div>
          ) : (
            <>
            <TabsContent
              value="info"
              className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
            >
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCell label="Transfer durumu" value={header.status} />
                  <SummaryCell label="Akış durumu" value={workflowStatus} />
                  <SummaryCell label="Kaynak depo" value={`${execution.sourceWarehouseCode} · ${execution.sourceWarehouseName}`} />
                  <SummaryCell label="Hedef depo" value={`${execution.targetWarehouseCode} · ${execution.targetWarehouseName}`} />
                  <SummaryCell label="Planlanan miktar" value={formatProjectNumber(execution.requestedQuantity)} />
                  <SummaryCell label="Toplanan miktar" value={formatProjectNumber(execution.pickedQuantity)} />
                  <SummaryCell label="Teslim edilen" value={formatProjectNumber(execution.handedOverQuantity)} />
                  <SummaryCell label="Eksik" value={formatProjectNumber(execution.shortageQuantity)} />
                  <SummaryCell label="Belge tarihi" value={formatProjectDate(header.documentDate)} />
                  <SummaryCell label="Oluşturma" value={formatProjectDate(header.createdDate)} />
                  <SummaryCell
                    label="Bekleme rafı"
                    value={execution.waitingLocationCode
                      ? `${execution.waitingLocationCode} · ${execution.waitingLocationName ?? ''}`
                      : '—'}
                  />
                  <SummaryCell
                    label="Teslim onayı"
                    value={execution.handoverConfirmedAtUtc
                      ? formatProjectDateTime(execution.handoverConfirmedAtUtc)
                      : 'Bekliyor'}
                  />
                </div>
                {execution.handoverShortageReason ? (
                  <div className="wms-ops-detail-panel p-4 text-sm">
                    <strong className="text-amber-600">Eksik teslim nedeni:</strong>
                    <p className="mt-1 text-[var(--wms-app-text-muted)]">{execution.handoverShortageReason}</p>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent
              value="content"
              className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
            >
              {detail.lines.length === 0 ? (
                <div className="wms-ops-detail-empty flex flex-col items-center gap-2 p-8 text-center">
                  <PackageOpen className="size-8 opacity-40" aria-hidden />
                  <p className="text-sm text-[var(--wms-app-text-muted)]">Satır bulunamadı.</p>
                </div>
              ) : (
                <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto">
                  <table className="wms-ops-gr-detail-lines-table w-full min-w-[760px] text-sm">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Stok</th>
                        <th className="wms-ops-gr-detail-lines-table__num">Talep</th>
                        <th className="wms-ops-gr-detail-lines-table__num">Toplanan</th>
                        <th className="wms-ops-gr-detail-lines-table__num">Teslim</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((line) => {
                        const executionLine = execution.lines.find((row) => row.lineId === line.id);
                        return (
                          <tr key={line.id}>
                            <td>{line.lineNo}</td>
                            <td>
                              <StockIdentityCell stockCode={line.stockCode} stockName={line.stockName} />
                            </td>
                            <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(line.requestedQuantity)}</td>
                            <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(line.pickedQuantity)}</td>
                            <td className="wms-ops-gr-detail-lines-table__num">
                              {formatProjectNumber(executionLine?.handedOverQuantity ?? 0)}
                            </td>
                            <td>{line.status}</td>
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
              className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
            >
              <div className="space-y-3">
                {taskRows.length === 0 ? (
                  <div className="wms-ops-detail-empty p-8 text-center text-sm text-[var(--wms-app-text-muted)]">
                    Görev kaydı bulunamadı.
                  </div>
                ) : taskRows.map((task) => {
                  const hint = describeHandoffRelation(task, taskRows);
                  return (
                    <article key={task.taskId} className="wms-ops-detail-panel p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong className="font-mono text-[var(--wms-brand-primary)]">
                            {taskDisplayName(task)}
                          </strong>
                          {task.displaySuffix ? (
                            <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[0.65rem] font-bold text-cyan-600 dark:text-cyan-300">
                              {task.displaySuffix.replace(/^-/, '')}
                            </span>
                          ) : null}
                          <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{task.taskNo}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <OpsCodeBadge>{productionTaskTypeLabel(task.taskType)}</OpsCodeBadge>
                          <OpsStatusBadge tone="active">{task.status}</OpsStatusBadge>
                        </div>
                      </div>
                      {hint ? (
                        <p className="mt-2 text-xs text-[var(--wms-app-text-muted)]">{hint}</p>
                      ) : null}
                      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MiniStat label="Planlanan" value={formatProjectNumber(task.plannedQuantity)} />
                        <MiniStat label="Yapılan" value={formatProjectNumber(task.processedQuantity)} />
                        <MiniStat label="Kalan" value={formatProjectNumber(task.remainingQuantity)} />
                        <MiniStat label="Atananlar" value={formatTaskAssignees(task.assignedUsernames)} />
                      </dl>
                    </article>
                  );
                })}
              </div>
            </TabsContent>
            </>
          )}
        </Tabs>

        <footer className="wms-ops-actions wms-ops-detail-dialog__footer flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <OpsActionButton variant="secondary" onClick={onClose}>Kapat</OpsActionButton>
          <Link to={`${transferBaseUrl}/${transferId}/operations`} className="inline-flex">
            <OpsActionButton variant="primary" type="button">
              <ExternalLink className="size-4" aria-hidden />
              Operasyona git
            </OpsActionButton>
          </Link>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="wms-ops-detail-summary-cell wms-ops-detail-panel !px-3 !py-2">
      <span className="wms-ops-detail-summary-cell__label">{label}</span>
      <span className="wms-ops-detail-summary-cell__value">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--wms-app-text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
