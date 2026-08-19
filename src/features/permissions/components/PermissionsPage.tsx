import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { AppInput } from '@/components/shared/AppInput';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { permissionsApi as systemApi, type CreatePermissionRequest, type PermissionRow } from '../api/permissions.api';

const emptyForm: CreatePermissionRequest = { code: '', name: '', description: '', isActive: true, availableOnWeb: true, availableOnMobile: false };

export function PermissionsPage() {
  const { t, moduleReady } = useModuleTranslation('permissions');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PermissionRow | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<PermissionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreatePermissionRequest>(emptyForm);
  const openCreate = async () => { setForm(emptyForm); setEditing(null); };
  const openEdit = (row: PermissionRow) => { setForm({ code: row.code, name: row.name, description: row.description || '', isActive: row.isActive, availableOnWeb: row.availableOnWeb, availableOnMobile: row.availableOnMobile }); setEditing(row); };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['advanced-grid', 'system-permissions-v2'] });
  const save = async () => {
    if (form.code.trim().length < 3 || form.name.trim().length < 2) { toast.error(t('toast.codeNameRequired')); return; }
    setSaving(true);
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description?.trim() || undefined };
      if (editing) await systemApi.updatePermission(editing.id, payload); else await systemApi.createPermission(payload);
      toast.success(editing ? t('toast.updated') : t('toast.created')); setEditing(undefined); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('toast.saveFailed')); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleteTarget) return; setSaving(true);
    try { await systemApi.deletePermission(deleteTarget.id); toast.success(t('toast.deleted')); setDeleteTarget(null); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t('toast.deleteFailed')); }
    finally { setSaving(false); }
  };
  const columns = useMemo<GridColumn<PermissionRow>[]>(() => {
    if (!moduleReady) return [];
    return [
    ...systemColumns<PermissionRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
    { key: 'code', label: t('grid.columns.code'), render: row => <code className="text-xs font-semibold">{row.code}</code> },
    { key: 'name', label: t('grid.columns.name'), render: row => row.name },
    { key: 'description', label: t('grid.columns.description'), render: row => row.description || '-' },
    { key: 'availableOnWeb', label: t('grid.columns.web'), render: row => <OpsStatusBadge tone={row.availableOnWeb ? 'done' : 'pending'}>{row.availableOnWeb ? t('grid.yes') : t('grid.no')}</OpsStatusBadge> },
    { key: 'availableOnMobile', label: t('grid.columns.mobile'), render: row => <OpsStatusBadge tone={row.availableOnMobile ? 'done' : 'pending'}>{row.availableOnMobile ? t('grid.yes') : t('grid.no')}</OpsStatusBadge> },
    { key: 'isActive', label: t('grid.columns.status'), render: row => <OpsStatusBadge tone={row.isActive ? 'done' : 'pending'}>{row.isActive ? t('grid.statusActive') : t('grid.statusInactive')}</OpsStatusBadge> },
    {
      key: 'actions',
      label: t('grid.columns.actions'),
      sortable: false,
      filterable: false,
      hideable: false,
      render: row => (
        <div className="wms-ops-row-actions flex items-center justify-center gap-1">
          <button type="button" title={t('grid.editTitle')} onClick={() => openEdit(row)} className="wms-ops-grid-icon-btn grid size-8 place-items-center">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" title={t('grid.deleteTitle')} onClick={() => setDeleteTarget(row)} className="wms-ops-grid-icon-btn grid size-8 place-items-center">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];
  }, [moduleReady, t]);

  const flagRows: { key: 'isActive' | 'availableOnWeb' | 'availableOnMobile'; label: string }[] = [
    { key: 'isActive', label: t('dialog.activeLabel') },
    { key: 'availableOnWeb', label: t('dialog.webLabel') },
    { key: 'availableOnMobile', label: t('dialog.mobileLabel') },
  ];

  if (!moduleReady) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-[var(--wms-brand-primary)]" />
      </section>
    );
  }

  return <>
    <AdvancedDataGrid pageKey="system-permissions-v2" title={t('grid.title')} description={t('grid.description')} columns={columns} fetchPage={systemApi.permissions} toolbarAction={{ label: t('grid.createAction'), run: openCreate }} />
    {editing !== undefined && (
      <Dialog open onOpenChange={open => { if (!open && !saving) setEditing(undefined); }}>
        <OpsDialogContent size="md" className="wms-ops-access-control-dialog">
          <OpsDialogHeader>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{editing ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{t('dialog.subtitle')}</p>
            </div>
          </OpsDialogHeader>
          <OpsDialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 text-sm">
                <label className="font-medium">{t('dialog.codeLabel')}</label>
                <AppInput value={form.code} maxLength={150} onChange={event => setForm(value => ({ ...value, code: event.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1.5 text-sm">
                <label className="font-medium">{t('dialog.nameLabel')}</label>
                <AppInput value={form.name} maxLength={200} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5 text-sm sm:col-span-2">
                <label className="font-medium">{t('dialog.descriptionLabel')}</label>
                <textarea
                  value={form.description}
                  maxLength={500}
                  rows={3}
                  onChange={event => setForm(value => ({ ...value, description: event.target.value }))}
                  className="input wms-ops-field min-h-[5rem] w-full resize-y"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {flagRows.map(({ key, label }) => (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setForm(value => ({ ...value, [key]: !value[key] }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setForm(value => ({ ...value, [key]: !value[key] }));
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <OpsSkinCheckbox
                    checked={form[key]}
                    onCheckedChange={(checked) => setForm(value => ({ ...value, [key]: checked }))}
                    aria-label={label}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </OpsDialogBody>
          <OpsDialogFooter className="flex flex-wrap items-center justify-end gap-2">
            <OpsActionButton type="button" variant="secondary" disabled={saving} onClick={() => setEditing(undefined)}>
              {t('dialog.cancelButton')}
            </OpsActionButton>
            <OpsActionButton type="button" variant="primary" disabled={saving} onClick={() => save()}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('dialog.saveButton')}
            </OpsActionButton>
          </OpsDialogFooter>
        </OpsDialogContent>
      </Dialog>
    )}
    <DeleteConfirmDialog
      open={Boolean(deleteTarget)}
      onOpenChange={open => { if (!open && !saving) setDeleteTarget(null); }}
      title={t('deleteDialog.title')}
      itemLabel={deleteTarget?.code ?? null}
      description={deleteTarget ? t('deleteDialog.description', { code: deleteTarget.code }) : undefined}
      isPending={saving}
      onConfirm={remove}
    />
  </>;
}
