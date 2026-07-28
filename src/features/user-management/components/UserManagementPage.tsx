import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, FileSpreadsheet, Loader2, LockKeyhole, Mail, Pencil, Phone, Plus, Shield, Trash2, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsCircuitToggleInline } from '@/components/shared/OpsCircuitToggle';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectDateTime } from '@/lib/project-format';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { userManagementApi } from '../api/user-management.api';
import type { PermissionGroupOption, UpdateUserPayload, UserRow } from '../types/user-management.types';
import { UserImportDialog } from './UserImportDialog';

type FormMode = 'create' | 'edit';
interface UserFormState {
  id?: number; username: string; email: string; firstName: string; lastName: string; phoneNumber: string;
  role: UpdateUserPayload['role']; password: string; confirmPassword: string; isActive: boolean; permissionGroupIds: number[];
}

const emptyForm: UserFormState = { username: '', email: '', firstName: '', lastName: '', phoneNumber: '', role: 'User', password: '', confirmPassword: '', isActive: true, permissionGroupIds: [] };

function validateForm(form: UserFormState, mode: FormMode, minimumPasswordLength: number, maximumPasswordLength: number): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(form.username.trim())) errors.username = '3-100 karakter; harf, rakam, nokta, tire veya alt çizgi kullanın.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Geçerli bir e-posta adresi girin.';
  if ((mode === 'create' || form.password.length > 0) && (form.password.length < minimumPasswordLength || form.password.length > maximumPasswordLength)) errors.password = `Şifre ${minimumPasswordLength}-${maximumPasswordLength} karakter olmalıdır.`;
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
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const minimumPasswordLength = useProjectSettingsStore((state) => state.settings.passwordMinimumLength);
  const maximumPasswordLength = useProjectSettingsStore((state) => state.settings.passwordMaximumLength);

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

  const refreshGrid = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'system-users'] });
    setGridVersion((value) => value + 1);
  }, [queryClient]);

  const toggleStatus = useCallback(async (row: UserRow, checked: boolean) => {
    if (row.role.toLowerCase() === 'superadmin') return;
    setStatusBusyId(row.id);
    try {
      const detail = await userManagementApi.getById(row.id);
      await userManagementApi.update(row.id, {
        username: detail.username,
        email: detail.email,
        firstName: detail.firstName || undefined,
        lastName: detail.lastName || undefined,
        phoneNumber: detail.phoneNumber || undefined,
        role: detail.role as UpdateUserPayload['role'],
        isActive: checked,
        permissionGroupIds: detail.permissionGroupIds,
      });
      toast.success(checked ? 'Kullanıcı aktifleştirildi.' : 'Kullanıcı pasife alındı.');
      await refreshGrid();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Durum güncellenemedi.');
    } finally {
      setStatusBusyId(null);
    }
  }, [refreshGrid]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const nextErrors = validateForm(form, mode, minimumPasswordLength, maximumPasswordLength); setErrors(nextErrors);
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
      await refreshGrid();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Kullanıcı kaydedilemedi.'); }
    finally { setSaving(false); }
  };

  const deactivate = async () => {
    if (!deactivateTarget) return;
    setSaving(true);
    try { await userManagementApi.deactivate(deactivateTarget.id); toast.success('Kullanıcı pasife alındı.'); setDeactivateTarget(null); await refreshGrid(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Kullanıcı pasife alınamadı.'); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<UserRow>[]>(() => [
    ...systemColumns<UserRow>(),
    { key: 'username', label: 'Kullanıcı Adı', searchable: true, defaultSearch: true, render: (row) => <span className="font-semibold">{row.username}</span> },
    { key: 'firstName', label: 'Ad', searchable: true, render: (row) => row.firstName || '-' },
    { key: 'lastName', label: 'Soyad', searchable: true, render: (row) => row.lastName || '-' },
    { key: 'email', label: 'E-posta', searchable: true, defaultSearch: true, render: (row) => row.email },
    {
      key: 'role',
      label: 'Rol',
      filterable: true,
      filterType: 'enum',
      render: (row) => <OpsCodeBadge>{localizeEnumValue(row.role)}</OpsCodeBadge>,
      contextValue: (row) => localizeEnumValue(row.role),
    },
    {
      key: 'isActive',
      label: 'Durum',
      filterable: true,
      filterType: 'boolean',
      filterOptions: [
        { value: 'true', label: 'Aktif' },
        { value: 'false', label: 'Pasif' },
      ],
      render: (row) => (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <OpsCircuitToggleInline
            checked={row.isActive}
            disabled={statusBusyId === row.id || row.role.toLowerCase() === 'superadmin'}
            onCheckedChange={(checked) => void toggleStatus(row, checked)}
            aria-label={row.isActive ? 'Aktif' : 'Pasif'}
          />
          <OpsStatusBadge tone={row.isActive ? 'done' : 'pending'}>
            {row.isActive ? 'Aktif' : 'Pasif'}
          </OpsStatusBadge>
        </div>
      ),
      contextValue: (row) => (row.isActive ? 'Aktif' : 'Pasif'),
    },
    { key: 'lastLoginAt', label: 'Son Giriş', render: (row) => formatProjectDateTime(row.lastLoginAt) },
    {
      key: 'actions',
      label: 'İşlemler',
      sortable: false,
      filterable: false,
      hideable: false,
      render: (row) => (
        <div className="wms-ops-row-actions flex items-center justify-center gap-1">
          <button type="button" aria-label={`${row.username} düzenle`} title="Düzenle" onClick={() => openEdit(row)} className="wms-ops-grid-icon-btn grid size-8 place-items-center">
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`${row.username} pasife al`}
            title="Pasife al"
            disabled={!row.isActive || row.role.toLowerCase() === 'superadmin'}
            onClick={() => setDeactivateTarget(row)}
            className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--danger grid size-8 place-items-center disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ], [openEdit, statusBusyId, toggleStatus]);

  const isPrimaryAdministrator = form.role.toLowerCase() === 'superadmin';
  return (
    <div className="wms-ops-user-management-page wms-ops-access-control-page">
      <AdvancedDataGrid
        pageKey="system-users"
        refreshKey={gridVersion}
        eyebrow={<>
          <span>SİSTEM_VE_YETKİ</span>
          <span className="mx-2 opacity-60">/</span>
          <span>KULLANICI_YÖNETİMİ</span>
        </>}
        title="Kullanıcı Yönetimi"
        description="Kullanıcı hesaplarını, profil bilgilerini, rolleri ve yetki gruplarını yönetin."
        emptyMessage="Kayıtlı kullanıcı bulunamadı."
        columns={columns}
        fetchPage={userManagementApi.getPaged}
        toolbarActions={[
          { label: 'Excel ile Kullanıcı Ekle', run: async () => setImportOpen(true), icon: <FileSpreadsheet className="size-3.5" aria-hidden /> },
          { label: 'Yeni Kullanıcı', run: openCreate, icon: <Plus className="size-3.5" aria-hidden /> },
        ]}
      />

      <UserImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refreshGrid} />

      {mode && (
        <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}>
          <OpsDialogContent size="lg">
            <OpsDialogHeader>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">
                  {mode === 'create' ? <UserPlus className="size-5" /> : <Pencil className="size-5" />}
                </div>
                <div>
                  <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">
                    {mode === 'create' ? 'Yeni Kullanıcı' : 'Kullanıcıyı Düzenle'}
                  </DialogTitle>
                  <p className="text-sm text-slate-500">Hesap, profil ve yetki bilgilerini tek işlemde yönetin.</p>
                </div>
              </div>
            </OpsDialogHeader>
            {loadingForm ? (
              <OpsDialogBody>
                <div className="grid h-80 place-items-center">
                  <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
                </div>
              </OpsDialogBody>
            ) : (
              <form onSubmit={submit} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
                <OpsDialogBody className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Kullanıcı adı" icon={Users} error={errors.username} required>
                      <AppInput autoFocus name="wms-user-username" autoComplete="off" disabled={isPrimaryAdministrator} invalid={Boolean(errors.username)} value={form.username} maxLength={100} onChange={(event) => updateForm('username', event.target.value)} />
                    </Field>
                    <Field label="E-posta" icon={Mail} error={errors.email} required>
                      <AppInput type="email" name="wms-user-email" autoComplete="off" invalid={Boolean(errors.email)} value={form.email} maxLength={200} onChange={(event) => updateForm('email', event.target.value)} />
                    </Field>
                    <Field label="Ad" icon={Users} error={errors.firstName}>
                      <AppInput invalid={Boolean(errors.firstName)} value={form.firstName} maxLength={100} onChange={(event) => updateForm('firstName', event.target.value)} />
                    </Field>
                    <Field label="Soyad" icon={Users} error={errors.lastName}>
                      <AppInput invalid={Boolean(errors.lastName)} value={form.lastName} maxLength={100} onChange={(event) => updateForm('lastName', event.target.value)} />
                    </Field>
                    <Field label="Telefon" icon={Phone} error={errors.phoneNumber}>
                      <AppInput invalid={Boolean(errors.phoneNumber)} value={form.phoneNumber} maxLength={40} onChange={(event) => updateForm('phoneNumber', event.target.value)} placeholder="+90 ..." />
                    </Field>
                    <Field label="Rol" icon={Shield} required>
                      <AppDropdown disabled={isPrimaryAdministrator} value={form.role} onValueChange={(value) => updateForm('role', value as UpdateUserPayload['role'])} portalContainer={null} options={[{ value: 'User', label: 'Kullanıcı' }, { value: 'Manager', label: 'Yönetici' }, { value: 'Admin', label: 'Uygulama Yöneticisi' }, ...(isPrimaryAdministrator ? [{ value: 'superadmin', label: 'Sistem Yöneticisi' }] : [])]} ariaLabel="Rol" />
                    </Field>
                    <Field label={`${mode === 'create' ? 'Geçici şifre' : 'Yeni şifre'} (${minimumPasswordLength}-${maximumPasswordLength} karakter)`} icon={LockKeyhole} error={errors.password} required={mode === 'create'}>
                      <AppInput
                        type={showPassword ? 'text' : 'password'}
                        name="wms-user-new-password"
                        autoComplete="new-password"
                        invalid={Boolean(errors.password)}
                        value={form.password}
                        maxLength={maximumPasswordLength}
                        onChange={(event) => updateForm('password', event.target.value)}
                        placeholder={mode === 'edit' ? 'Değişmeyecekse boş bırakın' : ''}
                        trailingContent={(
                          <button
                            type="button"
                            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                            onClick={() => setShowPassword((value) => !value)}
                            className="app-input-shell__picker"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        )}
                      />
                    </Field>
                    <Field label="Şifre tekrar" icon={LockKeyhole} error={errors.confirmPassword} required={mode === 'create'}>
                      <AppInput type={showPassword ? 'text' : 'password'} name="wms-user-password-confirmation" autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} value={form.confirmPassword} maxLength={maximumPasswordLength} onChange={(event) => updateForm('confirmPassword', event.target.value)} />
                    </Field>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">Yetki Grupları</p>
                      <span className="text-xs text-slate-500">{form.permissionGroupIds.length} grup seçili</span>
                    </div>
                    <div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">
                      {groups.map((group) => (
                        <label key={group.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-[var(--wms-brand-soft)]">
                          <input type="checkbox" checked={form.permissionGroupIds.includes(group.id)} onChange={() => updateForm('permissionGroupIds', form.permissionGroupIds.includes(group.id) ? form.permissionGroupIds.filter((id) => id !== group.id) : [...form.permissionGroupIds, group.id])} />
                          <span>
                            <strong className="block text-sm">{group.name}</strong>
                            <small className="text-slate-500">{group.permissionCount} izin{group.isSystemAdmin ? ' • Sistem grubu' : ''}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {isPrimaryAdministrator && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      Ana sistem kullanıcısının kullanıcı adı, rolü ve aktiflik durumu güvenlik nedeniyle değiştirilemez.
                    </div>
                  )}
                  <label className="flex items-center justify-between rounded-xl border p-4">
                    <span>
                      <strong className="block text-sm">Aktif kullanıcı</strong>
                      <small className="text-slate-500">Kullanıcı sisteme giriş yapabilsin.</small>
                    </span>
                    <input type="checkbox" disabled={isPrimaryAdministrator} checked={form.isActive} onChange={(event) => updateForm('isActive', event.target.checked)} className="size-4" />
                  </label>
                </OpsDialogBody>
                <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
                  <OpsActionButton type="button" variant="secondary" disabled={saving} onClick={closeForm}>
                    Vazgeç
                  </OpsActionButton>
                  <OpsActionButton type="submit" variant="primary" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {mode === 'create' ? 'Kullanıcı Oluştur' : 'Değişiklikleri Kaydet'}
                  </OpsActionButton>
                </OpsDialogFooter>
              </form>
            )}
          </OpsDialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => { if (!open && !saving) setDeactivateTarget(null); }}
        title="Kullanıcıyı pasife al"
        itemLabel={deactivateTarget?.username ?? null}
        confirmLabel="Pasife Al"
        description={deactivateTarget ? `${deactivateTarget.username} artık sisteme giriş yapamayacak. Geçmiş kayıtları korunacaktır.` : undefined}
        isPending={saving}
        onConfirm={deactivate}
      />
    </div>
  );
}

function Field({ label, icon: Icon, error, required, children }: { label: string; icon: LucideIcon; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="inline-flex items-center gap-2 font-medium leading-none">
        <Icon className="size-4 shrink-0 text-[var(--wms-brand-primary)]" aria-hidden />
        {label}
        {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
      <span className="wms-ops-form-message-slot">
        {error ? <span className="wms-ops-form-message">{error}</span> : null}
      </span>
    </label>
  );
}
