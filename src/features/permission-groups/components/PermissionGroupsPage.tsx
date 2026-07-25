import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, Users2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { permissionGroupsApi } from '../api/permission-groups.api';
import type { PermissionGroupDetail, PermissionGroupRow, PermissionRow } from '../types/permission-groups.types';

type Mode = 'create' | 'view' | 'edit';

export function PermissionGroupsPage() {
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
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Yetki grubu bilgileri alınamadı.'); setMode(null); }
    finally { setLoading(false); }
  };

  const save = async () => {
    const normalizedName = name.trim();
    if (normalizedName.length < 2) { toast.error('Grup adı en az 2 karakter olmalıdır.'); return; }
    if (!mode || mode === 'view') return;
    setSaving(true);
    try {
      const payload = { name: normalizedName, description: description.trim() || undefined, isSystemAdmin: false, isActive, permissionIds: selected };
      if (mode === 'edit' && detail) await permissionGroupsApi.update(detail.id, payload); else await permissionGroupsApi.create(payload);
      toast.success(mode === 'edit' ? 'Yetki grubu güncellendi.' : 'Yetki grubu oluşturuldu.'); close();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'permission-groups'] }), queryClient.invalidateQueries({ queryKey: ['system-group-stats'] })]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Yetki grubu kaydedilemedi.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget || deleteTarget.isSystemAdmin) return;
    setSaving(true);
    try { await permissionGroupsApi.delete(deleteTarget.id); toast.success('Yetki grubu silindi.'); setDeleteTarget(null); await Promise.all([queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'permission-groups'] }), queryClient.invalidateQueries({ queryKey: ['system-group-stats'] })]); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Yetki grubu silinemedi.'); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<PermissionGroupRow>[]>(() => [
    ...systemColumns<PermissionGroupRow>(),
    { key: 'name', label: 'Ad', render: (row) => <div><strong className="block">{row.name}</strong>{row.description && <small className="text-slate-500">{row.description}</small>}</div> },
    { key: 'isSystemAdmin', label: 'Sistem Yöneticisi', render: (row) => row.isSystemAdmin ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"><ShieldCheck className="size-3.5"/>Evet</span> : <span className="text-slate-500">Hayır</span> },
    { key: 'isActive', label: 'Aktif', render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.isActive ? 'Aktif' : 'Pasif'}</span> },
    { key: 'permissionCount', label: 'İzinler', render: (row) => <span className="inline-flex min-w-8 justify-center rounded-full bg-[var(--wms-brand-soft)] px-2 py-1 text-xs font-semibold">{row.permissionCount}</span> },
    { key: 'actions', label: 'İşlemler', sortable: false, filterable: false, render: (row) => <div className="flex items-center gap-1"><button type="button" aria-label={`${row.name} görüntüle`} title="Görüntüle" onClick={() => open(row, 'view')} className="rounded-lg border p-2 text-cyan-600 hover:bg-cyan-50"><Eye className="size-4"/></button><button type="button" aria-label={`${row.name} düzenle`} title="Düzenle" disabled={row.isSystemAdmin} onClick={() => open(row, 'edit')} className="rounded-lg border p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-35"><Pencil className="size-4"/></button><button type="button" aria-label={`${row.name} sil`} title="Sil" disabled={row.isSystemAdmin} onClick={() => setDeleteTarget(row)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="size-4"/></button></div> },
  ], []);

  const visiblePermissions = useMemo(() => {
    const search = permissionSearch.trim().toLocaleLowerCase('tr-TR');
    return search ? permissions.filter((permission) => `${permission.code} ${permission.name} ${permission.description || ''}`.toLocaleLowerCase('tr-TR').includes(search)) : permissions;
  }, [permissionSearch, permissions]);
  const readOnly = mode === 'view';
  const modalTitle = mode === 'create' ? 'Yeni Yetki Grubu' : mode === 'edit' ? 'Yetki Grubunu Düzenle' : 'Yetki Grubu Detayı';

  return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-3">
      <StatCard label="İzin Grupları" value={stats.data?.total ?? 0} icon={Users2}/>
      <StatCard label="Aktif Gruplar" value={stats.data?.active ?? 0} icon={ShieldCheck} tone="emerald"/>
      <StatCard label="Sistem Yöneticisi" value={stats.data?.systemAdmin ?? 0} icon={KeyRound} tone="amber"/>
    </section>
    <AdvancedDataGrid pageKey="permission-groups" title="İzin Grupları" description="İzin gruplarını ve izin atamalarını CRM seviyesinde yönetin." columns={columns} fetchPage={permissionGroupsApi.getPaged} toolbarAction={{ label: 'Grup Ekle', run: () => open(null, 'create') }}/>

    {mode && <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent showCloseButton={false} className="max-h-[calc(100%-2rem)] w-full !max-w-4xl overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-0 shadow-2xl"><div className="flex items-start justify-between border-b border-[var(--wms-app-border)] px-6 py-4"><div><DialogTitle className="text-xl font-bold">{modalTitle}</DialogTitle><p className="mt-1 text-sm text-slate-500">Grup bilgilerini ve izin kataloğunu birlikte yönetin.</p></div><button type="button" aria-label="Kapat" onClick={close} className="rounded-lg border p-2"><X className="size-4"/></button></div>
      {loading ? <div className="grid h-80 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]"/></div> : <div className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="font-medium">Grup adı *</span><input disabled={readOnly} value={name} maxLength={150} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60"/></label><label className="flex items-center justify-between rounded-xl border p-3"><span><strong className="block text-sm">Aktif grup</strong><small className="text-slate-500">Atamalarda kullanılabilsin.</small></span><input type="checkbox" disabled={readOnly} checked={isActive} onChange={(event) => setIsActive(event.target.checked)}/></label><label className="space-y-1.5 text-sm sm:col-span-2"><span className="font-medium">Açıklama</span><textarea disabled={readOnly} value={description} maxLength={500} rows={3} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border bg-transparent px-3 py-2 disabled:opacity-60"/></label></div>
      {detail?.isSystemAdmin && <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"><ShieldCheck className="size-4"/>System Administrator grubu korunur; düzenlenemez ve silinemez.</div>}
      <div className="rounded-2xl border border-[var(--wms-app-border)]"><div className="flex flex-col gap-3 border-b border-[var(--wms-app-border)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm">Grup İzinleri</strong><p className="text-xs text-slate-500">{selected.length} izin seçili • {visiblePermissions.length} sonuç</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="İzin ara..." className="h-9 w-56 rounded-xl border bg-transparent pl-9 pr-3 text-sm"/></label>{!readOnly && <><button type="button" onClick={() => setSelected((current) => [...new Set([...current, ...visiblePermissions.map((item) => item.id)])])} className="rounded-xl border px-3 py-2 text-xs">Görünenleri Seç</button><button type="button" onClick={() => setSelected([])} className="rounded-xl border px-3 py-2 text-xs">Temizle</button></>}</div></div><div className="grid max-h-80 gap-2 overflow-auto p-4 sm:grid-cols-2">{visiblePermissions.map((permission) => <label key={permission.id} className={`flex items-start gap-3 rounded-xl border p-3 ${readOnly ? '' : 'cursor-pointer hover:bg-[var(--wms-brand-soft)]'}`}><input type="checkbox" disabled={readOnly} checked={selected.includes(permission.id)} onChange={() => setSelected((current) => current.includes(permission.id) ? current.filter((id) => id !== permission.id) : [...current, permission.id])}/><span><strong className="block text-xs">{permission.code}</strong><small className="text-slate-500">{permission.name}</small></span></label>)}</div></div>
      <div className="flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-5"><button type="button" onClick={close} className="rounded-xl border px-4 py-2">{readOnly ? 'Kapat' : 'Vazgeç'}</button>{!readOnly && <button type="button" disabled={saving || name.trim().length < 2} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin"/> : <Plus className="size-4"/>}Kaydet</button>}</div></div>}</DialogContent></Dialog>}

    {deleteTarget && <Dialog open onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}><DialogContent showCloseButton={false} className="w-full !max-w-md rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl"><div className="grid size-11 place-items-center rounded-full bg-red-100 text-red-600"><Trash2 className="size-5"/></div><DialogTitle className="mt-4 text-xl font-bold">Yetki grubunu sil</DialogTitle><p className="mt-2 text-sm text-slate-500"><strong>{deleteTarget.name}</strong> grubu ve aktif atamaları pasife alınacak. Audit geçmişi korunacaktır.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2">Vazgeç</button><button type="button" disabled={saving} onClick={remove} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin"/>}Sil</button></div></DialogContent></Dialog>}
  </div>;
}

function StatCard({ label, value, icon: Icon, tone = 'brand' }: { label: string; value: number; icon: typeof Users2; tone?: 'brand' | 'emerald' | 'amber' }) {
  const colors = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]';
  return <div className="flex items-center gap-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm"><div className={`grid size-11 place-items-center rounded-xl ${colors}`}><Icon className="size-5"/></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div></div>;
}
