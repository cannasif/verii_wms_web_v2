import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, Pencil, Phone, Shield, Trash2, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectDateTime } from '@/lib/project-format';
import { userManagementApi } from '../api/user-management.api';
import type { PermissionGroupOption, UpdateUserPayload, UserRow } from '../types/user-management.types';

type FormMode = 'create' | 'edit';
interface UserFormState {
  id?: number; username: string; email: string; firstName: string; lastName: string; phoneNumber: string;
  role: UpdateUserPayload['role']; password: string; confirmPassword: string; isActive: boolean; permissionGroupIds: number[];
}

const emptyForm: UserFormState = { username: '', email: '', firstName: '', lastName: '', phoneNumber: '', role: 'User', password: '', confirmPassword: '', isActive: true, permissionGroupIds: [] };

function validateForm(form: UserFormState, mode: FormMode): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(form.username.trim())) errors.username = '3-100 karakter; harf, rakam, nokta, tire veya alt çizgi kullanın.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Geçerli bir e-posta adresi girin.';
  if ((mode === 'create' || form.password.length > 0) && (form.password.length < 15 || form.password.length > 128)) errors.password = 'Şifre 15-128 karakter olmalıdır.';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Şifreler eşleşmiyor.';
  if (form.firstName.length > 100) errors.firstName = 'Ad en fazla 100 karakter olabilir.';
  if (form.lastName.length > 100) errors.lastName = 'Soyad en fazla 100 karakter olabilir.';
  if (form.phoneNumber.length > 40) errors.phoneNumber = 'Telefon en fazla 40 karakter olabilir.';
  return errors;
}

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [groups, setGroups] = useState<PermissionGroupOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  const loadGroups = useCallback(async () => {
    const activeGroups = await userManagementApi.getActiveGroups();
    setGroups(activeGroups);
    return activeGroups;
  }, []);

  const openCreate = useCallback(async () => {
    setMode('create'); setForm(emptyForm); setErrors({}); setShowPassword(false); setLoadingForm(true);
    try { await loadGroups(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Yetki grupları alınamadı.'); setMode(null); }
    finally { setLoadingForm(false); }
  }, [loadGroups]);

  const openEdit = useCallback(async (row: UserRow) => {
    setMode('edit'); setForm({ ...emptyForm, id: row.id, username: row.username, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role as UpdateUserPayload['role'], isActive: row.isActive });
    setErrors({}); setShowPassword(false); setLoadingForm(true);
    try {
      const [detail] = await Promise.all([userManagementApi.getById(row.id), loadGroups()]);
      setForm({ id: detail.id, username: detail.username, email: detail.email, firstName: detail.firstName || '', lastName: detail.lastName || '', phoneNumber: detail.phoneNumber || '', role: detail.role as UpdateUserPayload['role'], password: '', confirmPassword: '', isActive: detail.isActive, permissionGroupIds: detail.permissionGroupIds });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Kullanıcı bilgileri alınamadı.'); setMode(null); }
    finally { setLoadingForm(false); }
  }, [loadGroups]);

  const closeForm = () => { if (!saving) { setMode(null); setErrors({}); } };
  const updateForm = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const nextErrors = validateForm(form, mode); setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const shared = { username: form.username.trim(), email: form.email.trim(), firstName: form.firstName.trim() || undefined, lastName: form.lastName.trim() || undefined, phoneNumber: form.phoneNumber.trim() || undefined, role: form.role, isActive: form.isActive, permissionGroupIds: form.permissionGroupIds };
      if (mode === 'create') {
        if (form.role === 'superadmin') throw new Error('Form üzerinden superadmin oluşturulamaz.');
        await userManagementApi.create({ ...shared, password: form.password, role: form.role });
        toast.success('Kullanıcı başarıyla oluşturuldu.');
      } else if (form.id) {
        await userManagementApi.update(form.id, { ...shared, password: form.password || undefined });
        toast.success('Kullanıcı bilgileri ve yetkileri güncellendi.');
      }
      setMode(null); setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'system-users'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Kullanıcı kaydedilemedi.'); }
    finally { setSaving(false); }
  };

  const deactivate = async () => {
    if (!deactivateTarget) return;
    setSaving(true);
    try { await userManagementApi.deactivate(deactivateTarget.id); toast.success('Kullanıcı pasife alındı.'); setDeactivateTarget(null); await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'system-users'] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Kullanıcı pasife alınamadı.'); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<UserRow>[]>(() => [
    ...systemColumns<UserRow>(),
    { key: 'username', label: 'Kullanıcı Adı', render: (row) => <span className="font-semibold">{row.username}</span> },
    { key: 'firstName', label: 'Ad', render: (row) => row.firstName || '-' },
    { key: 'lastName', label: 'Soyad', render: (row) => row.lastName || '-' },
    { key: 'email', label: 'E-posta', render: (row) => row.email },
    { key: 'role', label: 'Rol', render: (row) => <span className="rounded-full bg-[var(--wms-brand-soft)] px-2.5 py-1 text-xs font-semibold">{localizeEnumValue(row.role)}</span> },
    { key: 'isActive', label: 'Durum', render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.isActive ? 'Aktif' : 'Pasif'}</span> },
    { key: 'lastLoginAt', label: 'Son Giriş', render: (row) => formatProjectDateTime(row.lastLoginAt) },
    { key: 'actions', label: 'İşlemler', sortable: false, filterable: false, render: (row) => <div className="flex items-center gap-1"><button type="button" aria-label={`${row.username} düzenle`} title="Düzenle" onClick={() => openEdit(row)} className="rounded-lg border p-2 text-blue-600 hover:bg-blue-50"><Pencil className="size-4"/></button><button type="button" aria-label={`${row.username} pasife al`} title="Pasife al" disabled={!row.isActive || row.role.toLowerCase() === 'superadmin'} onClick={() => setDeactivateTarget(row)} className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="size-4"/></button></div> },
  ], [openEdit]);

  const isPrimaryAdministrator = form.role.toLowerCase() === 'superadmin';
  return <>
    <AdvancedDataGrid pageKey="system-users" title="Kullanıcı Yönetimi" description="Kullanıcı hesaplarını, profil bilgilerini, rolleri ve yetki gruplarını yönetin." columns={columns} fetchPage={userManagementApi.getPaged} toolbarAction={{ label: 'Yeni Kullanıcı', run: openCreate }}/>

    {mode && <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}><DialogContent showCloseButton={false} className="max-h-[calc(100%-2rem)] w-full !max-w-3xl overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-0 shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--wms-app-border)] px-6 py-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">{mode === 'create' ? <UserPlus className="size-5"/> : <Pencil className="size-5"/>}</div><div><DialogTitle className="text-xl font-bold">{mode === 'create' ? 'Yeni Kullanıcı' : 'Kullanıcıyı Düzenle'}</DialogTitle><p className="text-sm text-slate-500">Hesap, profil ve yetki bilgilerini tek işlemde yönetin.</p></div></div><button type="button" aria-label="Kapat" disabled={saving} onClick={closeForm} className="rounded-lg border p-2 disabled:opacity-50"><X className="size-4"/></button></div>
      {loadingForm ? <div className="grid h-80 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]"/></div> : <form onSubmit={submit} autoComplete="off" className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Kullanıcı adı" icon={Users} error={errors.username} required><input autoFocus name="wms-user-username" autoComplete="off" disabled={isPrimaryAdministrator} value={form.username} maxLength={100} onChange={(event) => updateForm('username', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60"/></Field><Field label="E-posta" icon={Mail} error={errors.email} required><input type="email" name="wms-user-email" autoComplete="off" value={form.email} maxLength={200} onChange={(event) => updateForm('email', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3"/></Field><Field label="Ad" icon={Users} error={errors.firstName}><input value={form.firstName} maxLength={100} onChange={(event) => updateForm('firstName', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3"/></Field><Field label="Soyad" icon={Users} error={errors.lastName}><input value={form.lastName} maxLength={100} onChange={(event) => updateForm('lastName', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3"/></Field><Field label="Telefon" icon={Phone} error={errors.phoneNumber}><input value={form.phoneNumber} maxLength={40} onChange={(event) => updateForm('phoneNumber', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3" placeholder="+90 ..."/></Field><Field label="Rol" icon={Shield} required><AppDropdown disabled={isPrimaryAdministrator} value={form.role} onValueChange={(value) => updateForm('role', value as UpdateUserPayload['role'])} options={[{ value: 'User', label: 'Kullanıcı' }, { value: 'Manager', label: 'Yönetici' }, { value: 'Admin', label: 'Uygulama Yöneticisi' }, ...(isPrimaryAdministrator ? [{ value: 'superadmin', label: 'Sistem Yöneticisi' }] : [])]} ariaLabel="Rol" /></Field><Field label={mode === 'create' ? 'Geçici şifre' : 'Yeni şifre'} icon={LockKeyhole} error={errors.password} required={mode === 'create'}><div className="relative"><input type={showPassword ? 'text' : 'password'} name="wms-user-new-password" autoComplete="new-password" value={form.password} maxLength={100} onChange={(event) => updateForm('password', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3 pr-11" placeholder={mode === 'edit' ? 'Değişmeyecekse boş bırakın' : ''}/><button type="button" aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2">{showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button></div></Field><Field label="Şifre tekrar" icon={LockKeyhole} error={errors.confirmPassword} required={mode === 'create'}><input type={showPassword ? 'text' : 'password'} name="wms-user-password-confirmation" autoComplete="new-password" value={form.confirmPassword} maxLength={100} onChange={(event) => updateForm('confirmPassword', event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3"/></Field></div>
      <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Yetki Grupları</p><span className="text-xs text-slate-500">{form.permissionGroupIds.length} grup seçili</span></div><div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">{groups.map((group) => <label key={group.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-[var(--wms-brand-soft)]"><input type="checkbox" checked={form.permissionGroupIds.includes(group.id)} onChange={() => updateForm('permissionGroupIds', form.permissionGroupIds.includes(group.id) ? form.permissionGroupIds.filter((id) => id !== group.id) : [...form.permissionGroupIds, group.id])}/><span><strong className="block text-sm">{group.name}</strong><small className="text-slate-500">{group.permissionCount} izin{group.isSystemAdmin ? ' • Sistem grubu' : ''}</small></span></label>)}</div></div>
      {isPrimaryAdministrator && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Ana sistem kullanıcısının kullanıcı adı, rolü ve aktiflik durumu güvenlik nedeniyle değiştirilemez.</div>}
      <label className="flex items-center justify-between rounded-xl border p-4"><span><strong className="block text-sm">Aktif kullanıcı</strong><small className="text-slate-500">Kullanıcı sisteme giriş yapabilsin.</small></span><input type="checkbox" disabled={isPrimaryAdministrator} checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} className="size-4"/></label><div className="flex justify-end gap-2 border-t border-[var(--wms-app-border)] pt-5"><button type="button" disabled={saving} onClick={closeForm} className="rounded-xl border px-5 py-2.5 disabled:opacity-50">Vazgeç</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin"/>}{mode === 'create' ? 'Kullanıcı Oluştur' : 'Değişiklikleri Kaydet'}</button></div></form>}</DialogContent></Dialog>}

    {deactivateTarget && <Dialog open onOpenChange={(open) => { if (!open && !saving) setDeactivateTarget(null); }}><DialogContent showCloseButton={false} className="w-full !max-w-md rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-6 shadow-2xl"><div className="grid size-11 place-items-center rounded-full bg-red-100 text-red-600"><Trash2 className="size-5"/></div><DialogTitle className="mt-4 text-xl font-bold">Kullanıcıyı pasife al</DialogTitle><p className="mt-2 text-sm text-slate-500"><strong>{deactivateTarget.username}</strong> artık sisteme giriş yapamayacak. Geçmiş kayıtları korunacaktır.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeactivateTarget(null)} className="rounded-xl border px-4 py-2">Vazgeç</button><button type="button" disabled={saving} onClick={deactivate} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin"/>}Pasife Al</button></div></DialogContent></Dialog>}
  </>;
}

function Field({ label, icon: Icon, error, required, children }: { label: string; icon: LucideIcon; error?: string; required?: boolean; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm"><span className="flex items-center gap-2 font-medium"><Icon className="size-4 text-[var(--wms-brand-primary)]"/>{label}{required && <span className="text-red-500">*</span>}</span>{children}<span className="block min-h-4 text-xs text-red-500">{error}</span></label>;
}
