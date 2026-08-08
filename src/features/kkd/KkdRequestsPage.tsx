import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, PackageCheck, Plus, SearchCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { cn } from '@/lib/utils';
import {
  kkdApi,
  type KkdEmployee,
  type KkdRequestCreatePayload,
  type KkdRequestDetail,
  type KkdRequestLine,
  type KkdRequestRow,
  type KkdStockLookup,
} from './kkd-api';
import { KkdField, KkdPanel } from './kkd-ops-ui';

type DraftLine = {
  key: string;
  groupCode: string;
  groupName: string;
  stockId: number | null;
  stockLabel: string;
  quantity: number;
};

const newLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  groupCode: '',
  groupName: '',
  stockId: null,
  stockLabel: '',
  quantity: 1,
});

const CLOSED = new Set(['Completed', 'Cancelled']);

export function KkdRequestsPage(): ReactElement {
  const { t, i18n } = useModuleTranslation('kkd');
  const { can } = usePermissionAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [revision, setRevision] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveLine, setResolveLine] = useState<KkdRequestLine | null>(null);
  const [resolveStock, setResolveStock] = useState<{ id: number; label: string } | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [priority, setPriority] = useState<KkdRequestCreatePayload['priority']>('Normal');
  const [neededAt, setNeededAt] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);

  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const detail = useQuery({
    queryKey: ['kkd', 'requests', detailId],
    queryFn: () => kkdApi.requestDetail(detailId!),
    enabled: Boolean(detailId),
  });

  const formatDateTime = useCallback((value?: string | null): string => value
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—', [i18n.language]);
  const formatQuantity = useCallback((value: number): string =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(value), [i18n.language]);
  const enumText = useCallback((scope: string, value: string): string =>
    t(`${scope}.${value}`, { defaultValue: value }), [t]);
  const prepare = useCallback((row: KkdRequestRow | KkdRequestDetail): void => {
    const params = new URLSearchParams({ employeeId: String(row.employeeId), requestId: String(row.id), taskMode: '1' });
    navigate(`/warehouse/kkd/distributions/new?${params.toString()}`);
  }, [navigate]);

  const columns = useMemo<GridColumn<KkdRequestRow>[]>(() => [
    { key: 'id', label: t('grid.id'), width: 88, render: (row) => row.id, filterType: 'number', sortable: true },
    { key: 'requestNo', label: t('grid.requestNo'), width: 190, render: (row) => <strong>{row.requestNo}</strong>, searchable: true, defaultSearch: true, sortable: true },
    { key: 'status', label: t('grid.status'), width: 165, render: (row) => <Status value={row.status} text={enumText('status', row.status)}/>, filterType: 'enum', sortable: true },
    { key: 'priority', label: t('grid.priority'), width: 125, render: (row) => enumText('priority', row.priority), filterType: 'enum', sortable: true },
    { key: 'employeeCode', label: t('grid.employeeCode'), width: 145, render: (row) => row.employeeCode, searchable: true, defaultSearch: true, sortable: true },
    { key: 'employeeName', label: t('grid.employeeName'), width: 210, render: (row) => row.employeeName, searchable: true, defaultSearch: true, sortable: true },
    { key: 'departmentName', label: t('grid.department'), width: 165, render: (row) => row.departmentName, searchable: false, sortable: true },
    { key: 'totalLineCount', label: t('grid.lineCount'), width: 115, render: (row) => row.totalLineCount, filterType: 'number', sortable: true },
    { key: 'unresolvedLineCount', label: t('grid.unresolved'), width: 145, render: (row) => row.unresolvedLineCount > 0 ? <span className="font-semibold text-amber-600">{row.unresolvedLineCount}</span> : '0', filterType: 'number', sortable: true },
    { key: 'requestedQuantity', label: t('grid.requested'), width: 135, render: (row) => formatQuantity(row.requestedQuantity), filterType: 'number', sortable: true },
    { key: 'allocatedQuantity', label: t('grid.allocated'), width: 135, render: (row) => formatQuantity(row.allocatedQuantity), filterType: 'number', sortable: true },
    { key: 'deliveredQuantity', label: t('grid.delivered'), width: 135, render: (row) => formatQuantity(row.deliveredQuantity), filterType: 'number', sortable: true },
    { key: 'neededAtUtc', label: t('grid.neededAt'), width: 170, render: (row) => formatDateTime(row.neededAtUtc), filterType: 'datetime', sortable: true },
    { key: 'requestedAtUtc', label: t('grid.requestedAt'), width: 170, render: (row) => formatDateTime(row.requestedAtUtc), filterType: 'datetime', sortable: true },
    { key: 'createdBy', label: t('grid.createdBy'), width: 110, render: (row) => row.createdBy ?? '—', filterType: 'number', searchable: true, sortable: true },
    { key: 'createdDate', label: t('grid.createdDate'), width: 170, render: (row) => formatDateTime(row.createdDate), filterType: 'datetime', sortable: true },
    { key: 'updatedBy', label: t('grid.updatedBy'), width: 110, render: (row) => row.updatedBy ?? '—', filterType: 'number', searchable: true, sortable: true },
    { key: 'updatedDate', label: t('grid.updatedDate'), width: 170, render: (row) => formatDateTime(row.updatedDate), filterType: 'datetime', sortable: true },
    {
      key: 'actions', label: t('grid.actions'), width: 230, filterable: false, searchable: false,
      render: (row) => <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="wms-ops-list-toolbar-btn" onClick={() => setDetailId(row.id)}>{t('actions.detail')}</button>
        {can('WMS.KKD.DISTRIBUTION.OPERATE') && row.unresolvedLineCount === 0 && !CLOSED.has(row.status) ? (
          <button type="button" className="wms-ops-list-toolbar-btn" onClick={() => prepare(row)}>{t('actions.prepare')}</button>
        ) : null}
      </div>,
    },
  ], [can, enumText, formatDateTime, formatQuantity, prepare, t]);

  const createRequest = useMutation({
    mutationFn: async () => {
      const normalized = lines.filter((line) => line.groupCode.trim());
      if (!employeeId || normalized.length === 0) throw new Error(t('validation.employeeAndLine'));
      if (normalized.some((line) => line.quantity <= 0)) throw new Error(t('validation.quantity'));
      return kkdApi.createRequest({
        idempotencyKey: crypto.randomUUID(), employeeId: Number(employeeId), warehouseId: null, assignedUserId: null,
        sourceType: 'Wms', externalRequestNo: null, priority,
        neededAtUtc: neededAt ? new Date(neededAt).toISOString() : null,
        description: description.trim() || null,
        lines: normalized.map((line) => ({
          groupCode: line.groupCode, groupName: line.groupName || null, stockId: line.stockId,
          quantity: line.quantity, externalOrderNo: null, externalOrderLineId: null,
        })),
      });
    },
    onSuccess: (value) => {
      toast.success(t('messages.created', { no: value.requestNo }));
      setCreateOpen(false); resetCreate(); setRevision((value) => value + 1); setDetailId(value.id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      if (!detail.data || !resolveLine || !resolveStock) throw new Error(t('validation.stock'));
      if (resolveReason.trim().length < 3) throw new Error(t('validation.reason'));
      return kkdApi.resolveRequestLine(detail.data.id, resolveLine.id, {
        stockId: resolveStock.id, reason: resolveReason.trim(), expectedRowVersion: resolveLine.rowVersion,
      });
    },
    onSuccess: (value) => {
      queryClient.setQueryData(['kkd', 'requests', value.id], value);
      setResolveLine(null); setResolveStock(null); setResolveReason(''); setRevision((item) => item + 1);
      toast.success(t('messages.resolved'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!detail.data || cancelReason.trim().length < 3) throw new Error(t('validation.reason'));
      return kkdApi.cancelRequest(detail.data.id, cancelReason.trim(), detail.data.rowVersion);
    },
    onSuccess: (value) => {
      queryClient.setQueryData(['kkd', 'requests', value.id], value);
      setCancelReason(''); setRevision((item) => item + 1); toast.success(t('messages.cancelled'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('messages.failed')),
  });

  const resetCreate = (): void => {
    setEmployeeId(''); setPriority('Normal'); setNeededAt(''); setDescription(''); setLines([newLine()]);
  };

  return <>
    <AdvancedDataGrid<KkdRequestRow>
      refreshKey={revision}
      pageKey="kkd-open-requests"
      title={t('page.title')}
      description={t('page.description')}
      emptyMessage={t('page.empty')}
      columns={columns}
      fetchPage={kkdApi.requestsPaged}
      onRowDoubleClick={(row) => setDetailId(row.id)}
      toolbarAction={can('WMS.KKD.REQUESTS.CREATE') ? {
        label: t('actions.new'), icon: <Plus className="size-4"/>, run: async () => setCreateOpen(true),
      } : undefined}
    />

    {createOpen ? <ResponsiveDialog onClose={() => { setCreateOpen(false); resetCreate(); }} title={t('create.title')} description={t('create.description')} className="!max-w-5xl">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createRequest.mutate(); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <KkdField label={t('create.employee')}>
            <AppDropdown value={employeeId || null} onValueChange={(value) => setEmployeeId(value ?? '')} searchable
              options={(employees.data ?? []).filter((item) => item.isActive).map(employeeOption)} placeholder={t('create.employeePlaceholder')}/>
          </KkdField>
          <KkdField label={t('create.priority')}>
            <AppDropdown value={priority} onValueChange={(value) => setPriority(value as KkdRequestCreatePayload['priority'])}
              options={['Low', 'Normal', 'High', 'Urgent'].map((value) => ({ value, label: enumText('priority', value) }))}/>
          </KkdField>
          <KkdField label={t('create.neededAt')}><AppInput type="datetime-local" value={neededAt} onChange={(event) => setNeededAt(event.target.value)}/></KkdField>
          <KkdField label={t('create.description')}><AppInput value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000}/></KkdField>
        </div>

        <KkdPanel title={t('create.lines')} description={t('create.linesHelp')} icon={<ClipboardList className="size-4"/>}>
          <div className="space-y-3">
            {lines.map((line, index) => <DraftLineEditor key={line.key} line={line} index={index} canRemove={lines.length > 1}
              t={t} onChange={(next) => setLines((current) => current.map((item) => item.key === line.key ? next : item))}
              onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}/>) }
            <OpsActionButton type="button" variant="secondary" onClick={() => setLines((current) => [...current, newLine()])}>
              <Plus className="size-4"/>{t('actions.addLine')}
            </OpsActionButton>
          </div>
        </KkdPanel>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="min-h-11 rounded-xl border px-5" onClick={() => { setCreateOpen(false); resetCreate(); }}>{t('actions.close')}</button>
          <button type="submit" disabled={createRequest.isPending} className="min-h-11 rounded-xl bg-cyan-600 px-5 font-semibold text-white disabled:opacity-50">{t('actions.create')}</button>
        </div>
      </form>
    </ResponsiveDialog> : null}

    {detailId ? <ResponsiveDialog onClose={() => { setDetailId(null); setCancelReason(''); }} title={detail.data?.requestNo ?? t('detail.title')} description={t('detail.description')} className="!max-w-6xl">
      {detail.isLoading ? <p>{t('messages.loading')}</p> : detail.isError || !detail.data ? <p className="text-rose-600">{t('messages.detailFailed')}</p> : <RequestDetailView
        value={detail.data} t={t} formatDateTime={formatDateTime} formatQuantity={formatQuantity} enumText={enumText}
        canResolve={can('WMS.KKD.REQUESTS.RESOLVE')} canCancel={can('WMS.KKD.REQUESTS.CANCEL')} canPrepare={can('WMS.KKD.DISTRIBUTION.OPERATE')}
        cancelReason={cancelReason} setCancelReason={setCancelReason} cancelling={cancel.isPending}
        onResolve={(line) => { setResolveLine(line); setResolveStock(null); setResolveReason(''); }}
        onCancel={() => cancel.mutate()} onPrepare={() => prepare(detail.data!)}/>} 
    </ResponsiveDialog> : null}

    {resolveLine && detail.data ? <ResponsiveDialog onClose={() => setResolveLine(null)} title={t('resolve.title')} description={t('resolve.description', { group: resolveLine.groupCode })} className="!max-w-xl">
      <div className="space-y-4">
        <KkdField label={t('resolve.stock')} hint={t('resolve.stockHelp')}>
          <PagedAppDropdown<KkdStockLookup> queryKey={['kkd-request-stock', resolveLine.groupCode]}
            fetchPage={(request) => kkdApi.stocksPaged(request, resolveLine.groupCode)}
            toOption={(stock) => ({ value: encodeStock(stock), label: `${stock.code} · ${stock.name}`, description: stock.unitCode })}
            value={resolveStock ? encodeURIComponent(JSON.stringify(resolveStock)) : null}
            selectedOption={resolveStock ? { value: encodeURIComponent(JSON.stringify(resolveStock)), label: resolveStock.label } : undefined}
            onValueChange={(value) => setResolveStock(value ? decodeStock(value) : null)}
            searchable minSearchLength={1} placeholder={t('resolve.stockPlaceholder')}/>
        </KkdField>
        <KkdField label={t('resolve.reason')}><AppInput value={resolveReason} onChange={(event) => setResolveReason(event.target.value)} maxLength={1000}/></KkdField>
        <div className="flex justify-end gap-2"><button type="button" className="min-h-11 rounded-xl border px-5" onClick={() => setResolveLine(null)}>{t('actions.close')}</button>
          <button type="button" disabled={resolve.isPending} className="min-h-11 rounded-xl bg-cyan-600 px-5 font-semibold text-white disabled:opacity-50" onClick={() => resolve.mutate()}>{t('actions.save')}</button></div>
      </div>
    </ResponsiveDialog> : null}
  </>;
}

function DraftLineEditor({ line, index, canRemove, t, onChange, onRemove }: {
  line: DraftLine; index: number; canRemove: boolean; t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (line: DraftLine) => void; onRemove: () => void;
}): ReactElement {
  return <article className="rounded-xl border border-[var(--wms-ops-card-border)] p-3">
    <div className="mb-3 flex items-center justify-between"><strong>{t('create.lineNo', { no: index + 1 })}</strong>
      {canRemove ? <button type="button" className="text-rose-600" onClick={onRemove} aria-label={t('actions.removeLine')}><Trash2 className="size-4"/></button> : null}</div>
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
      <KkdField label={t('create.group')}>
        <PagedAppDropdown queryKey={['kkd-request-groups', line.key]} fetchPage={kkdApi.entitlementGroupsPaged}
          toOption={(item) => ({ value: encodeURIComponent(JSON.stringify({ code: item.code, name: item.name })), label: `${item.code} · ${item.name}` })}
          value={line.groupCode ? encodeURIComponent(JSON.stringify({ code: line.groupCode, name: line.groupName })) : null}
          selectedOption={line.groupCode ? { value: encodeURIComponent(JSON.stringify({ code: line.groupCode, name: line.groupName })), label: `${line.groupCode} · ${line.groupName}` } : undefined}
          onValueChange={(value) => { const item = value ? JSON.parse(decodeURIComponent(value)) as { code: string; name: string } : { code: '', name: '' }; onChange({ ...line, groupCode: item.code, groupName: item.name, stockId: null, stockLabel: '' }); }}
          searchable minSearchLength={1} placeholder={t('create.groupPlaceholder')}/>
      </KkdField>
      <KkdField label={t('create.stock')} hint={t('create.stockOptional')}>
        <PagedAppDropdown<KkdStockLookup> queryKey={['kkd-request-line-stock', line.key, line.groupCode]}
          fetchPage={(request) => kkdApi.stocksPaged(request, line.groupCode)} enabled={Boolean(line.groupCode)}
          toOption={(item) => ({ value: encodeStock(item), label: `${item.code} · ${item.name}`, description: item.unitCode })}
          value={line.stockId ? encodeURIComponent(JSON.stringify({ id: line.stockId, label: line.stockLabel })) : null}
          selectedOption={line.stockId ? { value: encodeURIComponent(JSON.stringify({ id: line.stockId, label: line.stockLabel })), label: line.stockLabel } : undefined}
          onValueChange={(value) => { const stock = value ? decodeStock(value) : null; onChange({ ...line, stockId: stock?.id ?? null, stockLabel: stock?.label ?? '' }); }}
          searchable minSearchLength={1} placeholder={line.groupCode ? t('create.stockPlaceholder') : t('create.selectGroupFirst')}/>
      </KkdField>
      <KkdField label={t('create.quantity')}><AppInput type="number" min="0.000001" step="any" value={line.quantity} onChange={(event) => onChange({ ...line, quantity: Number(event.target.value) })}/></KkdField>
    </div>
  </article>;
}

function RequestDetailView({ value, t, formatDateTime, formatQuantity, enumText, canResolve, canCancel, canPrepare,
  cancelReason, setCancelReason, cancelling, onResolve, onCancel, onPrepare }: {
  value: KkdRequestDetail; t: (key: string, options?: Record<string, unknown>) => string;
  formatDateTime: (value?: string | null) => string; formatQuantity: (value: number) => string;
  enumText: (scope: string, value: string) => string; canResolve: boolean; canCancel: boolean; canPrepare: boolean;
  cancelReason: string; setCancelReason: (value: string) => void; cancelling: boolean;
  onResolve: (line: KkdRequestLine) => void; onCancel: () => void; onPrepare: () => void;
}): ReactElement {
  const unresolved = value.lines.some((line) => !line.stockId && line.status !== 'Cancelled');
  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Info label={t('detail.person')} value={`${value.employeeCode} · ${value.employeeName}`}/>
      <Info label={t('detail.departmentRole')} value={`${value.departmentName} · ${value.roleName}`}/>
      <Info label={t('grid.status')} value={enumText('status', value.status)}/>
      <Info label={t('grid.priority')} value={enumText('priority', value.priority)}/>
      <Info label={t('grid.requestedAt')} value={formatDateTime(value.requestedAtUtc)}/>
      <Info label={t('grid.neededAt')} value={formatDateTime(value.neededAtUtc)}/>
      <Info label={t('detail.warehouse')} value={value.warehouseId?.toString() ?? '—'}/>
      <Info label={t('detail.assignedUser')} value={value.assignedUserId?.toString() ?? '—'}/>
    </div>
    <div className="space-y-2">
      {value.lines.map((line) => <article key={line.id} className={cn('rounded-xl border p-3', !line.stockId && 'border-amber-500/50 bg-amber-500/5')}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><strong>#{line.lineNo} · {line.groupCode}{line.groupName ? ` · ${line.groupName}` : ''}</strong>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">{line.stockId ? `${line.stockCode} · ${line.stockName}` : t('detail.stockAwaiting')}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Status value={line.status} text={enumText('lineStatus', line.status)}/>
            {canResolve && !line.stockId && line.allocatedQuantity === 0 && line.deliveredQuantity === 0 ? <button type="button" className="wms-ops-list-toolbar-btn" onClick={() => onResolve(line)}><SearchCheck className="size-4"/>{t('actions.selectStock')}</button> : null}</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Info label={t('grid.requested')} value={formatQuantity(line.requestedQuantity)}/>
          <Info label={t('grid.allocated')} value={formatQuantity(line.allocatedQuantity)}/>
          <Info label={t('grid.delivered')} value={formatQuantity(line.deliveredQuantity)}/>
          <Info label={t('detail.remaining')} value={formatQuantity(line.remainingQuantity)}/>
        </div>
      </article>)}
    </div>
    <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-end lg:justify-between">
      {canCancel && !CLOSED.has(value.status) ? <KkdField label={t('detail.cancelReason')} className="w-full lg:max-w-xl"><AppInput value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={t('detail.cancelReasonPlaceholder')}/></KkdField> : <span/>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {canCancel && !CLOSED.has(value.status) ? <button type="button" disabled={cancelling} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-500 px-4 text-rose-600 disabled:opacity-50" onClick={onCancel}><X className="size-4"/>{t('actions.cancel')}</button> : null}
        {canPrepare && !unresolved && !CLOSED.has(value.status) ? <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 font-semibold text-white" onClick={onPrepare}><PackageCheck className="size-4"/>{t('actions.prepare')}</button> : null}
      </div>
    </div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }): ReactElement {
  return <div className="rounded-lg border border-[var(--wms-ops-card-border)] p-2.5"><span className="block text-[0.68rem] uppercase tracking-wide text-[var(--wms-app-text-muted)]">{label}</span><strong className="mt-1 block break-words text-sm">{value}</strong></div>;
}

function Status({ value, text }: { value: string; text: string }): ReactElement {
  const tone = value === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : value === 'Cancelled' ? 'bg-rose-500/10 text-rose-600' : value.includes('Awaiting') ? 'bg-amber-500/10 text-amber-600' : 'bg-cyan-500/10 text-cyan-600';
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>{text}</span>;
}

function employeeOption(item: KkdEmployee) {
  return { value: String(item.id), label: `${item.employeeCode} · ${item.fullName}`, description: `${item.departmentName} · ${item.roleName}` };
}

function encodeStock(stock: KkdStockLookup): string {
  return encodeURIComponent(JSON.stringify({ id: stock.id, label: `${stock.code} · ${stock.name}` }));
}

function decodeStock(value: string): { id: number; label: string } {
  return JSON.parse(decodeURIComponent(value)) as { id: number; label: string };
}
