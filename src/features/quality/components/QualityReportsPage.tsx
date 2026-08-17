import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Boxes, Clock3, Coffee, Eye, Image, Loader2, PauseCircle, ShieldCheck, Users } from 'lucide-react';
import { AdvancedDataGrid, type GridColumn, type GridRequest } from '@/components/shared/AdvancedDataGrid';
import { OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import {
  qualityApi,
  type QualityInspectionReportDetail,
  type QualityInspectionReportLine,
  type QualityInspectionReportRow,
  type QualityStockReportRow,
} from '../api/quality.api';
import { QualityInspectionLineImageGalleryDialog } from './QualityInspectionLineImageGallery';

type ReportTab = 'inspection' | 'stock';

export function QualityReportsPage(): ReactElement {
  const { t, i18n } = useModuleTranslation('quality');
  const [tab, setTab] = useState<ReportTab>('inspection');
  const [detailId, setDetailId] = useState<number | null>(null);
  const fetchInspections = useCallback((request: GridRequest) => qualityApi.inspectionReportsPaged(request), []);
  const fetchStocks = useCallback((request: GridRequest) => qualityApi.stockReportsPaged(request), []);

  const inspectionColumns = useMemo<GridColumn<QualityInspectionReportRow>[]>(() => [
    column('inspectionNo', t('reports.columns.inspectionNo'), row => row.inspectionNo, 190, true),
    column('waybillNo', t('reports.columns.waybillNo'), row => row.waybillNo || '—', 180, true),
    column('supplierCode', t('reports.columns.supplierCode'), row => row.supplierCode || '—', 140, true),
    column('supplierName', t('reports.columns.supplierName'), row => row.supplierName || '—', 240, true),
    column('warehouseCode', t('reports.columns.warehouseCode'), row => row.warehouseCode ?? '—', 120, true, 'number'),
    column('warehouseName', t('reports.columns.warehouseName'), row => row.warehouseName || '—', 210, true),
    column('totalQuantity', t('reports.columns.totalQuantity'), row => quantity(row.totalQuantity), 130, false, 'number'),
    column('requiredInspectionQuantity', t('reports.columns.requiredQuantity'), row => quantity(row.requiredInspectionQuantity), 145, false, 'number'),
    column('inspectedQuantity', t('reports.columns.inspectedQuantity'), row => (
      <MetricProgress value={row.inspectedQuantity} total={row.totalQuantity} />
    ), 170, false, 'number'),
    column('acceptedQuantity', t('reports.columns.acceptedQuantity'), row => quantity(row.acceptedQuantity), 130, false, 'number'),
    column('rejectedQuantity', t('reports.columns.rejectedQuantity'), row => quantity(row.rejectedQuantity), 130, false, 'number'),
    column('quarantineQuantity', t('reports.columns.quarantineQuantity'), row => quantity(row.quarantineQuantity), 145, false, 'number'),
    column('activeWorkSeconds', t('reports.columns.activeTime'), row => duration(row.activeWorkSeconds), 135, false, 'number', false),
    column('elapsedSeconds', t('reports.columns.elapsedTime'), row => duration(row.elapsedSeconds), 135, false, 'number', false),
    column('pauseCount', t('reports.columns.pauseCount'), row => row.pauseCount, 110, false, 'number', false),
    column('breakCount', t('reports.columns.breakCount'), row => row.breakCount, 110, false, 'number', false),
    // Participants are enriched after server-side paging, so they cannot be a reliable search field.
    column('participants', t('reports.columns.participants'), row => row.participants || '—', 220, false, 'text', false),
    {
      key: 'status', label: t('reports.columns.status'), width: 130, sortable: true, filterable: true, filterType: 'enum',
      filterOptions: ['Pending', 'InProgress', 'PartiallyDecided', 'Passed', 'Failed', 'Quarantined', 'Released', 'Cancelled']
        .map(value => ({ value, label: localizeEnumValue(value, i18n.resolvedLanguage) })),
      render: row => <OpsStatusBadge tone={inferOpsStatusTone(row.status)}>{localizeEnumValue(row.status, i18n.resolvedLanguage)}</OpsStatusBadge>,
      contextValue: row => localizeEnumValue(row.status, i18n.resolvedLanguage),
    },
    column('createdAtUtc', t('reports.columns.createdAt'), row => formatProjectDateTime(row.createdAtUtc), 165, false, 'datetime'),
    {
      key: 'actions', label: t('reports.columns.detail'), width: 112, filterable: false, sortable: false, searchable: false,
      render: row => <button type="button" onClick={() => setDetailId(row.id)} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-cyan-500/30 px-2.5 text-xs font-bold text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"><Eye className="size-3.5" />{t('reports.detail.open')}</button>,
    },
  ], [i18n.resolvedLanguage, t]);

  const stockColumns = useMemo<GridColumn<QualityStockReportRow>[]>(() => [
    column('stockCode', t('reports.columns.stockCode'), row => row.stockCode, 170, true),
    column('stockName', t('reports.columns.stockName'), row => row.stockName || '—', 280, true),
    column('inspectionCount', t('reports.columns.inspectionCount'), row => row.inspectionCount, 130, false, 'number'),
    column('receiptCount', t('reports.columns.receiptCount'), row => row.receiptCount, 130, false, 'number'),
    column('totalQuantity', t('reports.columns.totalQuantity'), row => quantity(row.totalQuantity), 135, false, 'number'),
    column('requiredInspectionQuantity', t('reports.columns.requiredQuantity'), row => quantity(row.requiredInspectionQuantity), 145, false, 'number'),
    column('inspectedQuantity', t('reports.columns.inspectedQuantity'), row => <MetricProgress value={row.inspectedQuantity} total={row.totalQuantity} />, 175, false, 'number'),
    column('acceptedQuantity', t('reports.columns.acceptedQuantity'), row => quantity(row.acceptedQuantity), 135, false, 'number'),
    column('rejectedQuantity', t('reports.columns.rejectedQuantity'), row => quantity(row.rejectedQuantity), 135, false, 'number'),
    column('quarantineQuantity', t('reports.columns.quarantineQuantity'), row => quantity(row.quarantineQuantity), 145, false, 'number'),
    column('activeWorkSeconds', t('reports.columns.relatedActiveTime'), row => duration(row.activeWorkSeconds), 155, false, 'number', false),
    column('averageWorkSeconds', t('reports.columns.averageRelatedTime'), row => duration(row.averageWorkSeconds), 165, false, 'number', false),
    column('participantCount', t('reports.columns.workerCount'), row => row.participantCount, 120, false, 'number', false),
    column('lastInspectionAtUtc', t('reports.columns.lastInspection'), row => formatProjectDateTime(row.lastInspectionAtUtc), 170, false, 'datetime'),
  ], [t]);

  return (
    <section className="space-y-5" data-no-auto-localize="true">
      <header className="overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-4 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-600">{t('reports.eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{t('reports.title')}</h1>
        <p className="mt-2 max-w-5xl text-sm leading-relaxed text-[var(--wms-app-text-muted)]">{t('reports.description')}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportTabButton active={tab === 'inspection'} icon={<ShieldCheck className="size-5" />} title={t('reports.tabs.inspection.title')} description={t('reports.tabs.inspection.description')} onClick={() => setTab('inspection')} />
        <ReportTabButton active={tab === 'stock'} icon={<Boxes className="size-5" />} title={t('reports.tabs.stock.title')} description={t('reports.tabs.stock.description')} onClick={() => setTab('stock')} />
      </div>

      {tab === 'inspection' ? (
        <AdvancedDataGrid
          pageKey="quality-inspection-reports"
          title={t('reports.tabs.inspection.title')}
          description={t('reports.tabs.inspection.gridDescription')}
          columns={inspectionColumns}
          fetchPage={fetchInspections}
          onRowDoubleClick={row => setDetailId(row.id)}
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-[var(--wms-app-text-muted)]">{t('reports.tabs.stock.timeNotice')}</div>
          <AdvancedDataGrid
            pageKey="quality-stock-reports"
            title={t('reports.tabs.stock.title')}
            description={t('reports.tabs.stock.gridDescription')}
            columns={stockColumns}
            fetchPage={fetchStocks}
          />
        </div>
      )}

      <InspectionReportDialog inspectionId={detailId} onClose={() => setDetailId(null)} />
    </section>
  );
}

function InspectionReportDialog({ inspectionId, onClose }: { inspectionId: number | null; onClose: () => void }): ReactElement {
  const { t, i18n } = useModuleTranslation('quality');
  const { can } = usePermissionAccess();
  const report = useQuery({
    queryKey: ['quality-inspection-report-detail', inspectionId],
    queryFn: () => qualityApi.inspectionReportDetail(inspectionId!),
    enabled: inspectionId != null,
    staleTime: 60_000,
  });
  return (
    <Dialog open={inspectionId != null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[94dvh] w-[min(96vw,1500px)] max-w-none overflow-y-auto">
        <DialogHeader className="border-b border-[var(--wms-app-border)] p-5 pr-14">
          <DialogTitle>{report.data?.header.inspectionNo || t('reports.detail.title')}</DialogTitle>
          <DialogDescription>{report.data ? [report.data.header.waybillNo, report.data.header.supplierName].filter(Boolean).join(' · ') : t('reports.detail.loading')}</DialogDescription>
        </DialogHeader>
        {report.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-7 animate-spin text-cyan-600" /></div> : null}
        {report.isError ? <div role="alert" className="m-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{t('reports.detail.error')}</div> : null}
        {report.data ? <InspectionReportDetail report={report.data} canViewImages={can('WMS.QUALITY.INSPECTIONS.IMAGES.VIEW')} language={i18n.resolvedLanguage} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function InspectionReportDetail({ report, canViewImages, language }: { report: QualityInspectionReportDetail; canViewImages: boolean; language?: string }): ReactElement {
  const { t } = useModuleTranslation('quality');
  const h = report.header;
  return <div className="space-y-5 p-4 sm:p-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-9">
      <SummaryCard icon={<Boxes />} label={t('reports.detail.total')} value={quantity(h.totalQuantity)} />
      <SummaryCard icon={<ShieldCheck />} label={t('reports.detail.required')} value={quantity(h.requiredInspectionQuantity)} />
      <SummaryCard icon={<BarChart3 />} label={t('reports.detail.inspected')} value={`${quantity(h.inspectedQuantity)} · %${formatProjectNumber(h.inspectionCoveragePercent)}`} />
      <SummaryCard icon={<Clock3 />} label={t('reports.detail.activeTime')} value={duration(h.activeWorkSeconds)} />
      <SummaryCard icon={<PauseCircle />} label={t('reports.detail.elapsedTime')} value={duration(h.elapsedSeconds)} />
      <SummaryCard icon={<PauseCircle />} label={t('reports.detail.pauseTime')} value={duration(h.pauseSeconds)} />
      <SummaryCard icon={<Coffee />} label={t('reports.detail.pauseBreak')} value={`${h.pauseCount} / ${h.breakCount}`} />
      <SummaryCard icon={<Users />} label={t('reports.detail.workers')} value={String(h.participantCount)} />
      <SummaryCard icon={<Image />} label={t('reports.detail.images')} value={String(h.imageCount)} />
    </div>

    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4">
      <h2 className="font-black">{t('reports.detail.lines')}</h2>
      <div className="mt-3 space-y-3">
        {report.lines.map(line => <ReportLine key={line.id} inspectionId={h.id} line={line} canViewImages={canViewImages} language={language} />)}
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4">
        <h2 className="font-black">{t('reports.detail.workerPerformance')}</h2>
        <div className="mt-3 space-y-2">
          {report.workers.length ? report.workers.map(worker => <div key={worker.userId} className="grid gap-2 rounded-xl border border-[var(--wms-app-border)] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><strong>{worker.userName}</strong><p className="text-xs text-[var(--wms-app-text-muted)]">{formatProjectDateTime(worker.firstStartedAtUtc)} — {worker.lastEndedAtUtc ? formatProjectDateTime(worker.lastEndedAtUtc) : t('reports.detail.running')}</p></div><span className="font-mono text-sm font-bold">{duration(worker.activeWorkSeconds)}</span><span className="text-xs text-[var(--wms-app-text-muted)]">{t('reports.detail.sessionCount', { count: worker.sessionCount })}</span></div>) : <EmptyText>{t('reports.detail.noWork')}</EmptyText>}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4">
        <h2 className="font-black">{t('reports.detail.pauseTimeline')}</h2>
        <div className="mt-3 space-y-2">
          {report.pauses.length ? report.pauses.map(pause => <article key={pause.sequenceNo} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{pause.workerName} · {stopReasonLabel(pause.reason, t)}</strong><span className="font-mono text-xs">{pause.pauseSecondsUntilNextSession == null ? '—' : duration(pause.pauseSecondsUntilNextSession)}</span></div><p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{formatProjectDateTime(pause.startedAtUtc)} → {formatProjectDateTime(pause.endedAtUtc)}</p><p className="mt-2 text-sm">{pause.note || t('reports.detail.noPauseNote')}</p></article>) : <EmptyText>{t('reports.detail.noPauses')}</EmptyText>}
        </div>
      </section>
    </div>
  </div>;
}

function ReportLine({ inspectionId, line, canViewImages, language }: { inspectionId: number; line: QualityInspectionReportLine; canViewImages: boolean; language?: string }): ReactElement {
  const { t } = useModuleTranslation('quality');
  return <article className="rounded-xl border border-[var(--wms-app-border)] p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><strong>{line.stockCode}</strong><p className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName || '—'}{line.lotNo ? ` · LOT ${line.lotNo}` : ''}{line.serialNo ? ` · SN ${line.serialNo}` : ''}</p></div>
      <div className="flex items-center gap-2"><OpsStatusBadge tone={inferOpsStatusTone(line.decision)}>{localizeEnumValue(line.decision, language)}</OpsStatusBadge>{line.imageCount > 0 && canViewImages ? <QualityInspectionLineImageGalleryDialog inspectionId={inspectionId} lineId={line.id} canView canUpload={false} canDelete={false} /> : null}</div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      <SmallMetric label={t('reports.detail.total')} value={quantity(line.totalQuantity)} />
      <SmallMetric label={t('reports.detail.required')} value={quantity(line.requiredInspectionQuantity)} />
      <SmallMetric label={t('reports.detail.inspected')} value={quantity(line.inspectedQuantity)} />
      <SmallMetric label={t('reports.detail.accepted')} value={quantity(line.acceptedQuantity)} />
      <SmallMetric label={t('reports.detail.rejected')} value={quantity(line.rejectedQuantity)} />
      <SmallMetric label={t('reports.detail.quarantined')} value={quantity(line.quarantineQuantity)} />
      <SmallMetric label={t('reports.detail.controlCount')} value={String(line.controlCount)} />
    </div>
    {(line.decisionCode || line.decisionNote) ? <p className="mt-3 rounded-lg bg-[var(--wms-app-bg)] p-2 text-xs"><strong>{line.decisionCode || '—'}</strong>{line.decisionNote ? ` · ${line.decisionNote}` : ''}</p> : null}
  </article>;
}

function ReportTabButton({ active, icon, title, description, onClick }: { active: boolean; icon: ReactNode; title: string; description: string; onClick: () => void }): ReactElement {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/10' : 'border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] hover:border-cyan-500/40'}`}><span className="grid size-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600">{icon}</span><strong className="mt-3 block">{title}</strong><span className="mt-1 block text-xs leading-relaxed text-[var(--wms-app-text-muted)]">{description}</span></button>;
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }): ReactElement {
  return <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3"><span className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]"><span className="[&_svg]:size-3.5">{icon}</span>{label}</span><strong className="mt-1 block font-mono text-sm">{value}</strong></div>;
}

function SmallMetric({ label, value }: { label: string; value: string }): ReactElement { return <div className="rounded-lg bg-[var(--wms-app-bg)] p-2"><span className="block text-[0.6rem] font-bold uppercase text-[var(--wms-app-text-muted)]">{label}</span><strong className="mt-0.5 block font-mono text-xs">{value}</strong></div>; }
function EmptyText({ children }: { children: ReactNode }): ReactElement { return <p className="rounded-xl border border-dashed border-[var(--wms-app-border)] p-4 text-center text-sm text-[var(--wms-app-text-muted)]">{children}</p>; }
function MetricProgress({ value, total }: { value: number; total: number }): ReactElement { const percent = total > 0 ? Math.min(100, Math.max(0, value * 100 / total)) : 0; return <div className="min-w-28"><strong className="font-mono text-xs">{quantity(value)} / {quantity(total)}</strong><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><span className="block h-full bg-cyan-500" style={{ width: `${percent}%` }} /></div></div>; }
function quantity(value: number): string { return formatProjectNumber(value, { maximumFractionDigits: 3 }); }
function duration(value: number): string { const seconds = Math.max(0, Math.floor(value || 0)); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`; }
function stopReasonLabel(reason: string, t: (key: string) => string): string { return t(`reports.stopReasons.${reason}`); }

function column<T>(key: string, label: string, render: (row: T) => ReactNode, width: number, searchable: boolean, filterType: 'text' | 'number' | 'datetime' = 'text', sortable = true, filterable = sortable): GridColumn<T> {
  return { key, label, width, render, contextValue: row => { const value = render(row); return typeof value === 'string' || typeof value === 'number' ? value : null; }, filterable, sortable, searchable, defaultSearch: searchable, filterType };
}
