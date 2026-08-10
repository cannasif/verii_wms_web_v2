import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, FileSpreadsheet, Loader2, LockKeyhole, Mail, Pencil, Phone, Plus, Shield, Trash2, UserPlus, Users, Warehouse, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsCircuitToggleInline } from '@/components/shared/OpsCircuitToggle';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectDateTime } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useProjectSettingsStore } from '@/stores/project-settings-store';
import { useAuthStore } from '@/stores/auth-store';
import { userManagementApi } from '../api/user-management.api';
import type { PermissionGroupOption, UpdateUserPayload, UserRow, WarehouseOption } from '../types/user-management.types';
import { UserImportDialog } from './UserImportDialog';

type FormMode = 'create' | 'edit';
interface UserFormState {
  id?: number; username: string; email: string; firstName: string; lastName: string; phoneNumber: string;
  role: UpdateUserPayload['role']; password: string; confirmPassword: string; isActive: boolean; permissionGroupIds: number[]; warehouseIds: number[];
}

const emptyForm: UserFormState = { username: '', email: '', firstName: '', lastName: '', phoneNumber: '', role: 'User', password: '', confirmPassword: '', isActive: true, permissionGroupIds: [], warehouseIds: [] };

function validateForm(form: UserFormState, mode: FormMode, minimumPasswordLength: number, maximumPasswordLength: number, t: (key: string, options?: Record<string, unknown>) => string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(form.username.trim())) errors.username = t('validation.username');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = t('validation.email');
  if ((mode === 'create' || form.password.length > 0) && (form.password.length < minimumPasswordLength || form.password.length > maximumPasswordLength)) errors.password = t('validation.password', { min: minimumPasswordLength, max: maximumPasswordLength });
  if (form.password !== form.confirmPassword) errors.confirmPassword = t('validation.confirmPassword');
  if (form.firstName.length > 100) errors.firstName = t('validation.firstName');
  if (form.lastName.length > 100) errors.lastName = t('validation.lastName');
  if (form.phoneNumber.length > 40) errors.phoneNumber = t('validation.phoneNumber');
  return errors;
}

