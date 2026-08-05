import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Copy, Eye, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppInput } from '@/components/shared/AppInput';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsCircuitToggleField } from '@/components/shared/OpsCircuitToggle';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { permissionGroupsApi } from '../api/permission-groups.api';
import type { PermissionGroupDetail, PermissionGroupRow, PermissionRow } from '../types/permission-groups.types';
import { buildPermissionCatalog } from '../utils/permission-catalog';

type Mode = 'create' | 'copy' | 'view' | 'edit';
const P = 'permissionGroups.page';

export function PermissionGroupsPage() {
  const { t } = useTranslation('common');
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

  const open = useCallback(async (group: PermissionGroupRow | null, nextMode: Mode) => {
    if (group?.isProtected && nextMode === 'edit') return;
    setMode(nextMode); setLoading(true); setPermissionSearch('');
    try {
      const permissionPromise = permissionGroupsApi.getActivePermissions();
      if (group) {
        const [permissionCatalog, groupDetail] = await Promise.all([permissionPromise, permissionGroupsApi.getById(group.id)]);
        setPermissions(permissionCatalog); setDetail(groupDetail); setName(nextMode === 'copy' ? `${groupDetail.name} - Kopya` : groupDetail.name); setDescription(groupDetail.description || ''); setSelected(nextMode === 'copy' && groupDetail.isSystemAdmin ? permissionCatalog.map(permission => permission.id) : groupDetail.permissionIds); setIsActive(nextMode === 'copy' ? true : groupDetail.isActive);
      } else {
        const permissionCatalog = await permissionPromise;
        setPermissions(permissionCatalog); setDetail(null); setName(''); setDescription(''); setSelected([]); setIsActive(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${P}.loadFailed`));
      setMode(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const save = async () => {
    const normalizedName = name.trim();
    if (normalizedName.length < 2) { toast.error(t(`${P}.nameMinLength`)); return; }
    if (!mode || mode === 'view') return;
    setSaving(true);
    try {
      const payload = { name: normalizedName, description: description.trim() || undefined, isSystemAdmin: false, isActive, permissionIds: selected };
      if (mode === 'edit' && detail) await permissionGroupsApi.update(detail.id, payload);
      else if (mode === 'copy' && detail) await permissionGroupsApi.copy(detail.id, { name: normalizedName, description: description.trim() || undefined });
      else await permissionGroupsApi.create(payload);
      toast.success(mode === 'edit' ? t(`${P}.saveSuccessUpdate`) : mode === 'copy' ? t(`${P}.copySuccess`) : t(`${P}.saveSuccessCreate`));
      close();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'permission-groups'] }), queryClient.invalidateQueries({ queryKey: ['system-group-stats'] })]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${P}.saveFailed`));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || deleteTarget.isProtected) return;
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
    {
      key: 'name',
      label: t(`${P}.columns.name`),
      render: (row) => (
        <div>
          <strong className="block">{row.name}</strong>
          {row.description ? <small className="text-slate-500">{row.description}</small> : null}
        </div>
      ),
    },
    {
      key: 'isSystemAdmin', label: t(`${P}.columns.isSystemAdmin`),
      render: row => row.isSystemAdmin
        ? <OpsStatusBadge tone="pending" className="gap-1"><ShieldCheck className="size-3.5" />{t(`${P}.yes`)}</OpsStatusBadge>
        : <OpsStatusBadge tone="active">{t(`${P}.no`)}</OpsStatusBadge>,
    },
    {
      key: 'isProtected', label: t(`${P}.columns.isProtected`),
      render: row => row.isProtected
        ? <OpsStatusBadge tone="pending">{t(`${P}.defaultTemplate`)}</OpsStatusBadge>
        : <OpsStatusBadge tone="active">{t(`${P}.customGroup`)}</OpsStatusBadge>,
    },
    {
      key: 'isActive', label: t(`${P}.columns.isActive`),
      render: row => <OpsStatusBadge tone={row.isActive ? 'done' : 'pending'}>{row.isActive ? t(`${P}.active`) : t(`${P}.inactive`)}</OpsStatusBadge>,
    },
    { key: 'permissionCount', label: t(`${P}.columns.permissionCount`), render: row => <span className="inline-flex min-w-8 justify-center rounded-full bg-[var(--wms-brand-soft)] px-2 py-1 text-xs font-semibold">{row.permissionCount}</span> },
    {
      key: 'actions', label: t(`${P}.columns.actions`), sortable: false, filterable: false,
      render: row => (
        <div className="wms-ops-row-actions flex items-center gap-1">
          <button type="button" title={t(`${P}.view`)} onClick={() => void open(row, 'view')} className="wms-ops-grid-icon-btn grid size-8 place-items-center">
            <Eye className="size-3.5" />
          </button>
          <button type="button" title={t(`${P}.copy`)} onClick={() => void open(row, 'copy')} className="wms-ops-grid-icon-btn grid size-8 place-items-center">
            <Copy className="size-3.5" />
          </button>
          <button type="button" title={t(`${P}.edit`)} disabled={row.isProtected} onClick={() => void open(row, 'edit')} className="wms-ops-grid-icon-btn grid size-8 place-items-center disabled:cursor-not-allowed disabled:opacity-35">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" title={t(`${P}.delete`)} disabled={row.isProtected} onClick={() => setDeleteTarget(row)} className="wms-ops-grid-icon-btn grid size-8 place-items-center disabled:cursor-not-allowed disabled:opacity-35">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ], [t, open]);

  const permissionGroups = useMemo(() => buildPermissionCatalog(permissions, permissionSearch), [permissionSearch, permissions]);
  const visiblePermissions = useMemo(() => permissionGroups.flatMap(group => group.items), [permissionGroups]);

  const readOnly = mode === 'view';
  const permissionReadOnly = mode === 'view' || mode === 'copy';
  const modalTitle = mode === 'create' ? t(`${P}.modal.createTitle`) : mode === 'copy' ? t(`${P}.modal.copyTitle`) : mode === 'edit' ? t(`${P}.modal.editTitle`) : t(`${P}.modal.viewTitle`);

  return (
    <div className="wms-ops-form space-y-4" data-no-auto-localize="true">
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
          <OpsDialogContent size="xl" className="wms-ops-access-control-dialog">
            <OpsDialogHeader>
              <div>
                <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{modalTitle}</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">{t(`${P}.modal.subtitle`)}</p>
              </div>
            </OpsDialogHeader>
            {loading ? (
              <OpsDialogBody>
                <div className="grid h-80 place-items-center"><Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" /></div>
              </OpsDialogBody>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <OpsDialogBody className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                    <div className="space-y-1.5 text-sm">
                      <label className="font-medium">{t(`${P}.modal.groupName`)}</label>
                      <AppInput disabled={readOnly} value={name} maxLength={150} onChange={e => setName(e.target.value)} />
                    </div>
                    <OpsCircuitToggleField
                      checked={isActive}
                      onCheckedChange={setIsActive}
                      disabled={readOnly || mode === 'copy'}
                      title={t(`${P}.modal.activeGroup`)}
                      description={t(`${P}.modal.activeGroupHint`)}
                      className="rounded-xl border"
                    />
                    <div className="space-y-1.5 text-sm sm:col-span-2">
                      <label className="font-medium">{t(`${P}.modal.description`)}</label>
                      <textarea
                        disabled={readOnly}
                        value={description}
                        maxLength={500}
                        rows={3}
                        onChange={e => setDescription(e.target.value)}
                        className="input wms-ops-field min-h-[5rem] w-full resize-y disabled:opacity-60"
                      />
                    </div>
                  </div>
                  {detail?.isProtected && <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"><ShieldCheck className="size-4" />{t(`${P}.modal.protectedNotice`)}</div>}
                  <div className="rounded-2xl border border-[var(--wms-app-border)]">
                    <div className="flex flex-col gap-3 border-b border-[var(--wms-app-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <strong className="text-sm">{t(`${P}.modal.permissionsTitle`)}</strong>
                        <p className="text-xs text-slate-500">{t(`${P}.modal.selectedSummary`, { selected: selected.length, visible: visiblePermissions.length })}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-[12rem] flex-1 sm:max-w-56 sm:flex-none">
                          <AppInput
                            value={permissionSearch}
                            onChange={e => setPermissionSearch(e.target.value)}
                            placeholder={t(`${P}.modal.searchPlaceholder`)}
                            leadingIcon={<Search className="size-4" />}
                          />
                        </div>
                        {!permissionReadOnly && <>
                          <OpsActionButton type="button" variant="secondary" onClick={() => setSelected(current => [...new Set([...current, ...visiblePermissions.map(item => item.id)])])}>
                            {t(`${P}.modal.selectVisible`)}
                          </OpsActionButton>
                          <OpsActionButton type="button" variant="secondary" onClick={() => setSelected([])}>
                            {t(`${P}.modal.clear`)}
                          </OpsActionButton>
                        </>}
                      </div>
                    </div>
                    <div className="max-h-[28rem] space-y-4 overflow-auto p-4">
                      {permissionGroups.map(group => {
                        const groupIds = group.items.map(item => item.id);
                        const selectedCount = groupIds.filter(id => selected.includes(id)).length;
                        return (
                          <section key={group.key} className="overflow-hidden rounded-xl border border-[var(--wms-app-border)]">
                            <header className="flex flex-wrap items-center justify-between gap-2 bg-[var(--wms-brand-soft)] px-3 py-2.5">
                              <div>
                                <strong className="block text-sm">{group.label}</strong>
                                <small className="text-slate-500">{selectedCount} / {group.items.length} izin seçili</small>
                              </div>
                              {!permissionReadOnly && (
                                <button
                                  type="button"
                                  className="rounded-lg border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-2.5 py-1.5 text-xs font-semibold"
                                  onClick={() => setSelected(current => selectedCount === group.items.length
                                    ? current.filter(id => !groupIds.includes(id))
                                    : [...new Set([...current, ...groupIds])])}
                                >
                                  {selectedCount === group.items.length ? 'Modül seçimini kaldır' : 'Modülün tümünü seç'}
                                </button>
                              )}
                            </header>
                            <div className="grid gap-2 p-3 md:grid-cols-2">
                              {group.items.map(permission => {
                                const checked = selected.includes(permission.id);
                                const toggle = () => {
                                  if (permissionReadOnly) return;
                                  setSelected(current => current.includes(permission.id)
                                    ? current.filter(id => id !== permission.id)
                                    : [...current, permission.id]);
                                };
                                return (
                                  <div
                                    key={permission.id}
                                    role="button"
                                    tabIndex={permissionReadOnly ? -1 : 0}
                                    onClick={toggle}
                                    onKeyDown={(event) => {
                                      if (!permissionReadOnly && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault();
                                        toggle();
                                      }
                                    }}
                                    className={cn(
                                      'flex items-start gap-2.5 rounded-xl border p-3',
                                      checked && 'border-[var(--wms-brand-primary)] bg-[var(--wms-brand-soft)]',
                                      permissionReadOnly ? 'cursor-default opacity-90' : 'cursor-pointer hover:border-[var(--wms-brand-primary)]',
                                    )}
                                  >
                                    <OpsSkinCheckbox checked={checked} disabled={permissionReadOnly} onCheckedChange={toggle} aria-label={permission.name} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex flex-wrap items-center gap-1.5">
                                        <strong className="text-sm leading-4">{permission.name}</strong>
                                        <small className="rounded-full bg-[var(--wms-app-panel)] px-2 py-0.5 text-[10px] font-semibold text-slate-500">{permission.actionLabel}</small>
                                      </span>
                                      {permission.scopeDetail ? <small className="mt-1 block text-xs text-slate-500">{permission.scopeDetail}</small> : null}
                                      {permission.description ? <small className="mt-1 block text-xs text-slate-500">{permission.description}</small> : null}
                                      <code className="mt-1.5 block break-all text-[10px] text-slate-400">{permission.code}</code>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                      {!permissionGroups.length && <p className="py-10 text-center text-sm text-slate-500">Aramanızla eşleşen izin bulunamadı.</p>}
                    </div>
                  </div>
                </OpsDialogBody>
                <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
                  <OpsActionButton type="button" variant="secondary" onClick={close}>
                    {readOnly ? t(`${P}.modal.close`) : t(`${P}.modal.cancel`)}
                  </OpsActionButton>
                  {!readOnly && (
                    <OpsActionButton type="button" variant="primary" disabled={saving || name.trim().length < 2} onClick={() => void save()}>
                      {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                      {t(`${P}.modal.save`)}
                    </OpsActionButton>
                  )}
                </OpsDialogFooter>
              </div>
            )}
          </OpsDialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={openState => { if (!openState && !saving) setDeleteTarget(null); }}
        title={t(`${P}.deleteDialog.title`)}
        description={deleteTarget ? t(`${P}.deleteDialog.body`, { name: deleteTarget.name }) : undefined}
        confirmLabel={t(`${P}.deleteDialog.confirm`)}
        isPending={saving}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'brand' }: { label: string; value: number; icon: typeof Users2; tone?: 'brand' | 'emerald' | 'amber' }) {
  const colors = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]';
  return <div className="flex items-center gap-4 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4 shadow-sm"><div className={`grid size-11 place-items-center rounded-xl ${colors}`}><Icon className="size-5" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div></div>;
}
