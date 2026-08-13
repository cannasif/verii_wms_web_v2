import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  FileText,
  Loader2,
  PackageCheck,
  PackageOpen,
  Printer,
  Search,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsCodeBadge, OpsStatusBadge, inferOpsStatusTone, inferQualityStatusTone } from '@/components/shared/OpsStatusBadge';
import { useTheme } from '@/components/theme-provider';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { qualityApi, type QualityInspectionDetail } from '@/features/quality/api/quality.api';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { useUserDisplayNameDirectory } from '@/hooks/useUserDisplayNameDirectory';
import { formatProjectDate, formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import i18n from '@/lib/i18n';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import { goodsReceiptEnumLabel, goodsReceiptEnumHint } from '../localization/enum-labels';
import type {
  GoodsReceiptDetail,
  GoodsReceiptDetailLine,
  GoodsReceiptLifecycleResult,
  GoodsReceiptRoutingResult,
  GoodsReceiptSplitRoutingResult,
} from '../types/goods-receipt.types';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { canCancelGoodsReceiptFromWms } from '../utils/goods-receipt-cancel';
import {
  resolveGoodsReceiptWaybillNo,
  resolveGoodsReceiptWaybillReference,
} from '../utils/goods-receipt-waybill';
import { mergeGoodsReceiptRoutes } from '../utils/goods-receipt-routes';
import { GoodsReceiptLifecycleDialog, type GoodsReceiptLifecycleAction } from './GoodsReceiptLifecycleDialog';
import { GoodsReceiptRoutingDialog } from './GoodsReceiptRoutingDialog';

type OutputMode = 'print' | 'pdf';
type MainTab = 'info' | 'content';
type InfoSubTab = 'status' | 'erp' | 'routing' | 'additional' | 'audit';

export type GoodsReceiptDetailViewState = {
  id: number;
  loading: boolean;
  detail: GoodsReceiptDetail | null;
  startAction?: GoodsReceiptLifecycleAction | null;
};

export function GoodsReceiptDetailDialog({
  state,
  close,
  output,
  busyKey,
  onLifecycleCompleted,
  onRoutingCompleted,
}: {
  state: GoodsReceiptDetailViewState;
  close: () => void;
  output: (receiptId: number, lineId: number | undefined, mode: OutputMode, title: string) => Promise<void>;
  busyKey: string;
  onLifecycleCompleted: (result: GoodsReceiptLifecycleResult | null) => Promise<void>;
  onRoutingCompleted: (result: GoodsReceiptSplitRoutingResult) => Promise<void>;
}): ReactElement {
  const { t } = useModuleTranslation('goods-receipt-v2');
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const userNames = useUserDisplayNameDirectory();
  const [mainTab, setMainTab] = useState<MainTab>('content');
  const [infoSubTab, setInfoSubTab] = useState<InfoSubTab>('status');
  const [action, setAction] = useState<GoodsReceiptLifecycleAction | null>(null);
  const [routeKind, setRouteKind] = useState<'transfer' | 'outbound' | null>(null);
  const [sessionRoutes, setSessionRoutes] = useState<GoodsReceiptRoutingResult[]>([]);
  const [lineSearch, setLineSearch] = useState('');
  const detail = state.detail;
  const header = detail?.header;
  const waybillReference = resolveGoodsReceiptWaybillReference(header);
  const waybillLabel = t(waybillReference?.kind === 'electronic'
    ? 'createFlow.waybill.eReceiptNumber'
    : 'createFlow.waybill.receiptNumber');

  useEffect(() => {
    setSessionRoutes([]);
  }, [state.id]);

  const actorLabel = (userId?: number | null, name?: string | null) => {
    const resolved = name?.trim() || (userId != null ? userNames.get(userId) : undefined);
    if (resolved) return resolved;
    if (userId != null) return i18n.t('dataGrid.userNumber', { number: userId });
    return i18n.t('dataGrid.systemActor');
  };

  const shortCloseAvailable = detail?.lines.some(
    (line) => line.expectedQuantity - line.receivedQuantity - line.shortClosedQuantity > 0,
  );
  const projectCodes = useMemo(
    () => [...new Set((detail?.projectCodes ?? []).map((code) => code.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'tr', { sensitivity: 'base' })),
    [detail?.projectCodes],
  );
  const orderNumbers = useMemo(
    () => [...new Set((detail?.sourceDocuments ?? [])
      .map((document) => {
        const separatorIndex = document.indexOf(':');
        if (separatorIndex < 0) return '';
        const documentType = document.slice(0, separatorIndex).trim();
        if (documentType !== 'PurchaseOrder') return '';
        return document.slice(separatorIndex + 1).trim();
      })
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'tr', { sensitivity: 'base' })),
    [detail?.sourceDocuments],
  );
  const cancelled = header?.status === 'Cancelled';
  const cancelAvailable = Boolean(
    header
      && can('WMS.GOODS_RECEIPT.CANCEL')
      && canCancelGoodsReceiptFromWms({
        status: header.status,
        erpIntegrationStatus: header.erpIntegrationStatus,
      }),
  );
  const qualityReady =
    header?.qualityStatus === 'NotRequired'
    || header?.qualityStatus === 'Passed'
    || header?.qualityStatus === 'Failed';
  const approvalReady =
    header?.approvalStatus === 'NotRequired' || header?.approvalStatus === 'Approved';
  const routingAvailable = Boolean(
    detail
      && !cancelled
      && header?.status === 'Completed'
      && qualityReady
      && approvalReady
      && header?.erpIntegrationStatus === 'Succeeded'
      && detail.lines.some((line) => line.routableQuantity > 0),
  );

  useEffect(() => {
    if (!header || cancelled || !state.startAction) return;
    if (state.startAction === 'cancel' && !cancelAvailable) return;
    setAction(state.startAction);
  }, [cancelAvailable, cancelled, header, state.id, state.startAction]);

  const normalizedSearch = lineSearch.trim().toLocaleUpperCase('tr-TR');
  const visibleLines = useMemo(() => {
    if (!detail) return [] as GoodsReceiptDetailLine[];
    if (!normalizedSearch) return detail.lines;
    return detail.lines.filter((line) =>
      [line.stockCode, line.stockName, line.yapCode, line.status, String(line.lineNo)].some((value) =>
        String(value ?? '')
          .toLocaleUpperCase('tr-TR')
          .includes(normalizedSearch),
      ),
    );
  }, [detail, normalizedSearch]);

  const qualityLines = useMemo(
    () => (detail?.lines ?? []).filter((line) => line.requireQualityControl),
    [detail],
  );

  const qualityInspectionQuery = useQuery({
    queryKey: ['goods-receipt-detail-quality-inspection', header?.documentNo],
    enabled: Boolean(header?.documentNo && qualityLines.length > 0),
    staleTime: 30_000,
    queryFn: async (): Promise<QualityInspectionDetail | null> => {
      const documentNo = header?.documentNo;
      if (!documentNo) return null;
      const page = await qualityApi.inspectionsPaged({
        pageNumber: 1,
        pageSize: 10,
        search: null,
        sortBy: 'id',
        sortDirection: 'desc',
        filterLogic: 'and',
        filters: [{ column: 'sourceDocumentNo', operator: 'equals', value: documentNo }],
      });
      const match = page.items.find((item) => item.sourceDocumentNo === documentNo) ?? page.items[0];
      if (!match) return null;
      return qualityApi.inspection(match.id);
    },
  });

  const routesQuery = useQuery({
    queryKey: ['goods-receipt-detail-routes', state.id, header?.documentNo],
    enabled: Boolean(state.id && detail && !state.loading),
    staleTime: 15_000,
    queryFn: () => goodsReceiptV2Api.listRoutes(state.id),
  });

  const routingRoutes = useMemo(
    () => mergeGoodsReceiptRoutes(detail?.routes, routesQuery.data, sessionRoutes),
    [detail?.routes, routesQuery.data, sessionRoutes],
  );
  const transferRoutes = useMemo(
    () => routingRoutes.filter((route) => route.routeType === 'WarehouseTransfer'),
    [routingRoutes],
  );
  const outboundRoutes = useMemo(
    () => routingRoutes.filter((route) => route.routeType === 'WarehouseOutbound'),
    [routingRoutes],
  );
  const routedTotal = useMemo(
    () => (detail?.lines ?? []).reduce((sum, line) => sum + (line.routedQuantity || 0), 0),
    [detail?.lines],
  );
  const routableRemaining = useMemo(
    () => (detail?.lines ?? []).reduce((sum, line) => sum + (line.routableQuantity || 0), 0),
    [detail?.lines],
  );

  const printBusy = Boolean(header && busyKey === `${header.id}:all:print`);
  const pdfBusy = Boolean(header && busyKey === `${header.id}:all:pdf`);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
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
              {t('list.eyebrowModule')}
            </p>
            <DialogTitle className="wms-ops-detail-dialog__title">
              {waybillLabel}
              {header ? (
                <span className="ml-2 font-mono text-base font-bold text-cyan-600 dark:text-cyan-300">
                  {waybillReference?.number || t('list.noWaybillShort')}
                </span>
              ) : (
                <span className="wms-ops-detail-dialog__id"> #{state.id}</span>
              )}
            </DialogTitle>
            <DialogDescription className="wms-ops-detail-dialog__description">
              {header
                ? [
                    header.supplierName && header.supplierCode
                      ? `${header.supplierName} (${header.supplierCode})`
                      : header.supplierName || header.supplierCode || '—',
                    header.warehouseName
                      ? `${header.warehouseName} (${header.warehouseCode})`
                      : String(header.warehouseCode),
                    goodsReceiptEnumLabel(t, 'operationStatus', header.status),
                  ].join(' · ')
                : t('list.detailDescription')}
            </DialogDescription>
            {header ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <OpsStatusBadge tone={inferOpsStatusTone(header.status)}>
                  {goodsReceiptEnumLabel(t, 'operationStatus', header.status)}
                </OpsStatusBadge>
                <OpsStatusBadge
                  tone={inferQualityStatusTone(header.qualityStatus)}
                  title={goodsReceiptEnumHint(t, 'qualityStatus', header.qualityStatus)}
                >
                  {goodsReceiptEnumLabel(t, 'qualityStatus', header.qualityStatus)}
                </OpsStatusBadge>
                <OpsCodeBadge>
                  {goodsReceiptEnumLabel(t, 'receiptType', header.receiptType)}
                </OpsCodeBadge>
              </div>
            ) : null}
          </div>
        </header>

        {state.loading || !detail || !header ? (
          <div className="wms-ops-detail-state grid min-h-0 flex-1 place-items-center px-6 py-10">
            <OpsLoadingState message={t('list.detailLoadingShort')} code="SYNC" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="wms-ops-detail-lifecycle shrink-0 px-4 py-3 sm:px-6">
              {!cancelled ? (
                <div className="wms-ops-detail-lifecycle__bar">
                  {header.approvalStatus === 'Pending' ? (
                    <LifecycleButton
                      label={t('list.approve')}
                      icon={<CheckCircle2 className="size-4" />}
                      onClick={() => setAction('approve')}
                    />
                  ) : null}
                  {shortCloseAvailable ? (
                    <LifecycleButton
                      label={t('list.shortClose')}
                      icon={<PackageCheck className="size-4" />}
                      onClick={() => setAction('shortClose')}
                    />
                  ) : null}
                  {detail.putawayCandidates.length > 0 ? (
                    <LifecycleButton
                      label={t('list.putaway', { count: detail.putawayCandidates.length })}
                      icon={<Warehouse className="size-4" />}
                      onClick={() => setAction('putaway')}
                    />
                  ) : null}
                  {routingAvailable ? (
                    <LifecycleButton
                      label={t('list.route')}
                      icon={<ArrowRightLeft className="size-4" />}
                      onClick={() => setRouteKind('transfer')}
                    />
                  ) : null}
                  <LifecycleButton
                    label={t('list.printLabels')}
                    icon={printBusy ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                    onClick={() => void output(header.id, undefined, 'print', resolveGoodsReceiptWaybillNo(header) || `receipt-${header.id}`)}
                    disabled={printBusy}
                  />
                  <LifecycleButton
                    label={t('list.showPdf')}
                    icon={pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    onClick={() => void output(header.id, undefined, 'pdf', resolveGoodsReceiptWaybillNo(header) || `receipt-${header.id}`)}
                    disabled={pdfBusy}
                  />
                  {cancelAvailable ? (
                    <LifecycleButton
                      label={t('list.cancel')}
                      danger
                      icon={<Ban className="size-4" />}
                      onClick={() => setAction('cancel')}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="wms-ops-detail-lifecycle__cancelled">
                  {goodsReceiptEnumLabel(t, 'operationStatus', header.status)}
                </div>
              )}
            </div>

            <Tabs
              value={mainTab}
              onValueChange={(value) => setMainTab(value as MainTab)}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="shrink-0 px-4 pt-4 sm:px-6">
                <TabsList className={cn('w-full', 'wms-ops-detail-main-tabs', `wms-ops-detail-main-tabs--${mainTab}`)}>
                  <span className="wms-ops-detail-tab-indicator" aria-hidden />
                  <TabsTrigger value="info" className="wms-ops-detail-main-tab">
                    {t('list.detailInfo')}
                  </TabsTrigger>
                  <TabsTrigger value="content" className="wms-ops-detail-main-tab">
                    {t('list.detailContent')}
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
                      <OpsDetailField label={waybillLabel}>{waybillReference?.number || '—'}</OpsDetailField>
                      <OpsDetailField label={t('list.supplier')}>
                        {header.supplierName && header.supplierCode
                          ? `${header.supplierName} (${header.supplierCode})`
                          : header.supplierName || header.supplierCode || '—'}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.branch')}>{header.branchCode || '—'}</OpsDetailField>
                      <OpsDetailField label={t('list.warehouse')}>
                        {header.warehouseName
                          ? `${header.warehouseCode} ${header.warehouseName}`
                          : String(header.warehouseCode)}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.processType')}>
                        {goodsReceiptEnumLabel(t, 'processType', header.processType)}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.receiptType')}>
                        <OpsCodeBadge>
                          {goodsReceiptEnumLabel(t, 'receiptType', header.receiptType)}
                        </OpsCodeBadge>
                      </OpsDetailField>
                      <OpsDetailField label={t('list.initiationMode')}>
                        {goodsReceiptEnumLabel(t, 'initiationMode', header.initiationMode)}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.documentDate')}>
                        {formatProjectDate(header.documentDate)}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.plannedArrival')}>
                        {header.plannedArrivalAtUtc ? formatProjectDateTime(header.plannedArrivalAtUtc) : '—'}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.orderNo')}>
                        {orderNumbers.length === 0 ? '—' : orderNumbers.join(', ')}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.projectCode')}>
                        {formatGoodsReceiptDetailCodeList(projectCodes, t, 'list.multipleProjectsCount')}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.waybillDate')}>
                        {header.waybillDate ? formatProjectDate(header.waybillDate) : '—'}
                      </OpsDetailField>
                    </div>
                  </div>

                  <Tabs
                    value={infoSubTab}
                    onValueChange={(value) => setInfoSubTab(value as InfoSubTab)}
                    className="w-full"
                  >
                    <TabsList
                      className={cn('w-full', 'wms-ops-detail-subtabs', `wms-ops-detail-subtabs--${infoSubTab}`)}
                    >
                      <span className="wms-ops-detail-tab-indicator" aria-hidden />
                      <TabsTrigger value="status" className="wms-ops-detail-subtab">
                        {t('list.statusInfo')}
                      </TabsTrigger>
                      <TabsTrigger value="erp" className="wms-ops-detail-subtab">
                        {t('list.erpInfo')}
                      </TabsTrigger>
                      <TabsTrigger value="routing" className="wms-ops-detail-subtab">
                        {t('list.routingInfo')}
                      </TabsTrigger>
                      <TabsTrigger value="additional" className="wms-ops-detail-subtab">
                        {t('list.additionalInfo')}
                      </TabsTrigger>
                      <TabsTrigger value="audit" className="wms-ops-detail-subtab">
                        {t('list.auditInfo')}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="status" className="mt-4">
                      <div className="wms-ops-detail-panel wms-ops-detail-panel--rows">
                        <OpsDetailRow label={t('list.status')}>
                          <OpsStatusBadge tone={inferOpsStatusTone(header.status)}>
                            {goodsReceiptEnumLabel(t, 'operationStatus', header.status)}
                          </OpsStatusBadge>
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.approval')}>
                          <StatusToneBadge
                            label={goodsReceiptEnumLabel(t, 'approvalStatus', header.approvalStatus)}
                            positive={header.approvalStatus === 'Approved' || header.approvalStatus === 'NotRequired'}
                            warn={header.approvalStatus === 'Pending'}
                            danger={header.approvalStatus === 'Rejected'}
                          />
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.quality')}>
                          <OpsStatusBadge
                            tone={inferQualityStatusTone(header.qualityStatus)}
                            title={goodsReceiptEnumHint(t, 'qualityStatus', header.qualityStatus)}
                          >
                            {goodsReceiptEnumLabel(t, 'qualityStatus', header.qualityStatus)}
                          </OpsStatusBadge>
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.putawayStatus')}>
                          <div className="flex flex-col gap-1">
                            <StatusToneBadge
                              label={goodsReceiptEnumLabel(t, 'putawayStatus', header.putawayStatus)}
                              positive={header.putawayStatus === 'Completed' || header.putawayStatus === 'NotRequired'}
                              warn={
                                header.putawayStatus === 'Pending'
                                || header.putawayStatus === 'InProgress'
                                || header.putawayStatus === 'PartiallyCompleted'
                              }
                            />
                            {header.putawayStatus !== 'NotRequired' ? (
                              <span className="text-xs text-[var(--wms-app-text-muted)]">
                                {t('list.putawayProgress', {
                                  putaway: formatProjectNumber(
                                    detail.lines.reduce((sum, line) => sum + line.putawayQuantity, 0),
                                  ),
                                  accepted: formatProjectNumber(
                                    detail.lines.reduce((sum, line) => sum + line.acceptedQuantity, 0),
                                  ),
                                })}
                                {detail.putawayCandidates.length > 0
                                  ? ` · ${t('list.putawayCandidatesHint', { count: detail.putawayCandidates.length })}`
                                  : ''}
                              </span>
                            ) : null}
                            {header.erpIntegrationStatus === 'Succeeded'
                              && header.putawayStatus !== 'Completed'
                              && header.putawayStatus !== 'NotRequired' ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {t('list.putawayIndependentOfErp')}
                              </span>
                            ) : null}
                          </div>
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.completed')}>
                          <OpsFlagBadge
                            value={header.status === 'Completed'}
                            yes={t('list.yes')}
                            no={t('list.no')}
                          />
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.approvalPending')}>
                          <OpsFlagBadge
                            value={header.approvalStatus === 'Pending'}
                            tone="warn"
                            yes={t('list.yes')}
                            no={t('list.no')}
                          />
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.receivedAt')}>
                          {header.receivedAtUtc ? formatProjectDateTime(header.receivedAtUtc) : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.physicalReceipt')}>{String(detail.executionCount)}</OpsDetailRow>
                        <OpsDetailRow label={t('list.expected')}>
                          {formatProjectNumber(header.expectedQuantity)}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.received')}>
                          {formatProjectNumber(header.receivedQuantity)}
                        </OpsDetailRow>
                      </div>
                    </TabsContent>

                    <TabsContent value="erp" className="mt-4">
                      <div className="wms-ops-detail-panel wms-ops-detail-panel--rows">
                        <OpsDetailRow label={t('list.erpPosting')}>
                          {goodsReceiptEnumLabel(t, 'erpStatus', header.erpIntegrationStatus)}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.erpIntegrated')}>
                          <OpsFlagBadge
                            value={
                              header.erpIntegrationStatus === 'Succeeded' ||
                              header.erpIntegrationStatus === 'NotRequired'
                            }
                            yes={t('list.yes')}
                            no={t('list.no')}
                          />
                        </OpsDetailRow>
                      </div>
                    </TabsContent>

                    <TabsContent value="routing" className="mt-4">
                      <div className="wms-ops-detail-panel wms-ops-detail-panel--rows">
                        <OpsDetailRow label={t('list.routedTotal')}>
                          {formatProjectNumber(routedTotal)}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.routableRemaining')}>
                          {formatProjectNumber(routableRemaining)}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.routeTransferDocs')}>
                          {transferRoutes.length > 0
                            ? transferRoutes
                                .map((route) =>
                                  `${route.targetDocumentNo} (${formatProjectNumber(route.routedQuantity)})`,
                                )
                                .join(', ')
                            : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.routeOutboundDocs')}>
                          {outboundRoutes.length > 0
                            ? outboundRoutes
                                .map((route) =>
                                  `${route.targetDocumentNo} (${formatProjectNumber(route.routedQuantity)})`,
                                )
                                .join(', ')
                            : '—'}
                        </OpsDetailRow>
                      </div>

                      {routesQuery.isFetching && routingRoutes.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-400">{t('list.routingLoading')}</p>
                      ) : null}

                      {routingRoutes.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {routingRoutes.map((route) => (
                            <li
                              key={`${route.routeType}-${route.targetDocumentId}-${route.routingBatchId}-${route.targetDocumentNo}`}
                              className="rounded-lg border border-[var(--wms-app-border)] bg-black/10 px-3 py-2 dark:bg-white/5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-xs text-slate-400">
                                    {route.routeType === 'WarehouseTransfer'
                                      ? t('list.routeTypeTransfer')
                                      : t('list.routeTypeOutbound')}
                                  </span>
                                  <div className="font-mono text-sm font-medium">
                                    {route.targetDocumentNo}
                                  </div>
                                </div>
                                <span className="font-mono text-sm">
                                  {formatProjectNumber(route.routedQuantity)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : routedTotal <= 0 && !routesQuery.isFetching ? (
                        <p className="mt-3 text-xs text-slate-400">{t('list.routingEmpty')}</p>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="additional" className="mt-4">
                      <div className="wms-ops-detail-panel wms-ops-detail-panel--rows">
                        <OpsDetailRow label={t('list.task')}>
                          {detail.taskNumbers.join(', ') || '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.sourceDocuments')}>
                          {detail.sourceDocuments.length ? detail.sourceDocuments.join(', ') : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.line')}>{String(header.lineCount)}</OpsDetailRow>
                        <OpsDetailRow label={t('list.qcRequired')}>
                          <OpsFlagBadge
                            value={detail.lines.some((line) => line.requireQualityControl)}
                            tone="warn"
                            yes={t('list.yes')}
                            no={t('list.no')}
                          />
                        </OpsDetailRow>
                      </div>
                      {detail.lines.some((line) => line.requireQualityControl) ? (
                        <div className="mt-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                          <strong>{t('list.qcBannerTitle')}</strong>{' '}
                          {t('list.qcBannerBody', {
                            count: detail.lines.filter((line) => line.requireQualityControl).length,
                          })}
                        </div>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="audit" className="mt-4">
                      <div className="wms-ops-detail-panel wms-ops-detail-panel--rows">
                        <OpsDetailRow label={t('list.createdBy')}>
                          {header.createdBy != null || header.createdByName
                            ? actorLabel(header.createdBy, header.createdByName)
                            : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.createdDate')}>
                          {header.createdDate ? formatProjectDateTime(header.createdDate) : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.updatedBy')}>
                          {header.updatedDate
                            ? actorLabel(header.updatedBy, header.updatedByName)
                            : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.updatedDate')}>
                          {header.updatedDate ? formatProjectDateTime(header.updatedDate) : '—'}
                        </OpsDetailRow>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              <TabsContent
                value="content"
                className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
              >
                <section className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="wms-ops-detail-section-title !border-0 !p-0">{t('list.receiptLines')}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('list.linesShown', { visible: visibleLines.length, total: detail.lines.length })}
                      </p>
                    </div>
                    <label className="relative block w-full sm:max-w-sm">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={lineSearch}
                        onChange={(event) => setLineSearch(event.target.value)}
                        className="input wms-ops-detail-search min-h-11 !pl-10"
                        placeholder={t('list.lineSearchPlaceholder')}
                        aria-label={t('list.lineSearchAria')}
                      />
                    </label>
                  </div>

                  {!visibleLines.length ? (
                    <div className="wms-ops-detail-empty flex flex-col items-center gap-2 border border-dashed border-[var(--wms-app-border)] p-8 text-center">
                      <PackageOpen className="size-8 opacity-40" aria-hidden />
                      <p className="text-sm text-slate-500">{t('list.noMatchingLines')}</p>
                    </div>
                  ) : (
                    <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto">
                      <table className="wms-ops-gr-detail-lines-table min-w-[1080px] w-full text-sm">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{t('list.stock')}</th>
                            <th>{t('list.yap')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('list.expected')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('list.accepted')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('list.quarantine')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('list.rejected')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('list.routed')}</th>
                            <th className="wms-ops-gr-detail-lines-table__num">{t('list.remaining')}</th>
                            <th>{t('list.status')}</th>
                            <th>{t('list.quality')}</th>
                            <th className="wms-ops-gr-detail-lines-table__actions">{t('list.label')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleLines.map((line) => (
                            <tr key={line.id}>
                              <td>{line.lineNo}</td>
                              <td>
                                <StockIdentityCell
                                  stockId={line.stockId}
                                  stockCode={line.stockCode}
                                  stockName={line.stockName}
                                  branchCode={header?.branchCode}
                                  nameClassName="wms-ops-gr-detail-lines-table__muted"
                                />
                              </td>
                              <td>{line.yapCode || '—'}</td>
                              <td className="wms-ops-gr-detail-lines-table__num">
                                {formatProjectNumber(line.expectedQuantity)}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__num">
                                {formatProjectNumber(line.acceptedQuantity)}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__num">
                                {formatProjectNumber(line.quarantineQuantity)}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__num">
                                {formatProjectNumber(line.rejectedQuantity)}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__num">
                                {formatProjectNumber(line.routedQuantity)}
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__num wms-ops-gr-detail-lines-table__accent">
                                {formatProjectNumber(line.routableQuantity)}
                              </td>
                              <td>
                                <OpsStatusBadge tone={inferOpsStatusTone(line.status)}>
                                  {goodsReceiptEnumLabel(t, 'lineStatus', line.status)}
                                </OpsStatusBadge>
                              </td>
                              <td>
                                <LineQualityCell line={line} t={t} />
                              </td>
                              <td className="wms-ops-gr-detail-lines-table__actions">
                                <div className="flex justify-center gap-1">
                                  <ActionButton
                                    title={t('list.printLineLabel')}
                                    busy={busyKey === `${header.id}:${line.id}:print`}
                                    onClick={() =>
                                      void output(
                                        header.id,
                                        line.id,
                                        'print',
                                        `${waybillReference?.number || `receipt-${header.id}`}-${line.lineNo}`,
                                      )
                                    }
                                    icon={<Printer className="size-3.5" />}
                                  />
                                  <ActionButton
                                    title={t('list.showLineLabelPdf')}
                                    busy={busyKey === `${header.id}:${line.id}:pdf`}
                                    onClick={() =>
                                      void output(
                                        header.id,
                                        line.id,
                                        'pdf',
                                        `${waybillReference?.number || `receipt-${header.id}`}-${line.lineNo}`,
                                      )
                                    }
                                    icon={<FileText className="size-3.5" />}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {qualityLines.length > 0 ? (
                    <QualitySummaryPanel
                      headerStatus={header.qualityStatus}
                      lines={qualityLines}
                      inspection={qualityInspectionQuery.data ?? null}
                      inspectionLoading={qualityInspectionQuery.isFetching}
                      userNames={userNames}
                      t={t}
                    />
                  ) : null}
                </section>
              </TabsContent>
            </Tabs>

            {action ? (
              <GoodsReceiptLifecycleDialog
                action={action}
                detail={detail}
                onClose={() => setAction(null)}
                onCompleted={async (result) => {
                  setAction(null);
                  await onLifecycleCompleted(result);
                }}
              />
            ) : null}
            {routeKind ? (
              <GoodsReceiptRoutingDialog
                detail={detail}
                initialKind={routeKind}
                onClose={() => setRouteKind(null)}
                onCompleted={async (result) => {
                  setSessionRoutes((prev) => mergeGoodsReceiptRoutes(prev, result.routes));
                  setRouteKind(null);
                  await onRoutingCompleted(result);
                  await queryClient.invalidateQueries({
                    queryKey: ['goods-receipt-detail-routes', state.id],
                  });
                }}
              />
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatGoodsReceiptDetailCodeList(
  values: string[],
  t: (key: string, options?: Record<string, unknown>) => string,
  multipleCountKey: string,
): ReactNode {
  if (values.length === 0) return '—';
  if (values.length === 1) return values[0];
  return (
    <span title={values.join(', ')}>
      {t(multipleCountKey, { count: values.length })}
      {' · '}
      {values.join(', ')}
    </span>
  );
}

function OpsDetailField({
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

function OpsDetailRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="wms-ops-detail-row">
      <span className="wms-ops-detail-row__label">{label}</span>
      <span className="wms-ops-detail-row__value">{children}</span>
    </div>
  );
}

function OpsFlagBadge({
  value,
  tone = 'default',
  yes,
  no,
}: {
  value: boolean;
  tone?: 'default' | 'warn';
  yes: string;
  no: string;
}): ReactElement {
  return (
    <span
      className={cn(
        'wms-ops-flag-badge',
        value
          ? tone === 'warn'
            ? 'wms-ops-flag-badge--warn'
            : 'wms-ops-flag-badge--on'
          : 'wms-ops-flag-badge--off',
      )}
    >
      {value ? yes : no}
    </span>
  );
}

function StatusToneBadge({
  label,
  positive,
  warn,
  danger,
}: {
  label: string;
  positive?: boolean;
  warn?: boolean;
  danger?: boolean;
}): ReactElement {
  return (
    <span
      className={cn(
        'wms-ops-flag-badge',
        positive && 'wms-ops-flag-badge--on',
        warn && 'wms-ops-flag-badge--warn',
        danger && 'wms-ops-flag-badge--danger',
        !positive && !warn && !danger && 'wms-ops-flag-badge--off',
      )}
    >
      {label}
    </span>
  );
}

function LifecycleButton({
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

function pct(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function lineQualityMetrics(line: GoodsReceiptDetailLine) {
  const base =
    line.receivedQuantity > 0 ? line.receivedQuantity : line.expectedQuantity;
  const baseKind = line.receivedQuantity > 0 ? 'received' as const : 'expected' as const;
  const accepted = line.acceptedQuantity;
  const rejected = line.rejectedQuantity;
  const quarantine = line.quarantineQuantity;
  const pendingDecision = Math.max(
    0,
    line.receivedQuantity - accepted - rejected - quarantine,
  );
  const awaitingReceipt = line.requireQualityControl && line.receivedQuantity <= 0;
  return {
    base,
    baseKind,
    accepted,
    rejected,
    quarantine,
    pendingDecision,
    awaitingReceipt,
    pctAccepted: pct(accepted, base),
    pctRejected: pct(rejected, base),
    pctQuarantine: pct(quarantine, base),
    pctPending: pct(pendingDecision, base),
  };
}

function resolveQcActorName(
  userId: number | null | undefined,
  userNames: Map<number, string>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | undefined {
  if (userId == null) return undefined;
  return userNames.get(userId)?.trim() || t('list.qcApproverUnknown', { id: userId });
}

function QualitySummaryPanel({
  headerStatus,
  lines,
  inspection,
  inspectionLoading,
  userNames,
  t,
}: {
  headerStatus: string;
  lines: GoodsReceiptDetailLine[];
  inspection: QualityInspectionDetail | null;
  inspectionLoading: boolean;
  userNames: Map<number, string>;
  t: (key: string, options?: Record<string, unknown>) => string;
}): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const inspectionLines = inspection?.lines ?? [];

  const approverNames = Array.from(
    new Set(
      inspectionLines
        .map((qcLine) => resolveQcActorName(qcLine.decisionBy, userNames, t))
        .filter((name): name is string => Boolean(name)),
    ),
  );
  const openedBy =
    inspection?.header.createdByName?.trim() ||
    resolveQcActorName(inspection?.header.createdBy, userNames, t);
  const hasAnyDecision = inspectionLines.some((qcLine) => qcLine.decisionBy != null);
  const approverValue =
    approverNames.length > 0
      ? approverNames.join(', ')
      : hasAnyDecision
        ? '—'
        : t('list.qcApproverPending');

  return (
    <section
      className={cn(
        'wms-ops-qc-summary',
        isPremium ? 'wms-ops-qc-summary--premium' : 'wms-ops-qc-summary--terminal',
      )}
      aria-label={t('list.qcSummaryTitle')}
    >
      <header className="wms-ops-qc-summary__header">
        <div className="wms-ops-qc-summary__title-row">
          {!isPremium ? (
            <span className="wms-ops-qc-summary__prompt" aria-hidden>
              {'>'}
            </span>
          ) : (
            <span className="wms-ops-qc-summary__icon" aria-hidden>
              <ShieldCheck className="size-3.5" />
            </span>
          )}
          <strong className="wms-ops-qc-summary__title">{t('list.qcSummaryTitle')}</strong>
          <OpsStatusBadge
            tone={inferQualityStatusTone(headerStatus)}
            title={goodsReceiptEnumHint(t as never, 'qualityStatus', headerStatus)}
          >
            {goodsReceiptEnumLabel(t as never, 'qualityStatus', headerStatus)}
          </OpsStatusBadge>
          <span className="wms-ops-qc-summary__count">
            {t('list.qcLinesSuffix', { count: lines.length })}
          </span>
        </div>

        <dl className="wms-ops-qc-summary__meta">
          {inspectionLoading && !inspection ? (
            <div className="wms-ops-qc-summary__meta-item wms-ops-qc-summary__meta-item--muted">
              <dt>{t('list.qcApprover')}</dt>
              <dd>{t('list.qcApproverLoading')}</dd>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'wms-ops-qc-summary__meta-item',
                  approverNames.length === 0 && 'wms-ops-qc-summary__meta-item--pending',
                )}
              >
                <dt>{t('list.qcApprover')}</dt>
                <dd>{approverValue}</dd>
              </div>
              {openedBy ? (
                <div className="wms-ops-qc-summary__meta-item">
                  <dt>{t('list.qcOpenedBy')}</dt>
                  <dd>{openedBy}</dd>
                </div>
              ) : null}
            </>
          )}
        </dl>
      </header>

      <ul className="wms-ops-qc-summary__lines">
        {lines.map((line) => {
          const m = lineQualityMetrics(line);
          const metrics = [
            {
              key: 'accepted',
              label: t('list.qcAcceptedShare'),
              qty: m.accepted,
              pct: m.pctAccepted,
              tone: 'accepted' as const,
            },
            {
              key: 'quarantine',
              label: t('list.qcQuarantineShare'),
              qty: m.quarantine,
              pct: m.pctQuarantine,
              tone: 'quarantine' as const,
            },
            {
              key: 'rejected',
              label: t('list.qcRejectedShare'),
              qty: m.rejected,
              pct: m.pctRejected,
              tone: 'rejected' as const,
            },
            ...(m.pendingDecision > 0
              ? [
                  {
                    key: 'pending',
                    label: t('list.qcPendingDecision'),
                    qty: m.pendingDecision,
                    pct: m.pctPending,
                    tone: 'pending' as const,
                  },
                ]
              : []),
          ];

          return (
            <li key={line.id} className="wms-ops-qc-summary__line">
              <div className="wms-ops-qc-summary__line-head">
                <div className="wms-ops-qc-summary__stock">
                  <span className="wms-ops-qc-summary__stock-code">{line.stockCode}</span>
                  <span className="wms-ops-qc-summary__stock-name">{line.stockName || '—'}</span>
                </div>
                <div className="wms-ops-qc-summary__line-meta">
                  <span className="wms-ops-qc-summary__qty">
                    {formatProjectNumber(m.base)} {line.unitCode || ''}
                  </span>
                  <span className="wms-ops-qc-summary__qty-kind">
                    {m.baseKind === 'received' ? t('list.qcOfReceived') : t('list.qcOfExpected')}
                  </span>
                </div>
              </div>

              {m.awaitingReceipt ? (
                <p className="wms-ops-qc-summary__awaiting">{t('list.qcAwaitingReceipt')}</p>
              ) : (
                <div className="wms-ops-qc-summary__body">
                  <div
                    className="wms-ops-qc-summary__bar"
                    role="img"
                    aria-label={`${t('list.qcAcceptedShare')} ${m.pctAccepted}%, ${t('list.qcQuarantineShare')} ${m.pctQuarantine}%, ${t('list.qcRejectedShare')} ${m.pctRejected}%`}
                  >
                    {m.pctAccepted > 0 ? (
                      <span
                        className="wms-ops-qc-summary__bar-seg wms-ops-qc-summary__bar-seg--accepted"
                        style={{ width: `${m.pctAccepted}%` }}
                      />
                    ) : null}
                    {m.pctQuarantine > 0 ? (
                      <span
                        className="wms-ops-qc-summary__bar-seg wms-ops-qc-summary__bar-seg--quarantine"
                        style={{ width: `${m.pctQuarantine}%` }}
                      />
                    ) : null}
                    {m.pctRejected > 0 ? (
                      <span
                        className="wms-ops-qc-summary__bar-seg wms-ops-qc-summary__bar-seg--rejected"
                        style={{ width: `${m.pctRejected}%` }}
                      />
                    ) : null}
                    {m.pctPending > 0 ? (
                      <span
                        className="wms-ops-qc-summary__bar-seg wms-ops-qc-summary__bar-seg--pending"
                        style={{ width: `${m.pctPending}%` }}
                      />
                    ) : null}
                  </div>

                  <div className="wms-ops-qc-summary__metrics">
                    {metrics.map((metric) => (
                      <div
                        key={metric.key}
                        className={cn(
                          'wms-ops-qc-summary__metric',
                          `wms-ops-qc-summary__metric--${metric.tone}`,
                          metric.qty > 0 && 'wms-ops-qc-summary__metric--active',
                        )}
                      >
                        <span className="wms-ops-qc-summary__metric-label">{metric.label}</span>
                        <span className="wms-ops-qc-summary__metric-value">
                          {formatProjectNumber(metric.qty)}
                        </span>
                        <span className="wms-ops-qc-summary__metric-pct">{metric.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LineQualityCell({
  line,
  t,
}: {
  line: GoodsReceiptDetailLine;
  t: (key: string, options?: Record<string, unknown>) => string;
}): ReactElement {
  if (!line.requireQualityControl) {
    return <span className="text-xs text-slate-500">{t('list.qcNone')}</span>;
  }
  const m = lineQualityMetrics(line);
  if (m.awaitingReceipt) {
    return (
      <div className="space-y-1">
        <OpsStatusBadge tone="pending" title={t('list.qcAwaitingReceipt')}>
          {t('list.qcLineRequired')}
        </OpsStatusBadge>
        <div className="text-[0.65rem] text-amber-300/90">{t('list.qcAwaitingReceipt')}</div>
      </div>
    );
  }
  const inControlPct = Math.min(100, Math.round((m.pctQuarantine + m.pctPending) * 10) / 10);
  return (
    <div className="space-y-1">
      <OpsStatusBadge
        tone={inControlPct > 0 ? 'quality' : m.pctRejected > 0 ? 'danger' : 'done'}
        title={`${t('list.qcQuarantineShare')} ${m.pctQuarantine}% · ${t('list.qcAcceptedShare')} ${m.pctAccepted}% · ${t('list.qcRejectedShare')} ${m.pctRejected}%`}
      >
        {inControlPct > 0
          ? `${t('list.qcInControl')} ${inControlPct}%`
          : m.pctRejected > 0
            ? `${t('list.qcRejectedShare')} ${m.pctRejected}%`
            : `${t('list.qcAcceptedShare')} ${m.pctAccepted}%`}
      </OpsStatusBadge>
      <div className="font-mono text-[0.65rem] text-slate-400">
        A {formatProjectNumber(m.accepted)} · Q {formatProjectNumber(m.quarantine)} · R{' '}
        {formatProjectNumber(m.rejected)}
      </div>
    </div>
  );
}

function ActionButton({
  title,
  busy,
  onClick,
  icon,
}: {
  title: string;
  busy: boolean;
  onClick: () => void;
  icon: ReactElement;
}): ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={busy}
      onClick={onClick}
      className="wms-ops-grid-icon-btn disabled:opacity-40"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
    </button>
  );
}
