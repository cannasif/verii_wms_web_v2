import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { permissionsApi as systemApi, type CreatePermissionRequest, type PermissionRow } from '../api/permissions.api';

const emptyForm: CreatePermissionRequest = { code: '', name: '', description: '', isActive: true, availableOnWeb: true, availableOnMobile: false };

export function PermissionsPage() {
  const { t } = useModuleTranslation('permissions');
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
  const columns = useMemo<GridColumn<PermissionRow>[]>(() => [
    ...systemColumns<PermissionRow>(),
    { key: 'code', label: t('grid.columns.code'), render: row => <code className="text-xs font-semibold">{row.code}</code> },
    { key: 'name', label: t('grid.columns.name'), render: row => row.name },
    { key: 'description', label: t('grid.columns.description'), render: row => row.description || '-' },
    { key: 'availableOnWeb', label: t('grid.columns.web'), render: row => <OpsStatusBadge tone={row.availableOnWeb ? 'done' : 'pending'}>{row.availableOnWeb ? t('grid.yes') : t('grid.no')}</OpsStatusBadge> },
    { key: 'availableOnMobile', label: t('grid.columns.mobile'), render: row => <OpsStatusBadge tone={row.availableOnMobile ? 'done' : 'pending'}>{row.availableOnMobile ? t('grid.yes') : t('grid.no')}</OpsStatusBadge> },
    { key: 'isActive', label: t('grid.columns.status'), render: row => <OpsStatusBadge tone={row.isActive ? 'done' : 'pending'}>{row.isActive ? t('grid.statusActive') : t('grid.statusInactive')}</OpsStatusBadge> },
    { key: 'actions', label: t('grid.columns.actions'), sortable: false, filterable: false, hideable: false, render: row => <div className="flex gap-1"><button type="button" title={t('grid.editTitle')} onClick={() => openEdit(row)} className="rounded-lg border p-2 text-blue-600"><Pencil className="size-4" /></button><button type="button" title={t('grid.deleteTitle')} onClick={() => setDeleteTarget(row)} className="rounded-lg border p-2 text-red-600"><Trash2 className="size-4" /></button></div> },
  ], [t]);
  return <>
    <AdvancedDataGrid pageKey="system-permissions-v2" title={t('grid.title')} description={t('grid.description')} columns={columns} fetchPage={systemApi.permissions} toolbarAction={{ label: t('grid.createAction'), run: openCreate }} />
    {editing !== undefined && (
      <Dialog open onOpenChange={open => { if (!open && !saving) setEditing(undefined); }}>
        <OpsDialogContent size="md">
          <OpsDialogHeader>
            <div>
              <DialogTitle className="wms-ops-detail-dialog__title text-xl font-bold">{editing ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">{t('dialog.subtitle')}</p>
            </div>
          </OpsDialogHeader>
          <OpsDialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span>{t('dialog.codeLabel')}</span><input value={form.code} maxLength={150} onChange={event => setForm(value => ({ ...value, code: event.target.value.toUpperCase() }))} className="input" /></label>
              <label className="space-y-1 text-sm"><span>{t('dialog.nameLabel')}</span><input value={form.name} maxLength={200} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} className="input" /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span>{t('dialog.descriptionLabel')}</span><textarea value={form.description} maxLength={500} rows={3} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} className="input min-h-[5rem] resize-y" /></label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label><input type="checkbox" checked={form.isActive} onChange={event => setForm(value => ({ ...value, isActive: event.target.checked }))} /> {t('dialog.activeLabel')}</label>
              <label><input type="checkbox" checked={form.availableOnWeb} onChange={event => setForm(value => ({ ...value, availableOnWeb: event.target.checked }))} /> {t('dialog.webLabel')}</label>
              <label><input type="checkbox" checked={form.availableOnMobile} onChange={event => setForm(value => ({ ...value, availableOnMobile: event.target.checked }))} /> {t('dialog.mobileLabel')}</label>
            </div>
          </OpsDialogBody>
          <OpsDialogFooter>
            <button type="button" onClick={() => setEditing(undefined)} className="rounded-xl border px-4 py-2">{t('dialog.cancelButton')}</button>
            <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-white disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />}{t('dialog.saveButton')}</button>
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
