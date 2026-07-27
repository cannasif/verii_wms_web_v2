import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Eye, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, Users2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { permissionGroupsApi } from '../api/permission-groups.api';
import type { PermissionGroupDetail, PermissionGroupRow, PermissionRow } from '../types/permission-groups.types';

type Mode = 'create' | 'view' | 'edit';
const P = 'permissionGroups.page';

export function PermissionGroupsPage() {
  const { t, i18n } = useTranslation('common');
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ['system-group-stats'], queryFn: permissionGroupsApi.getStats });
  const [mode, setMode] = useState<Mode | null>(null);
  const [detail, setDetail] = useState<PermissionGroupDetail | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PermissionGroupRow | null>(null);

  const close = () => { if (!saving) { setMode(null); setDetail(null); setPermissionSearch(''); } };

  const open = async (group: PermissionGroupRow | null, nextMode: Mode) => {
    if (group?.isSystemAdmin && nextMode === 'edit') return;
    setMode(nextMode); setLoading(true); setPermissionSearch('');
    try {
      const permissionPromise = permissionGroupsApi.getActivePermissions();
      if (group) {
        const [permissionPage, groupDetail] = await Promise.all([permissionPromise, permissionGroupsApi.getById(group.id)]);
        setPermissions(permissionPage.items); setDetail(groupDetail); setName(groupDetail.name); setDescription(groupDetail.description || ''); setSelected(groupDetail.permissionIds); setIsActive(groupDetail.isActive);
      } else {
        const permissionPage = await permissionPromise;
        setPermissions(permissionPage.items); setDetail(null); setName(''); setDescription(''); setSelected([]); setIsActive(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${P}.loadFailed`));
      setMode(null);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const normalizedName = name.trim();
    if (normalizedName.length < 2) { toast.error(t(`${P}.nameMinLength`)); return; }
    if (!mode || mode === 'view') return;
    setSaving(true);
    try {
      const payload = { name: normalizedName, description: description.trim() || undefined, isSystemAdmin: false, isActive, permissionIds: selected };
      if (mode === 'edit' && detail) await permissionGroupsApi.update(detail.id, payload);
      else await permissionGroupsApi.create(payload);
      toast.success(mode === 'edit' ? t(`${P}.saveSuccessUpdate`) : t(`${P}.saveSuccessCreate`));
      close();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'permission-groups'] }), queryClient.invalidateQueries({ queryKey: ['system-group-stats'] })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${P}.saveFailed`));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || deleteTarget.isSystemAdmin) return;
    setSaving(true);
    try {
      await permissionGroupsApi.delete(deleteTarget.id);
      toast.success(t(`${P}.deleteSuccess`));
      setDeleteTarget(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'permission-groups'] }), queryClient.invalidateQueries({ queryKey: ['system-group-stats'] })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${P}.deleteFailed`));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<GridColumn<PermissionGroupRow>[]>(() => [
    ...systemColumns<PermissionGroupRow>(),
    { key: 'name', label: t(`${P}.columns.name`), render: row => <div><strong className="block">{row.name}</strong>{row.description && <small className="text-slate-500">{row.description}</small>}</div> },
    {
      key: 'isSystemAdmin', label: t(`${P}.columns.isSystemAdmin`),
      render: row => row.isSystemAdmin
        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><ShieldCheck className="size-3.5" />{t(`${P}.yes`)}</span>
        : <span className="text-slate-500">{t(`${P}.no`)}</span>,
    },
    {
      key: 'isActive', label: t(`${P}.columns.isActive`),
      render: row => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.isActive ? t(`${P}.active`) : t(`${P}.inactive`)}</span>,
    },
    { key: 'permissionCount', label: t(`${P}.columns.permissionCount`), render: row => <span className="inline-flex min-w-8 justify-center rounded-full bg-[var(--wms-brand-soft)] px-2 py-1 text-xs font-semibold">{row.permissionCount}</span> },
    {
      key: 'actions', label: t(`${P}.columns.actions`), sortable: false, filterable: false,
      render: row => (
        <div className="flex items-center gap-1">
          <button type="button" title={t(`${P}.view`)} onClick={() => void open(row, 'view')} className="rounded-lg border p-2 text-cyan-600 hover:bg-cyan-50"><Eye className="size-4" /></button>
          <button type="button" title={t(`${P}.edit`)} disabled={row.isSystemAdmin} onClick={() => void open(row, 'edit')} className="rounded-lg border p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="size-4" /></button>
          <button type="button" title={t(`${P}.delete`)} disabled={row.isSystemAdmin} onClick={() => setDeleteTarget(row)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="size-4" /></button>
        </div>
      ),
    },
  ], [t, gridLanguage]);

  const visiblePermissions = useMemo(() => {
    const search = permissionSearch.trim().toLocaleLowerCase('tr-TR');
    return search ? permissions.filter(permission => `${permission.code} ${permission.name} ${permission.description || ''}`.toLocaleLowerCase('tr-TR').includes(search)) : permissions;
  }, [permissionSearch, permissions]);

  const readOnly = mode === 'view';
  const modalTitle = mode === 'create' ? t(`${P}.modal.createTitle`) : mode === 'edit' ? t(`${P}.modal.editTitle`) : t(`${P}.modal.viewTitle`);

  return (
    <div className="space-y-4" data-no-auto-localize="true">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t(`${P}.stats.total`)} value={stats.data?.total ?? 0} icon={Users2} />
        <StatCard label={t(`${P}.stats.active`)} value={stats.data?.active ?? 0} icon={ShieldCheck} tone="emerald" />
        <StatCard label={t(`${P}.stats.systemAdmin`)} value={stats.data?.systemAdmin ?? 0} icon={KeyRound} tone="amber" />
      </section>
      <AdvancedDataGrid
        pageKey="permission-groups"
        title={t(`${P}.title`)}
        description={t(`${P}.description`)}
        columns={columns}
        fetchPage={permissionGroupsApi.getPaged}
        toolbarAction={{ label: t(`${P}.addGroup`), run: () => open(null, 'create') }}
      />

      {mode && (
        <Dialog open onOpenChange={openState => { if (!openState) close(); }}>
          <DialogContent showCloseButton={false} className="max-h-[calc(100%-2rem)] w-full !max-w-4xl overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-0 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--wms-app-border)] px-6 py-4">
              <div>
                <DialogTitle className="text-xl font-bold">{modalTitle}</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">{t(`${P}.modal.subtitle`)}</p>
              </div>
              <button type="button" aria-label={t(`${P}.modal.close`)} onClick={close} className="rounded-lg border p-2"><X className="size-4" /></button>
            </div>
            {loading ? (
              <div className="grid h-80 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>
            ) : (
              <div className="space-y-5 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm"><span className="font-medium">{t(`${P}.modal.groupName`)}</span><input disabled={readOnly} value={name} maxLength={150} onChange={e => setName(e.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /></label>
                  <label className="flex items-center justify-between rounded-xl border p-3"><span><strong className="block text-sm">{t(`${P}.modal.activeGroup`)}</strong><small className="text-slate-500">{t(`${P}.modal.activeGroupHint`)}</small></span><input type="checkbox" disabled={readOnly} checked={isActive} onChange={e => setIsActive(e.target.checked)} /></label>
                  <label className="space-y-1.5 text-sm sm:col-span-2"><span className="font-medium">{t(`${P}.modal.description`)}</span><textarea disabled={readOnly} value={description} maxLength={500} rows={3} onChange={e => setDescription(e.target.value)} className="w-full rounded-xl border bg-transparent px-3 py-2 disabled:opacity-60" /></label>
                </div>
                {detail?.isSystemAdmin && <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"><ShieldCheck className="size-4" />{t(`${P}.modal.systemAdminNotice`)}</div>}
                <div className="rounded-2xl border border-[var(--wms-app-border)]">
                  <div className="flex flex-col gap-3 border-b border-[var(--wms-app-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><strong className="text-sm">{t(`${P}.modal.permissionsTitle`)}</strong><p className="text-xs text-slate-500">{t(`${P}.modal.selectedSummary`, { selected: selected.length, visible: visiblePermissions.length })}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={permissionSearch} onChange={e => setPermissionSearch(e.target.value)} placeholder={t(`${P}.modal.searchPlaceholder`)} className="h-9 w-56 rounded-xl border bg-transparent pl-9 pr-3 text-sm" /></label>
                      {!readOnly && <>
                        <button type="button" onClick={() => setSelected(current => [...new Set([...current, ...visiblePermissions.map(item => item.id)])])} className="rounded-xl border px-3 py-2 text-xs">{t(`${P}.modal.selectVisible`)}</button>
                        <button type="button" onClick={() => setSelected([])} className="rounded-xl border px-3 py-2 text-xs">{t(`${P}.modal.clear`)}</button>
                      </>}
                    </div>
                  </div>
                  <div className="grid max-h-80 gap-2 overflow-auto p-4 sm:grid-cols-2">
                    {visiblePermissions.map(permission => (
                      <label key={permission.id} className={`flex items-start gap-3 rounded-xl border p-3 ${readOnly ? '' : 'cursor-pointer hover:bg-[var(--wms-brand-soft)]'}`}>
                        <input type="checkbox" disabled={readOnly} checked={selected.includes(permission.id)} onChange={() => setSelected(current => current.includes(permission.id) ? current.filter(id => id !== permission.id) : [...current, permission.id])} />
                        <span><strong className="block text-xs">{permission.code}</strong><small className="text-slate-500">{permission.name}</small></span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-5">
                  <button type="button" onClick={close} className="rounded-xl border px-4 py-2">{readOnly ? t(`${P}.modal.close`) : t(`${P}.modal.cancel`)}</button>
                  {!readOnly && <button type="button" disabled={saving || name.trim().length < 2} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{t(`${P}.modal.save`)}</button>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open onOpenChange={openState => { if (!openState && !saving) setDeleteTarget(null); }}>
          <DialogContent showCloseButton={false} className="w-full !max-w-md rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl">
            <div className="grid size-11 place-items-center rounded-full bg-red-100 text-red-600"><Trash2 className="size-5" /></div>
            <DialogTitle className="mt-4 text-xl font-bold">{t(`${P}.deleteDialog.title`)}</DialogTitle>
            <p className="mt-2 text-sm text-slate-500">{t(`${P}.deleteDialog.body`, { name: deleteTarget.name })}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2">{t(`${P}.deleteDialog.cancel`)}</button>
              <button type="button" disabled={saving} onClick={() => void remove()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />}{t(`${P}.deleteDialog.confirm`)}</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'brand' }: { label: string; value: number; icon: typeof Users2; tone?: 'brand' | 'emerald' | 'amber' }) {
  const colors = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]';
  return <div className="flex items-center gap-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm"><div className={`grid size-11 place-items-center rounded-xl ${colors}`}><Icon className="size-5" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div></div>;
}
