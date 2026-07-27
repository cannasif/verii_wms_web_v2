import { useMemo, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { OpsDialogBody, OpsDialogContent, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { WorkspaceOverlay } from '@/components/shared/WorkspaceOverlay';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { formatProjectDateTime } from '@/lib/project-format';
import { auditLogsApi } from '../api/audit-logs.api';
import type { AuditLogDetail, AuditLogRow } from '../types/audit-log.types';

export function AuditLogsPage() {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const openDetail = async (row: AuditLogRow) => {
    setLoading(true);
    try { setDetail(await auditLogsApi.getById(row.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Audit detayı alınamadı.'); }
    finally { setLoading(false); }
  };

  const columns = useMemo<GridColumn<AuditLogRow>[]>(() => [
    { key: 'id', label: 'Kayıt ID', hideable: false, render: (row) => <span className="font-mono text-xs font-semibold">#{row.id}</span> },
    { key: 'createdBy', label: 'Kayıt Eden', sortable: false, filterable: false, render: (row) => row.performedByUserEmail || (row.performedByUserId ? `Kullanıcı #${row.performedByUserId}` : 'Sistem') },
    { key: 'updatedBy', label: 'Güncelleyen', sortable: false, filterable: false, render: () => '-' },
    { key: 'updatedDate', label: 'Güncelleme Zamanı', sortable: false, filterable: false, render: () => '-' },
    { key: 'createdDate', label: 'Tarih', render: (row) => formatProjectDateTime(row.createdDate) },
    { key: 'actionType', label: 'İşlem', render: (row) => <span className="font-semibold">{row.actionType}</span> },
    { key: 'entityType', label: 'Varlık', render: (row) => <span>{row.entityType} <small className="text-slate-500">#{row.entityId}</small></span> },
    { key: 'result', label: 'Sonuç', render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.result.toLowerCase() === 'succeeded' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{row.result}</span> },
    { key: 'source', label: 'Kaynak', render: (row) => row.source },
    { key: 'performedByUserEmail', label: 'İşlemi Yapan', render: (row) => row.performedByUserEmail || (row.performedByUserId ? `Kullanıcı #${row.performedByUserId}` : 'Sistem') },
    { key: 'requestMethod', label: 'İstek', render: (row) => <span className="text-xs"><strong>{row.requestMethod || '-'}</strong> {row.requestPath || ''}</span> },
    { key: 'traceId', label: 'Trace', render: (row) => <code className="text-xs">{row.traceId}</code> },
    { key: 'actions', label: 'Detay', sortable: false, filterable: false, render: (row) => <button type="button" aria-label={`Audit ${row.id} detayını görüntüle`} onClick={() => openDetail(row)} className="rounded-lg border p-2 text-cyan-600 hover:bg-cyan-50"><Eye className="size-4"/></button> },
  ], []);

  return <>
    <AdvancedDataGrid pageKey="audit-logs" title="Audit Kayıtları" description="Kritik kullanıcı ve yetki değişikliklerini eski-yeni değerleriyle izleyin." columns={columns} fetchPage={auditLogsApi.getPaged}/>
    {loading && !detail && <WorkspaceOverlay><Loader2 className="size-8 animate-spin text-white"/></WorkspaceOverlay>}
    {detail && (
      <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <OpsDialogContent size="xl">
          <OpsDialogHeader>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">Audit Kaydı #{detail.id}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{detail.actionType} • {detail.entityType} #{detail.entityId}</p>
            </div>
          </OpsDialogHeader>
          <OpsDialogBody className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Tarih" value={formatProjectDateTime(detail.createdDate)}/>
              <Info label="Sonuç" value={detail.result}/>
              <Info label="Kaynak" value={detail.source}/>
              <Info label="Şube" value={detail.branchCode || '-'}/>
              <Info label="İşlemi yapan" value={detail.performedByUserEmail || (detail.performedByUserId ? `#${detail.performedByUserId}` : 'Sistem')}/>
              <Info label="HTTP" value={`${detail.requestMethod || '-'} ${detail.requestPath || ''}`}/>
              <Info label="Trace ID" value={detail.traceId} wide/>
              <Info label="Neden / Hata" value={detail.failureReason || detail.reason || '-'} wide/>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <JsonPanel title="Eski Değerler" value={detail.oldValues}/>
              <JsonPanel title="Yeni Değerler" value={detail.newValues}/>
            </div>
            <JsonPanel title="Değişen Alanlar" value={detail.changedFields}/>
          </OpsDialogBody>
        </OpsDialogContent>
      </Dialog>
    )}
  </>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-xl border border-[var(--wms-app-border)] p-3 ${wide ? 'lg:col-span-2' : ''}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-all text-sm font-medium">{value}</p></div>;
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return <section className="overflow-hidden rounded-xl border border-[var(--wms-app-border)]"><h3 className="border-b border-[var(--wms-app-border)] bg-slate-50 px-4 py-2 text-sm font-semibold dark:bg-white/[.04]">{title}</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-xs">{value == null ? 'Kayıt yok' : JSON.stringify(value, null, 2)}</pre></section>;
}
