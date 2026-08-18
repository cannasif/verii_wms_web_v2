import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { getErpMirrorPage, syncErpMirror } from '../api/erp-mirror.api';

export interface MirrorColumn<T> { key: string; label: string; render: (row: T) => ReactNode }
interface Props<T extends { id: number }> { title: string; description: string; resource: string; syncResource: string; columns: MirrorColumn<T>[] }

export function ErpMirrorDataTable<T extends { id: number }>({ title, description, resource, syncResource, columns }: Props<T>) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState(''); const [syncing, setSyncing] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchInput); setPage(1); }, 350); return () => window.clearTimeout(timer); }, [searchInput]);
  const queryKey = useMemo(() => ['erp-mirror', resource, page, pageSize, search], [resource, page, pageSize, search]);
  const query = useQuery({ queryKey, queryFn: () => getErpMirrorPage<T>(resource, {
    page,
    pageSize,
    search: search || null,
    searchFields: search ? columns.map((column) => column.key) : undefined,
  }) });
  const total = query.data?.totalCount ?? 0; const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1; const last = Math.min(page * pageSize, total);
  const sync = async () => { setSyncing(true); try { await syncErpMirror(syncResource); await queryClient.invalidateQueries({ queryKey: ['erp-mirror', resource] }); } finally { setSyncing(false); } };

  return <section className="min-h-[calc(100vh-8rem)] rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--wms-brand-primary)]">ERP / Eşlenmiş Veriler</p><h1 className="mt-1 text-2xl font-bold">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Kod veya ada göre ara" className="h-10 w-full rounded-xl border border-[var(--wms-app-border)] bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--wms-brand-ring)] sm:w-72"/></label>
        <button type="button" onClick={sync} disabled={syncing || query.isFetching} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`}/>Şimdi Eşle</button>
      </div>
    </div>
    <div className="overflow-hidden rounded-xl border border-[var(--wms-app-border)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-sm"><thead className="bg-slate-100/90 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"><tr>{columns.map(c => <th key={c.key} className="border-b border-r border-[var(--wms-app-border)] px-4 py-3 font-semibold last:border-r-0">{c.label}</th>)}</tr></thead>
      <tbody>{query.isLoading ? <tr><td colSpan={columns.length} className="h-40 text-center text-slate-500">Veriler yükleniyor...</td></tr> : query.isError ? <tr><td colSpan={columns.length} className="h-40 text-center text-red-500">{query.error instanceof Error ? query.error.message : 'Veriler alınamadı.'}</td></tr> : (query.data?.items.length ?? 0) === 0 ? <tr><td colSpan={columns.length} className="h-40 text-center text-slate-500">Kayıt bulunamadı.</td></tr> : query.data?.items.map(row => <tr key={row.id} className="border-b border-[var(--wms-app-border)] transition-colors last:border-b-0 hover:bg-[var(--wms-brand-soft)]">{columns.map(c => <td key={c.key} className="border-r border-[var(--wms-app-border)] px-4 py-3 last:border-r-0">{c.render(row)}</td>)}</tr>)}</tbody></table></div>
    </div>
    <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-slate-500"><span>{first}-{last} / {total} kayıt</span><AppDropdown value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={[10,25,50,100].map((size) => ({ value: String(size), label: String(size) }))} ariaLabel="Sayfa başına kayıt" className="h-9 w-20" /></div><div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-[var(--wms-app-border)] p-2 disabled:opacity-40"><ChevronLeft className="size-4"/></button><span className="min-w-24 text-center">Sayfa {page} / {totalPages}</span><button type="button" disabled={page >= totalPages || query.isFetching} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-[var(--wms-app-border)] p-2 disabled:opacity-40"><ChevronRight className="size-4"/></button></div></div>
  </section>;
}