export function UserManagementPage() {
  const { t, moduleReady } = useModuleTranslation('user-management');
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [groups, setGroups] = useState<PermissionGroupOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
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
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');

  const loadLookups = useCallback(async () => {
    const [activeGroups, warehouseOptions] = await Promise.all([
      userManagementApi.getActiveGroups(),
      userManagementApi.getWarehouses(branchCode),
    ]);
    setGroups(activeGroups);
    setWarehouses(warehouseOptions);
  }, [branchCode]);

  const openCreate = useCallback(async () => {
    setMode('create'); setForm(emptyForm); setErrors({}); setShowPassword(false); setLoadingForm(true);
    try { await loadLookups(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('toast.lookupsFailed')); setMode(null); }
    finally { setLoadingForm(false); }
  }, [loadLookups, t]);

  const openEdit = useCallback(async (row: UserRow) => {
    setMode('edit'); setForm({ ...emptyForm, id: row.id, username: row.username, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role as UpdateUserPayload['role'], isActive: row.isActive });
    setErrors({}); setShowPassword(false); setLoadingForm(true);
    try {
      const [detail] = await Promise.all([userManagementApi.getById(row.id), loadLookups()]);
      setForm({ id: detail.id, username: detail.username, email: detail.email, firstName: detail.firstName || '', lastName: detail.lastName || '', phoneNumber: detail.phoneNumber || '', role: detail.role as UpdateUserPayload['role'], password: '', confirmPassword: '', isActive: detail.isActive, permissionGroupIds: detail.permissionGroupIds, warehouseIds: detail.warehouseIds });
    } catch (error) { toast.error(error instanceof Error ? error.message : t('toast.detailFailed')); setMode(null); }
    finally { setLoadingForm(false); }
  }, [loadLookups, t]);

  const closeForm = () => { if (!saving) { setMode(null); setErrors({}); } };
  const updateForm = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };
  const updateRole = (role: UpdateUserPayload['role']) => {
    const systemAdminGroupId = groups.find((group) => group.isSystemAdmin)?.id;
    setForm((current) => ({
      ...current,
      role,
      permissionGroupIds: systemAdminGroupId
        ? role === 'Admin'
          ? [...new Set([...current.permissionGroupIds, systemAdminGroupId])]
          : current.permissionGroupIds.filter((id) => id !== systemAdminGroupId)
        : current.permissionGroupIds,
      warehouseIds: role === 'Admin' ? [] : current.warehouseIds,
    }));
    setErrors((current) => { const next = { ...current }; delete next.role; return next; });
  };

  const togglePermissionGroup = (group: PermissionGroupOption) => {
    setForm((current) => {
      if (current.role.toLowerCase() === 'superadmin') return current;
      const checked = current.permissionGroupIds.includes(group.id);
      const permissionGroupIds = checked
        ? current.permissionGroupIds.filter((id) => id !== group.id)
        : [...current.permissionGroupIds, group.id];
      if (!group.isSystemAdmin) return { ...current, permissionGroupIds };
      return {
        ...current,
        permissionGroupIds,
        role: checked ? 'User' : 'Admin',
        warehouseIds: checked ? current.warehouseIds : [],
      };
    });
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
        warehouseIds: detail.warehouseIds,
      });
      toast.success(checked ? t('toast.activated') : t('toast.deactivated'));
      await refreshGrid();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.statusUpdateFailed'));
    } finally {
      setStatusBusyId(null);
    }
  }, [refreshGrid, t]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const nextErrors = validateForm(form, mode, minimumPasswordLength, maximumPasswordLength, t); setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const shared = { username: form.username.trim(), email: form.email.trim(), firstName: form.firstName.trim() || undefined, lastName: form.lastName.trim() || undefined, phoneNumber: form.phoneNumber.trim() || undefined, role: form.role, isActive: form.isActive, permissionGroupIds: form.permissionGroupIds, warehouseIds: form.warehouseIds };
      if (mode === 'create') {
        if (form.role === 'superadmin') throw new Error(t('validation.superadminNotAllowed'));
        await userManagementApi.create({ ...shared, password: form.password, role: form.role });
        toast.success(t('toast.created'));
      } else if (form.id) {
        await userManagementApi.update(form.id, { ...shared, password: form.password || undefined });
        toast.success(t('toast.updated'));
      }
      setMode(null); setForm(emptyForm);
      await refreshGrid();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('toast.saveFailed')); }
    finally { setSaving(false); }
  };

  const deactivate = async () => {
    if (!deactivateTarget) return;
    setSaving(true);
    try { await userManagementApi.deactivate(deactivateTarget.id); toast.success(t('toast.deactivateSuccess')); setDeactivateTarget(null); await refreshGrid(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('toast.deactivateFailed')); }
    finally { setSaving(false); }
  };

  const columns = useMemo<GridColumn<UserRow>[]>(() => {
    if (!moduleReady) return [];
    return [
    ...systemColumns<UserRow>(),
    { key: 'username', label: t('grid.columns.username'), searchable: true, defaultSearch: true, render: (row) => <span className="font-semibold">{row.username}</span> },
    { key: 'firstName', label: t('grid.columns.firstName'), searchable: true, render: (row) => row.firstName || '-' },
    { key: 'lastName', label: t('grid.columns.lastName'), searchable: true, render: (row) => row.lastName || '-' },
    { key: 'email', label: t('grid.columns.email'), searchable: true, defaultSearch: true, render: (row) => row.email },
    {
      key: 'role',
      label: t('grid.columns.role'),
      filterable: true,
      filterType: 'enum',
      render: (row) => <OpsCodeBadge>{localizeEnumValue(row.role)}</OpsCodeBadge>,
      contextValue: (row) => localizeEnumValue(row.role),
    },
    {
      key: 'isActive',
      label: t('grid.columns.status'),
      filterable: true,
      filterType: 'boolean',
      filterOptions: [
        { value: 'true', label: t('grid.statusActive') },
        { value: 'false', label: t('grid.statusInactive') },
      ],
      render: (row) => (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <OpsCircuitToggleInline
            checked={row.isActive}
            disabled={statusBusyId === row.id || row.role.toLowerCase() === 'superadmin'}
            onCheckedChange={(checked) => void toggleStatus(row, checked)}
            aria-label={row.isActive ? t('grid.statusActive') : t('grid.statusInactive')}
          />
          <OpsStatusBadge tone={row.isActive ? 'done' : 'pending'}>
            {row.isActive ? t('grid.statusActive') : t('grid.statusInactive')}
          </OpsStatusBadge>
        </div>
      ),
      contextValue: (row) => (row.isActive ? t('grid.statusActive') : t('grid.statusInactive')),
    },
    { key: 'lastLoginAt', label: t('grid.columns.lastLogin'), searchable: false, filterType: 'datetime', render: (row) => formatProjectDateTime(row.lastLoginAt) },
    {
      key: 'actions',
      label: t('grid.columns.actions'),
      sortable: false,
      filterable: false,
      hideable: false,
      render: (row) => (
        <div className="wms-ops-row-actions flex items-center justify-center gap-1">
          <button type="button" aria-label={t('grid.editAriaLabel', { username: row.username })} title={t('grid.editAction')} onClick={() => openEdit(row)} className="wms-ops-grid-icon-btn grid size-8 place-items-center">
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={t('grid.deactivateAriaLabel', { username: row.username })}
            title={t('grid.deactivateAction')}
            disabled={!row.isActive || row.role.toLowerCase() === 'superadmin'}
            onClick={() => setDeactivateTarget(row)}
            className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--danger grid size-8 place-items-center disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];
  }, [moduleReady, openEdit, statusBusyId, t, toggleStatus]);

  const isPrimaryAdministrator = form.role.toLowerCase() === 'superadmin';
  if (!moduleReady) {
    return (
      <div className="wms-ops-user-management-page wms-ops-access-control-page grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </div>
    );
  }
  return (
    <div className="wms-ops-user-management-page wms-ops-access-control-page">
      <AdvancedDataGrid
        pageKey="system-users"
        refreshKey={gridVersion}
        eyebrow={<>
          <span>{t('grid.eyebrowGroup')}</span>
          <span className="mx-2 opacity-60">/</span>
          <span>{t('grid.eyebrowPage')}</span>
        </>}
        title={t('grid.title')}
        description={t('grid.description')}
        emptyMessage={t('grid.emptyMessage')}
        columns={columns}
        fetchPage={userManagementApi.getPaged}
        toolbarActions={[
          { label: t('grid.toolbar.importAction'), run: async () => setImportOpen(true), icon: <FileSpreadsheet className="size-3.5" aria-hidden /> },
          { label: t('grid.toolbar.createAction'), run: openCreate, icon: <Plus className="size-3.5" aria-hidden /> },
        ]}
      />

      <UserImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={refreshGrid} />

      {mode && (
        <Dialog open onOpenChange={(open) => { if (!open) closeForm(); }}>
          <OpsDialogContent size="lg" className="wms-ops-access-control-dialog">
            <OpsDialogHeader>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-[var(--wms-brand-primary)] text-white">
                  {mode === 'create' ? <UserPlus className="size-5" /> : <Pencil className="size-5" />}
                </div>
                <div>
                  <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">
                    {mode === 'create' ? t('dialog.createTitle') : t('dialog.editTitle')}
                  </DialogTitle>
                  <p className="text-sm text-slate-500">{t('dialog.subtitle')}</p>
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
                    <Field label={t('dialog.usernameLabel')} icon={Users} error={errors.username} required>
                      <AppInput autoFocus name="wms-user-username" autoComplete="off" disabled={isPrimaryAdministrator} invalid={Boolean(errors.username)} value={form.username} maxLength={100} onChange={(event) => updateForm('username', event.target.value)} />
                    </Field>
                    <Field label={t('dialog.emailLabel')} icon={Mail} error={errors.email} required>
                      <AppInput type="email" name="wms-user-email" autoComplete="off" invalid={Boolean(errors.email)} value={form.email} maxLength={200} onChange={(event) => updateForm('email', event.target.value)} />
                    </Field>
                    <Field label={t('dialog.firstNameLabel')} icon={Users} error={errors.firstName}>
                      <AppInput invalid={Boolean(errors.firstName)} value={form.firstName} maxLength={100} onChange={(event) => updateForm('firstName', event.target.value)} />
                    </Field>
                    <Field label={t('dialog.lastNameLabel')} icon={Users} error={errors.lastName}>
                      <AppInput invalid={Boolean(errors.lastName)} value={form.lastName} maxLength={100} onChange={(event) => updateForm('lastName', event.target.value)} />
                    </Field>
                    <Field label={t('dialog.phoneLabel')} icon={Phone} error={errors.phoneNumber}>
                      <AppInput invalid={Boolean(errors.phoneNumber)} value={form.phoneNumber} maxLength={40} onChange={(event) => updateForm('phoneNumber', event.target.value)} placeholder="+90 ..." />
                    </Field>
                    <Field label={t('dialog.roleLabel')} icon={Shield} required>
                      <AppDropdown disabled={isPrimaryAdministrator} value={form.role} onValueChange={(value) => updateRole(value as UpdateUserPayload['role'])} portalContainer={null} options={[{ value: 'User', label: t('dialog.roleUser') }, { value: 'Manager', label: t('dialog.roleManager') }, { value: 'Admin', label: t('dialog.roleAdmin') }, ...(isPrimaryAdministrator ? [{ value: 'superadmin', label: t('dialog.roleSuperadmin') }] : [])]} ariaLabel={t('dialog.roleLabel')} />
                    </Field>
                    <Field label={`${mode === 'create' ? t('dialog.temporaryPasswordLabel') : t('dialog.newPasswordLabel')} ${t('dialog.passwordLengthHint', { min: minimumPasswordLength, max: maximumPasswordLength })}`} icon={LockKeyhole} error={errors.password} required={mode === 'create'}>
                      <AppInput
                        type={showPassword ? 'text' : 'password'}
                        name="wms-user-new-password"
                        autoComplete="new-password"
                        invalid={Boolean(errors.password)}
                        value={form.password}
                        maxLength={maximumPasswordLength}
                        onChange={(event) => updateForm('password', event.target.value)}
                        placeholder={mode === 'edit' ? t('dialog.passwordPlaceholderEdit') : ''}
                        trailingContent={(
                          <button
                            type="button"
                            aria-label={showPassword ? t('dialog.hidePassword') : t('dialog.showPassword')}
                            onClick={() => setShowPassword((value) => !value)}
                            className="app-input-shell__picker"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        )}
                      />
                    </Field>
                    <Field label={t('dialog.confirmPasswordLabel')} icon={LockKeyhole} error={errors.confirmPassword} required={mode === 'create'}>
                      <AppInput type={showPassword ? 'text' : 'password'} name="wms-user-password-confirmation" autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} value={form.confirmPassword} maxLength={maximumPasswordLength} onChange={(event) => updateForm('confirmPassword', event.target.value)} />
                    </Field>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">{t('dialog.permissionGroupsTitle')}</p>
                      <span className="text-xs text-slate-500">{t('dialog.groupsSelectedCount', { count: form.permissionGroupIds.length })}</span>
                    </div>
                    <div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">
                      {groups.map((group) => {
                        const checked = form.permissionGroupIds.includes(group.id);
                        const disabled = isPrimaryAdministrator;
                        const toggle = () => { if (!disabled) togglePermissionGroup(group); };
                        return (
                          <div
                            key={group.id}
                            role="button"
                            tabIndex={disabled ? -1 : 0}
                            onClick={toggle}
                            onKeyDown={(event) => {
                              if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault();
                                toggle();
                              }
                            }}
                            className={cn('flex items-start gap-3 rounded-xl border p-3', disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-[var(--wms-brand-soft)]')}
                          >
                            <OpsSkinCheckbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={toggle}
                              aria-label={group.name}
                              className="mt-0.5"
                            />
                            <span>
                              <strong className="block text-sm">{group.name}</strong>
                              <small className="text-slate-500">{t('dialog.permissionCountSuffix', { count: group.permissionCount })}{group.isSystemAdmin ? t('dialog.systemGroupSuffix') : ''}</small>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="inline-flex items-center gap-2 text-sm font-semibold"><Warehouse className="size-4 text-[var(--wms-brand-primary)]" /> {t('dialog.warehousesTitle')}</p>
                      <span className="text-xs text-slate-500">{form.warehouseIds.length ? t('dialog.warehousesSelectedCount', { count: form.warehouseIds.length }) : t('dialog.warehousesNoneSelected')}</span>
                    </div>
                    <p className="mb-3 text-xs text-slate-500">
                      {t('dialog.warehousesHint')}
                    </p>
                    <div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">
                      {warehouses.map((warehouse) => {
                        const disabled = form.role === 'Admin' || isPrimaryAdministrator;
                        const checked = form.warehouseIds.includes(warehouse.id);
                        const toggle = () => {
                          if (disabled) return;
                          updateForm(
                            'warehouseIds',
                            checked
                              ? form.warehouseIds.filter((id) => id !== warehouse.id)
                              : [...form.warehouseIds, warehouse.id],
                          );
                        };
                        return (
                          <div
                            key={warehouse.id}
                            role="button"
                            tabIndex={disabled ? -1 : 0}
                            onClick={toggle}
                            onKeyDown={(event) => {
                              if (disabled) return;
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                toggle();
                              }
                            }}
                            className={cn(
                              'flex items-start gap-3 rounded-xl border p-3',
                              disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-[var(--wms-brand-soft)]',
                            )}
                          >
                            <OpsSkinCheckbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={toggle}
                              aria-label={t('dialog.warehouseLabel', { code: warehouse.warehouseCode })}
                              className="mt-0.5"
                            />
                            <span>
                              <strong className="block text-sm">{t('dialog.warehouseLabel', { code: warehouse.warehouseCode })}</strong>
                              <small className="text-slate-500">{warehouse.warehouseName}</small>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {isPrimaryAdministrator && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      {t('dialog.superadminNotice')}
                    </div>
                  )}
                  <div
                    role="button"
                    tabIndex={isPrimaryAdministrator ? -1 : 0}
                    onClick={() => {
                      if (!isPrimaryAdministrator) updateForm('isActive', !form.isActive);
                    }}
                    onKeyDown={(event) => {
                      if (isPrimaryAdministrator) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        updateForm('isActive', !form.isActive);
                      }
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-4',
                      isPrimaryAdministrator ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                    )}
                  >
                    <span>
                      <strong className="block text-sm">{t('dialog.activeUserLabel')}</strong>
                      <small className="text-slate-500">{t('dialog.activeUserHint')}</small>
                    </span>
                    <OpsSkinCheckbox
                      disabled={isPrimaryAdministrator}
                      checked={form.isActive}
                      onCheckedChange={(checked) => updateForm('isActive', checked)}
                      aria-label={t('dialog.activeUserLabel')}
                    />
                  </div>
                </OpsDialogBody>
                <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
                  <OpsActionButton type="button" variant="secondary" disabled={saving} onClick={closeForm}>
                    {t('dialog.cancelButton')}
                  </OpsActionButton>
                  <OpsActionButton type="submit" variant="primary" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {mode === 'create' ? t('dialog.createButton') : t('dialog.saveButton')}
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
        title={t('deactivateDialog.title')}
        itemLabel={deactivateTarget?.username ?? null}
        confirmLabel={t('deactivateDialog.confirmLabel')}
        description={deactivateTarget ? t('deactivateDialog.description', { username: deactivateTarget.username }) : undefined}
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
