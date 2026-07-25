import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Eye, Play, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatProjectDateTime } from '@/lib/project-format';
import { hangfireApi as systemApi, type HangfireExecutionRow } from '../api/hangfire.api';

const statusLabels: Record<string, string> = { Running: 'Çalışıyor', Succeeded: 'Başarılı', Failed: 'Başarısız', TriggerFailed: 'Tetiklenemedi' };

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'Succeeded' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : status === 'Running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{statusLabels[status] ?? status}</span>;
}

export function HangfirePage() {
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
      toast.success(`${id} kuyruğa alındı.`);
      await Promise.all([stats.refetch(), jobs.refetch(), queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'hangfire-executions'] })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Job tetiklenemedi.');
      await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'hangfire-executions'] });
    } finally {
      setTriggering(null);
    }
  };

  const executionColumns = useMemo<GridColumn<HangfireExecutionRow>[]>(() => [
    ...systemColumns<HangfireExecutionRow>(),
    { key: 'jobKey', label: 'Job', render: (row) => <span className="font-semibold">{row.jobKey}</span> },
    { key: 'status', label: 'Durum', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'triggerSource', label: 'Tetikleme', render: (row) => row.triggerSource === 'ManualTrigger' ? 'Manuel' : 'Hangfire' },
    { key: 'startedAt', label: 'Başlangıç', render: (row) => formatProjectDateTime(row.startedAt) },
    { key: 'durationMs', label: 'Süre', render: (row) => row.durationMs == null ? '-' : `${row.durationMs} ms` },
    { key: 'sourceCount', label: 'Kaynak Kayıt', render: (row) => row.sourceCount ?? '-' },
    { key: 'insertedCount', label: 'Eklenen', render: (row) => row.insertedCount ?? '-' },
    { key: 'updatedCount', label: 'Güncellenen', render: (row) => row.updatedCount ?? '-' },
    { key: 'deactivatedCount', label: 'Pasif', render: (row) => row.deactivatedCount ?? '-' },
    { key: 'errorMessage', label: 'Hata', render: (row) => <span className={row.errorMessage ? 'text-red-600' : 'text-slate-400'}>{row.errorMessage ?? '-'}</span> },
    { key: 'actions', label: 'Detay', sortable: false, filterable: false, render: (row) => <button type="button" onClick={() => setDetail(row)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Eye className="size-3.5"/>Görüntüle</button> },
  ], []);

  const statCards = [
    { key: 'enqueued', label: 'Kuyrukta', icon: Clock3, color: 'text-amber-600' },
    { key: 'processing', label: 'Çalışıyor', icon: RefreshCw, color: 'text-blue-600' },
    { key: 'succeeded', label: 'Başarılı', icon: CheckCircle2, color: 'text-emerald-600' },
    { key: 'failed', label: 'Başarısız', icon: XCircle, color: 'text-red-600' },
  ];

  return <div className="space-y-5">
    <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Hangfire İzleme</h1><p className="text-sm text-slate-500">Recurring job durumları, manuel tetikleme ve kalıcı çalışma geçmişi.</p></div><a href="http://localhost:5099/hangfire" target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-center text-sm">Dashboard</a></div>
      <div className="my-5 grid gap-3 sm:grid-cols-4">{statCards.map(({ key, label, icon: Icon, color }) => <div key={key} className="rounded-xl border p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><Icon className={`size-4 ${color}`}/></div><p className="mt-1 text-2xl font-bold">{stats.data?.[key] ?? 0}</p></div>)}</div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-100/80 dark:bg-white/[.05]"><th className="p-3 text-left">Job</th><th className="p-3 text-left">Metot</th><th className="p-3 text-left">Cron</th><th className="p-3 text-left">Son Çalışma</th><th className="p-3">İşlem</th></tr></thead><tbody>{jobs.data?.map((job) => <tr key={job.id} className="border-t"><td className="p-3 font-medium">{job.id}</td><td className="p-3">{job.method || '-'}</td><td className="p-3">{job.cron || '-'}</td><td className="p-3">{formatProjectDateTime(job.lastExecution)}</td><td className="p-3 text-center"><button type="button" disabled={triggering !== null} onClick={() => trigger(job.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 disabled:opacity-50">{triggering === job.id ? <RefreshCw className="size-3 animate-spin"/> : <Play className="size-3"/>}Tetikle</button></td></tr>)}</tbody></table></div>
      {jobs.isFetching && <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin"/>Güncelleniyor...</p>}
    </section>

    <AdvancedDataGrid pageKey="hangfire-executions" title="Çalışma Geçmişi" description="Başarılı ve başarısız Hangfire çalıştırmaları veritabanından sayfalı olarak listelenir." columns={executionColumns} fetchPage={systemApi.hangfireExecutions}/>

    {detail && <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}><DialogContent showCloseButton={false} className="max-h-[calc(100%-2rem)] w-full !max-w-3xl overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><DialogTitle className="text-xl font-bold">Çalışma Detayı</DialogTitle><p className="mt-1 text-sm text-slate-500">{detail.jobKey}</p></div><button type="button" aria-label="Kapat" onClick={() => setDetail(null)} className="rounded-lg border p-2"><XCircle className="size-4"/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Detail label="Durum"><StatusBadge status={detail.status}/></Detail><Detail label="Başlangıç">{formatProjectDateTime(detail.startedAt)}</Detail><Detail label="Bitiş">{formatProjectDateTime(detail.completedAt)}</Detail><Detail label="Süre">{detail.durationMs == null ? '-' : `${detail.durationMs} ms`}</Detail><Detail label="Sonuç" wide>{detail.resultSummary ?? '-'}</Detail><Detail label="Hata türü" wide>{detail.errorType ?? '-'}</Detail><Detail label="Hata mesajı" wide><span className="text-red-600">{detail.errorMessage ?? '-'}</span></Detail>{detail.stackTrace && <Detail label="Teknik detay" wide><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{detail.stackTrace}</pre></Detail>}</div><div className="mt-5 flex justify-end"><button type="button" onClick={() => setDetail(null)} className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-white">Kapat</button></div></DialogContent></Dialog>}
  </div>;
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={`rounded-xl border p-3 ${wide ? 'sm:col-span-2' : ''}`}><p className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</p><div className="text-sm">{children}</div></div>;
}
