import { useCallback, useMemo, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { WorkspaceOverlay } from '@/components/shared/WorkspaceOverlay';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { formatProjectDateTime } from '@/lib/project-format';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { auditLogsApi } from '../api/audit-logs.api';
import type { AuditLogDetail, AuditLogRow } from '../types/audit-log.types';

export function AuditLogsPage() {
  const { t, moduleReady } = useModuleTranslation('audit-logs');
  const { t: tc } = useTranslation('common');
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const performedByLabel = useCallback(
    (row: { performedByUserEmail?: string | null; performedByUserId?: number | string | null }) =>
      row.performedByUserEmail || (row.performedByUserId ? t('userHash', { id: row.performedByUserId }) : t('system')),
    [t],
  );

  const openDetail = useCallback(async (row: AuditLogRow) => {
    setLoading(true);
    try { setDetail(await auditLogsApi.getById(row.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('toast.detailFetchFailed')); }
    finally { setLoading(false); }
  }, [t]);

  const columns = useMemo<GridColumn<AuditLogRow>[]>(() => {
    if (!moduleReady) return [];
    return [
    { key: 'id', label: t('columns.id'), hideable: false, render: (row) => <span className="font-mono text-xs font-semibold">#{row.id}</span> },
    { key: 'createdBy', label: t('columns.createdBy'), sortable: false, filterable: false, render: (row) => performedByLabel(row) },
    { key: 'updatedBy', label: t('columns.updatedBy'), sortable: false, filterable: false, render: () => '-' },
    { key: 'updatedDate', label: t('columns.updatedDate'), sortable: false, filterable: false, render: () => '-' },
    { key: 'createdDate', label: t('columns.createdDate'), render: (row) => formatProjectDateTime(row.createdDate) },
    { key: 'actionType', label: t('columns.actionType'), render: (row) => <span className="font-semibold">{row.actionType}</span> },
    { key: 'entityType', label: t('columns.entityType'), render: (row) => <span>{row.entityType} <small className="text-slate-500">#{row.entityId}</small></span> },
    { key: 'result', label: t('columns.result'), render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.result.toLowerCase() === 'succeeded' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{row.result}</span> },
    { key: 'source', label: t('columns.source'), render: (row) => row.source },
    { key: 'performedByUserEmail', label: t('columns.performedBy'), render: (row) => performedByLabel(row) },
    { key: 'requestMethod', label: t('columns.request'), render: (row) => <span className="text-xs"><strong>{row.requestMethod || '-'}</strong> {row.requestPath || ''}</span> },
    { key: 'traceId', label: t('columns.traceId'), render: (row) => <code className="text-xs">{row.traceId}</code> },
    {
      key: 'actions',
      label: t('columns.actions'),
      sortable: false,
      filterable: false,
      render: (row) => (
        <div className="wms-ops-row-actions flex items-center justify-center">
          <button
            type="button"
            aria-label={t('detailAria', { id: row.id })}
            onClick={() => openDetail(row)}
            className="wms-ops-grid-icon-btn grid size-8 place-items-center"
          >
            <Eye className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];
  }, [moduleReady, openDetail, performedByLabel, t]);

  if (!moduleReady) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </section>
    );
  }

  return <>
    <AdvancedDataGrid pageKey="audit-logs" title={t('page.title')} description={t('page.description')} columns={columns} fetchPage={auditLogsApi.getPaged}/>
    {loading && !detail && <WorkspaceOverlay><Loader2 className="size-8 animate-spin text-white"/></WorkspaceOverlay>}
    {detail && (
      <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <OpsDialogContent size="xl" className="wms-ops-access-control-dialog">
          <OpsDialogHeader>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{t('detail.titlePrefix', { id: detail.id })}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{detail.actionType} • {detail.entityType} #{detail.entityId}</p>
            </div>
          </OpsDialogHeader>
          <OpsDialogBody className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t('detail.date')} value={formatProjectDateTime(detail.createdDate)}/>
              <Info label={t('detail.result')} value={detail.result}/>
              <Info label={t('detail.source')} value={detail.source}/>
              <Info label={t('detail.branch')} value={detail.branchCode || '-'}/>
              <Info label={t('detail.performedBy')} value={detail.performedByUserEmail || (detail.performedByUserId ? `#${detail.performedByUserId}` : t('system'))}/>
              <Info label={t('detail.http')} value={`${detail.requestMethod || '-'} ${detail.requestPath || ''}`}/>
              <Info label={t('detail.traceId')} value={detail.traceId} wide/>
              <Info label={t('detail.reason')} value={detail.failureReason || detail.reason || '-'} wide/>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <JsonPanel title={t('detail.oldValues')} value={detail.oldValues} emptyLabel={t('detail.noRecord')}/>
              <JsonPanel title={t('detail.newValues')} value={detail.newValues} emptyLabel={t('detail.noRecord')}/>
            </div>
            <JsonPanel title={t('detail.changedFields')} value={detail.changedFields} emptyLabel={t('detail.noRecord')}/>
          </OpsDialogBody>
          <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
            <OpsActionButton type="button" variant="primary" onClick={() => setDetail(null)}>
              {tc('common.close')}
            </OpsActionButton>
          </OpsDialogFooter>
        </OpsDialogContent>
      </Dialog>
    )}
  </>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-xl border border-[var(--wms-app-border)] p-3 ${wide ? 'lg:col-span-2' : ''}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-all text-sm font-medium">{value}</p></div>;
}

function JsonPanel({ title, value, emptyLabel }: { title: string; value: unknown; emptyLabel: string }) {
  return <section className="overflow-hidden rounded-xl border border-[var(--wms-app-border)]"><h3 className="border-b border-[var(--wms-app-border)] bg-slate-50 px-4 py-2 text-sm font-semibold dark:bg-white/[.04]">{title}</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-xs">{value == null ? emptyLabel : JSON.stringify(value, null, 2)}</pre></section>;
}
