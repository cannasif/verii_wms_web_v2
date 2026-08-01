import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock3, Eye, Play, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { formatProjectDateTime } from '@/lib/project-format';
import { localizeEnumValue } from '@/lib/enum-localization';
import { hangfireApi as systemApi, type HangfireExecutionRow } from '../api/hangfire.api';

const H = 'hangfireMonitoring';
const G = 'dataGrid.hangfireExecutions';

export function HangfirePage() {
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ['hangfire-stats'], queryFn: systemApi.hangfireStats, refetchInterval: 10000 });
  const jobs = useQuery({ queryKey: ['hangfire-recurring'], queryFn: systemApi.recurring, refetchInterval: 10000 });
  const [triggering, setTriggering] = useState<string | null>(null);
  const [detail, setDetail] = useState<HangfireExecutionRow | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'hangfire-executions'] }), 10000);
    return () => window.clearInterval(timer);
  }, [queryClient]);

  const trigger = async (id: string) => {
    setTriggering(id);
    try {
      await systemApi.trigger(id);
      toast.success(t(`${H}.triggerQueued`, { id }));
      await Promise.all([stats.refetch(), jobs.refetch(), queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'hangfire-executions'] })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${H}.triggerFailed`));
      await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'hangfire-executions'] });
    } finally {
      setTriggering(null);
    }
  };

  const triggerLabel = (source: string) =>
    source === 'ManualTrigger' ? t(`${H}.triggerSource.manual`) : t(`${H}.triggerSource.hangfire`);

  const executionColumns = useMemo<GridColumn<HangfireExecutionRow>[]>(() => [
    ...systemColumns<HangfireExecutionRow>(),
    { key: 'jobKey', label: t(`${G}.jobKey`), render: row => <span className="font-semibold">{row.jobKey}</span> },
    { key: 'status', label: t(`${G}.status`), render: row => <OpsStatusBadge tone={inferOpsStatusTone(row.status)}>{localizeEnumValue(row.status)}</OpsStatusBadge> },
    { key: 'triggerSource', label: t(`${G}.triggerSource`), render: row => triggerLabel(row.triggerSource) },
    { key: 'startedAt', label: t(`${G}.startedAt`), render: row => formatProjectDateTime(row.startedAt) },
    { key: 'durationMs', label: t(`${G}.durationMs`), render: row => row.durationMs == null ? '-' : `${row.durationMs} ms` },
    { key: 'sourceCount', label: t(`${G}.sourceCount`), render: row => row.sourceCount ?? '-' },
    { key: 'insertedCount', label: t(`${G}.insertedCount`), render: row => row.insertedCount ?? '-' },
    { key: 'updatedCount', label: t(`${G}.updatedCount`), render: row => row.updatedCount ?? '-' },
    { key: 'deactivatedCount', label: t(`${G}.deactivatedCount`), render: row => row.deactivatedCount ?? '-' },
    { key: 'errorMessage', label: t(`${G}.errorMessage`), render: row => <span className={row.errorMessage ? 'text-red-600' : 'text-slate-400'}>{row.errorMessage ?? '-'}</span> },
    {
      key: 'actions', label: t(`${G}.actions`), sortable: false, filterable: false,
      render: row => (
        <div className="wms-ops-row-actions flex items-center justify-center">
          <button type="button" onClick={() => setDetail(row)} className="wms-ops-grid-icon-btn inline-flex h-8 items-center gap-1 px-2.5 text-xs font-semibold" title={t(`${G}.view`)}>
            <Eye className="size-3.5" />
            {t(`${G}.view`)}
          </button>
        </div>
      ),
    },
  ], [t, gridLanguage]);

  const statCards = [
    { key: 'enqueued', label: t(`${H}.stats.enqueued`), icon: Clock3, color: 'text-amber-600' },
    { key: 'processing', label: t(`${H}.stats.processing`), icon: RefreshCw, color: 'text-blue-600' },
    { key: 'succeeded', label: t(`${H}.stats.succeeded`), icon: CheckCircle2, color: 'text-emerald-600' },
    { key: 'failed', label: t(`${H}.stats.failed`), icon: XCircle, color: 'text-red-600' },
  ] as const;

  return (
    <div className="wms-ops-form space-y-5" data-no-auto-localize="true">
      <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t(`${H}.title`)}</h1>
            <p className="text-sm text-slate-500">{t(`${H}.description`)}</p>
          </div>
          <OpsActionButton asChild variant="secondary">
            <a href="http://localhost:5099/hangfire" target="_blank" rel="noreferrer">{t(`${H}.dashboard`)}</a>
          </OpsActionButton>
        </div>
        <div className="my-5 grid gap-3 sm:grid-cols-4">
          {statCards.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                <Icon className={`size-4 ${color}`} />
              </div>
              <p className="mt-1 text-2xl font-bold">{stats.data?.[key] ?? 0}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/[.05]">
                <th className="p-3 text-left">{t(`${H}.recurring.job`)}</th>
                <th className="p-3 text-left">{t(`${H}.recurring.method`)}</th>
                <th className="p-3 text-left">{t(`${H}.recurring.cron`)}</th>
                <th className="p-3 text-left">{t(`${H}.recurring.lastExecution`)}</th>
                <th className="p-3">{t(`${H}.recurring.action`)}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data?.map(job => (
                <tr key={job.id} className="border-t">
                  <td className="p-3 font-medium">{job.id}</td>
                  <td className="p-3">{job.method || '-'}</td>
                  <td className="p-3">{job.cron || '-'}</td>
                  <td className="p-3">{formatProjectDateTime(job.lastExecution)}</td>
                  <td className="p-3 text-center">
                    <OpsActionButton type="button" variant="secondary" disabled={triggering !== null} onClick={() => void trigger(job.id)}>
                      {triggering === job.id ? <RefreshCw className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                      {t(`${H}.recurring.trigger`)}
                    </OpsActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.isFetching && <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" />{t(`${H}.refreshing`)}</p>}
      </section>

      <AdvancedDataGrid
        pageKey="hangfire-executions"
        title={t(`${G}.title`)}
        description={t(`${G}.description`)}
        columns={executionColumns}
        fetchPage={systemApi.hangfireExecutions}
      />

      {detail && (
        <Dialog open onOpenChange={open => { if (!open) setDetail(null); }}>
          <OpsDialogContent size="lg" className="wms-ops-access-control-dialog">
            <OpsDialogHeader>
              <div>
                <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{t(`${H}.detail.title`)}</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">{detail.jobKey}</p>
              </div>
            </OpsDialogHeader>
            <OpsDialogBody>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label={t(`${H}.detail.status`)}><OpsStatusBadge tone={inferOpsStatusTone(detail.status)}>{localizeEnumValue(detail.status)}</OpsStatusBadge></Detail>
                <Detail label={t(`${H}.detail.startedAt`)}>{formatProjectDateTime(detail.startedAt)}</Detail>
                <Detail label={t(`${H}.detail.completedAt`)}>{formatProjectDateTime(detail.completedAt)}</Detail>
                <Detail label={t(`${H}.detail.duration`)}>{detail.durationMs == null ? '-' : `${detail.durationMs} ms`}</Detail>
                <Detail label={t(`${H}.detail.result`)} wide>{detail.resultSummary ?? '-'}</Detail>
                <Detail label={t(`${H}.detail.errorType`)} wide>{detail.errorType ?? '-'}</Detail>
                <Detail label={t(`${H}.detail.errorMessage`)} wide><span className="text-red-600">{detail.errorMessage ?? '-'}</span></Detail>
                {detail.stackTrace && <Detail label={t(`${H}.detail.stackTrace`)} wide><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{detail.stackTrace}</pre></Detail>}
              </div>
            </OpsDialogBody>
            <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
              <OpsActionButton type="button" variant="primary" onClick={() => setDetail(null)}>
                {t(`${H}.detail.close`)}
              </OpsActionButton>
            </OpsDialogFooter>
          </OpsDialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={`rounded-xl border p-3 ${wide ? 'sm:col-span-2' : ''}`}><p className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</p><div className="text-sm">{children}</div></div>;
}
