import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
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
  Warehouse,
} from 'lucide-react';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsCodeBadge, OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { formatProjectDate, formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { goodsReceiptEnumLabel } from '../localization/enum-labels';
import type {
  GoodsReceiptDetail,
  GoodsReceiptDetailLine,
  GoodsReceiptLifecycleResult,
  GoodsReceiptSplitRoutingResult,
} from '../types/goods-receipt.types';
import { GoodsReceiptLifecycleDialog, type GoodsReceiptLifecycleAction } from './GoodsReceiptLifecycleDialog';
import { GoodsReceiptRoutingDialog } from './GoodsReceiptRoutingDialog';

type OutputMode = 'print' | 'pdf';
type MainTab = 'info' | 'content';
type InfoSubTab = 'status' | 'erp' | 'additional' | 'audit';

export type GoodsReceiptDetailViewState = {
  id: number;
  loading: boolean;
  detail: GoodsReceiptDetail | null;
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
  const [mainTab, setMainTab] = useState<MainTab>('info');
  const [infoSubTab, setInfoSubTab] = useState<InfoSubTab>('status');
  const [action, setAction] = useState<GoodsReceiptLifecycleAction | null>(null);
  const [routeKind, setRouteKind] = useState<'transfer' | 'outbound' | null>(null);
  const [lineSearch, setLineSearch] = useState('');
  const detail = state.detail;
  const header = detail?.header;

  const shortCloseAvailable = detail?.lines.some(
    (line) => line.expectedQuantity - line.receivedQuantity - line.shortClosedQuantity > 0,
  );
  const cancelled = header?.status === 'Cancelled';
  const routingAvailable = Boolean(
    detail && !cancelled && detail.lines.some((line) => line.routableQuantity > 0),
  );

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
            <DialogTitle className="wms-ops-detail-dialog__title">
              {t('list.detailTitle')}
              <span className="wms-ops-detail-dialog__id"> #{state.id}</span>
            </DialogTitle>
            <DialogDescription className="wms-ops-detail-dialog__description">
              {t('list.detailDescription')}
            </DialogDescription>
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
                    onClick={() => void output(header.id, undefined, 'print', header.documentNo)}
                    disabled={printBusy}
                  />
                  <LifecycleButton
                    label={t('list.showPdf')}
                    icon={pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    onClick={() => void output(header.id, undefined, 'pdf', header.documentNo)}
                    disabled={pdfBusy}
                  />
                  <LifecycleButton
                    label={t('list.cancel')}
                    danger
                    icon={<Ban className="size-4" />}
                    onClick={() => setAction('cancel')}
                  />
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
                      <OpsDetailField label={t('list.documentNo')}>{header.documentNo}</OpsDetailField>
                      <OpsDetailField label={t('list.waybill')}>{header.waybillNo || '—'}</OpsDetailField>
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
                        <OpsCodeBadge>{header.receiptType || '—'}</OpsCodeBadge>
                      </OpsDetailField>
                      <OpsDetailField label={t('list.initiationMode')}>
                        {goodsReceiptEnumLabel(t, 'initiationMode', header.initiationMode)}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.priority')}>{String(header.priority)}</OpsDetailField>
                      <OpsDetailField label={t('list.documentDate')}>
                        {formatProjectDate(header.documentDate)}
                      </OpsDetailField>
                      <OpsDetailField label={t('list.plannedArrival')}>
                        {header.plannedArrivalAtUtc ? formatProjectDateTime(header.plannedArrivalAtUtc) : '—'}
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
                          <OpsStatusBadge tone={inferOpsStatusTone(header.qualityStatus)}>
                            {goodsReceiptEnumLabel(t, 'qualityStatus', header.qualityStatus)}
                          </OpsStatusBadge>
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.putawayStatus')}>
                          {goodsReceiptEnumLabel(t, 'putawayStatus', header.putawayStatus)}
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
                          {header.createdBy != null ? String(header.createdBy) : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.createdDate')}>
                          {header.createdDate ? formatProjectDateTime(header.createdDate) : '—'}
                        </OpsDetailRow>
                        <OpsDetailRow label={t('list.updatedBy')}>
                          {header.updatedBy != null ? String(header.updatedBy) : '—'}
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
                    <>
                      <div className="hidden overflow-x-auto border border-[var(--wms-app-border)] md:block">
                        <table className="min-w-[900px] w-full text-sm">
                          <thead className="bg-[var(--wms-app-panel-muted)] text-left">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">{t('list.stock')}</th>
                              <th className="p-3">{t('list.yap')}</th>
                              <th className="p-3 text-right">{t('list.expected')}</th>
                              <th className="p-3 text-right">{t('list.accepted')}</th>
                              <th className="p-3 text-right">{t('list.routed')}</th>
                              <th className="p-3 text-right">{t('list.remaining')}</th>
                              <th className="p-3">{t('list.status')}</th>
                              <th className="p-3">{t('list.quality')}</th>
                              <th className="p-3 text-center">{t('list.label')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleLines.map((line) => (
                              <tr key={line.id} className="border-t border-[var(--wms-app-border)]">
                                <td className="p-3">{line.lineNo}</td>
                                <td className="p-3">
                                  <strong>{line.stockCode}</strong>
                                  <div className="text-xs text-slate-500">{line.stockName}</div>
                                </td>
                                <td className="p-3">{line.yapCode || '—'}</td>
                                <td className="p-3 text-right">{formatProjectNumber(line.expectedQuantity)}</td>
                                <td className="p-3 text-right">{formatProjectNumber(line.acceptedQuantity)}</td>
                                <td className="p-3 text-right">{formatProjectNumber(line.routedQuantity)}</td>
                                <td className="p-3 text-right font-semibold text-[var(--wms-ops-accent)]">
                                  {formatProjectNumber(line.routableQuantity)}
                                </td>
                                <td className="p-3">
                                  <OpsStatusBadge tone={inferOpsStatusTone(line.status)}>
                                    {goodsReceiptEnumLabel(t, 'lineStatus', line.status)}
                                  </OpsStatusBadge>
                                </td>
                                <td className="p-3">
                                  {line.requireQualityControl ? (
                                    <OpsStatusBadge tone="quality">{t('list.qcSend')}</OpsStatusBadge>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-center gap-1">
                                    <ActionButton
                                      title={t('list.printLineLabel')}
                                      busy={busyKey === `${header.id}:${line.id}:print`}
                                      onClick={() =>
                                        void output(
                                          header.id,
                                          line.id,
                                          'print',
                                          `${header.documentNo}-${line.lineNo}`,
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
                                          `${header.documentNo}-${line.lineNo}`,
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

                      <div className="grid gap-3 md:hidden">
                        {visibleLines.map((line) => (
                          <article
                            key={line.id}
                            className="border border-[var(--wms-app-border)] bg-black/[0.015] p-4 dark:bg-white/[0.025]"
                          >
                            <header className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--wms-ops-accent)]">
                                  {t('list.lineNumber', { number: line.lineNo })}
                                </p>
                                <h4 className="break-words font-black">{line.stockCode}</h4>
                                <p className="text-xs text-slate-500">{line.stockName || t('list.noStockName')}</p>
                              </div>
                              <OpsStatusBadge className="shrink-0" tone={inferOpsStatusTone(line.status)}>
                                {goodsReceiptEnumLabel(t, 'lineStatus', line.status)}
                              </OpsStatusBadge>
                            </header>
                            {line.requireQualityControl ? (
                              <div className="mt-2">
                                <OpsStatusBadge tone="quality">{t('list.qcSend')}</OpsStatusBadge>
                              </div>
                            ) : null}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <LineMetric label={t('list.yap')} value={line.yapCode || '—'} />
                              <LineMetric
                                label={t('list.expected')}
                                value={formatProjectNumber(line.expectedQuantity)}
                              />
                              <LineMetric
                                label={t('list.accepted')}
                                value={formatProjectNumber(line.acceptedQuantity)}
                              />
                              <LineMetric
                                label={t('list.routed')}
                                value={formatProjectNumber(line.routedQuantity)}
                              />
                              <LineMetric
                                label={t('list.remaining')}
                                value={formatProjectNumber(line.routableQuantity)}
                                accent
                              />
                            </div>
                            <footer className="mt-3 flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-3">
                              <ActionButton
                                title={t('list.printLineLabel')}
                                busy={busyKey === `${header.id}:${line.id}:print`}
                                onClick={() =>
                                  void output(
                                    header.id,
                                    line.id,
                                    'print',
                                    `${header.documentNo}-${line.lineNo}`,
                                  )
                                }
                                icon={<Printer className="size-3.5" />}
                              />
                              <ActionButton
                                title={t('list.showLineLabelPdf')}
                                busy={busyKey === `${header.id}:${line.id}:pdf`}
                                onClick={() =>
                                  void output(header.id, line.id, 'pdf', `${header.documentNo}-${line.lineNo}`)
                                }
                                icon={<FileText className="size-3.5" />}
                              />
                            </footer>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
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
                  setRouteKind(null);
                  await onRoutingCompleted(result);
                }}
              />
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
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

function LineMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}): ReactElement {
  return (
    <div className="border border-[var(--wms-app-border)] p-2.5">
      <span className="block text-[11px] text-slate-500">{label}</span>
      <strong className={cn('mt-0.5 block text-sm', accent && 'text-[var(--wms-ops-accent)]')}>{value}</strong>
    </div>
  );
}
