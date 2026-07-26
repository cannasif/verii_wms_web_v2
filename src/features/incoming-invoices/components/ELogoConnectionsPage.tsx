import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { CheckCircle2, Edit3, Loader2, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { AppInput } from '@/components/shared/AppInput';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { useAuthStore } from '@/stores/auth-store';
import { incomingInvoiceApi } from '../api/incoming-invoice.api';
import type { ELogoConnectionRow, SaveELogoConnectionInput } from '../types/incoming-invoice.types';

export function ELogoConnectionsPage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('incoming-invoices');
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const [editing, setEditing] = useState<ELogoConnectionRow | 'new' | null>(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);

  const remove = useCallback(async (row: ELogoConnectionRow): Promise<void> => {
    if (!window.confirm(t('connections.confirmDelete', { name: row.displayName }))) return;
    setDeleting(row.id);
    try {
      await incomingInvoiceApi.deleteConnection(row.id, branchCode);
      toast.success(t('messages.connectionDeleted'));
      setGridVersion((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('messages.connectionDeleteFailed'));
    } finally {
      setDeleting(null);
    }
  }, [branchCode, t]);

  const columns = useMemo<GridColumn<ELogoConnectionRow>[]>(() => {
    void moduleReady;
    return [
      ...systemColumns<ELogoConnectionRow>(),
      { key: 'displayName', label: t('connections.columns.name'), sortable: true, filterable: true, render: (row) => <div><strong>{row.displayName}</strong><p className="text-xs text-slate-500">{row.key}</p></div> },
      { key: 'vkn', label: t('connections.columns.vkn'), sortable: true, filterable: true, render: (row) => row.vkn },
      { key: 'username', label: t('connections.columns.username'), sortable: true, filterable: true, render: (row) => row.username },
      { key: 'source', label: t('connections.columns.source'), sortable: true, filterable: true, render: (row) => row.source },
      { key: 'isConfigured', label: t('connections.columns.configured'), sortable: true, filterable: true, filterType: 'boolean', render: (row) => row.isConfigured ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600"><CheckCircle2 className="size-3.5" />{t('common.yes')}</span> : <span className="text-rose-500">{t('common.no')}</span> },
      { key: 'isDefault', label: t('connections.columns.default'), sortable: true, filterable: true, filterType: 'boolean', render: (row) => row.isDefault ? t('common.yes') : t('common.no') },
      { key: 'isActive', label: t('connections.columns.active'), sortable: true, filterable: true, filterType: 'boolean', render: (row) => row.isActive ? t('common.yes') : t('common.no') },
      {
        key: 'actions', label: t('columns.actions'), ...requiredActionColumn,
        render: (row) => <div className="flex gap-1"><button type="button" aria-label={t('actions.edit')} title={t('actions.edit')} onClick={() => setEditing(row)} className="grid size-11 place-items-center rounded-xl text-cyan-600 hover:bg-cyan-500/10"><Edit3 className="size-4" /></button><button type="button" aria-label={t('actions.delete')} title={t('actions.delete')} disabled={deleting === row.id} onClick={() => void remove(row)} className="grid size-11 place-items-center rounded-xl text-rose-500 hover:bg-rose-500/10 disabled:opacity-50">{deleting === row.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button></div>,
      },
    ];
  }, [deleting, moduleReady, remove, t]);

  return <>
    <AdvancedDataGrid<ELogoConnectionRow>
      key={`${gridVersion}-${branchCode}`}
      pageKey="elogo-connections"
      title={t('connections.title')}
      description={t('connections.description')}
      columns={columns}
      fetchPage={(request) => incomingInvoiceApi.pagedConnections(branchCode, request)}
      toolbarAction={{ label: t('connections.add'), run: async () => setEditing('new') }}
    />
    {editing && <ConnectionDialog branchCode={branchCode} value={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setGridVersion((value) => value + 1); }} />}
  </>;
}

function ConnectionDialog({ branchCode, value, onClose, onSaved }: { branchCode: string; value: ELogoConnectionRow | null; onClose: () => void; onSaved: () => void }): ReactElement {
  const { t } = useModuleTranslation('incoming-invoices');
  const [form, setForm] = useState<SaveELogoConnectionInput>(() => value ? {
    branchCode, key: value.key, displayName: value.displayName, vkn: value.vkn,
    username: value.username, password: null, source: value.source,
    endpointUrl: value.endpointUrl, applicationName: value.applicationName,
    version: value.version, timeoutSeconds: value.timeoutSeconds, isActive: value.isActive,
    isDefault: value.isDefault, description: value.description, rowVersion: value.rowVersion,
  } : {
    branchCode, key: '', displayName: '', vkn: '', username: '', password: '',
    source: '', endpointUrl: 'https://pb.elogo.com.tr/PostBoxService.svc',
    applicationName: 'eLogoPDF', version: '1.0', timeoutSeconds: 120,
    isActive: true, isDefault: false, description: null, rowVersion: null,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveELogoConnectionInput>(key: K, next: SaveELogoConnectionInput[K]): void => setForm((current) => ({ ...current, [key]: next }));
  const save = async (): Promise<void> => {
    if (!form.key.trim() || !form.displayName.trim() || !form.vkn.trim() || !form.username.trim() || !form.source.trim()) { toast.error(t('validation.requiredFields')); return; }
    if (!value && !form.password?.trim()) { toast.error(t('validation.passwordRequired')); return; }
    setSaving(true);
    try {
      if (value) await incomingInvoiceApi.updateConnection(value.id, form);
      else await incomingInvoiceApi.createConnection(form);
      toast.success(value ? t('messages.connectionUpdated') : t('messages.connectionCreated'));
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('messages.connectionSaveFailed'));
    } finally {
      setSaving(false);
    }
  };
  return <ResponsiveDialog onClose={onClose} title={value ? t('connections.edit') : t('connections.add')} className="max-h-[calc(100dvh-1rem)]">
    <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-500">eLogo PostBox</p><h2 className="mt-1 text-xl font-black">{value ? t('connections.edit') : t('connections.add')}</h2><p className="mt-1 text-sm text-slate-500">{t('connections.formDescription')}</p></div><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="size-5" /></button></header>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label={t('connections.fields.key')} required><AppInput value={form.key} disabled={Boolean(value)} onChange={(event) => set('key', event.target.value)} /></Field>
      <Field label={t('connections.fields.name')} required><AppInput value={form.displayName} onChange={(event) => set('displayName', event.target.value)} /></Field>
      <Field label={t('connections.fields.vkn')} required><AppInput inputMode="numeric" maxLength={11} value={form.vkn} onChange={(event) => set('vkn', event.target.value.replace(/\D/g, ''))} /></Field>
      <Field label={t('connections.fields.source')} required><AppInput value={form.source} onChange={(event) => set('source', event.target.value)} /></Field>
      <Field label={t('connections.fields.username')} required><AppInput autoComplete="off" value={form.username} onChange={(event) => set('username', event.target.value)} /></Field>
      <Field label={value ? t('connections.fields.newPassword') : t('connections.fields.password')} required={!value}><AppInput type="password" autoComplete="new-password" value={form.password ?? ''} onChange={(event) => set('password', event.target.value)} placeholder={value ? t('connections.fields.keepPassword') : undefined} /></Field>
      <div className="sm:col-span-2"><Field label={t('connections.fields.endpoint')} required><AppInput type="url" value={form.endpointUrl ?? ''} onChange={(event) => set('endpointUrl', event.target.value)} /></Field></div>
      <Field label={t('connections.fields.application')}><AppInput value={form.applicationName ?? ''} onChange={(event) => set('applicationName', event.target.value)} /></Field>
      <Field label={t('connections.fields.version')}><AppInput value={form.version ?? ''} onChange={(event) => set('version', event.target.value)} /></Field>
      <Field label={t('connections.fields.timeout')}><AppInput type="number" min={10} max={600} value={form.timeoutSeconds ?? 120} onChange={(event) => set('timeoutSeconds', Number(event.target.value))} /></Field>
      <Field label={t('connections.fields.description')}><AppInput value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} /></Field>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Toggle label={t('connections.fields.active')} checked={form.isActive} onChange={(checked) => set('isActive', checked)} />
      <Toggle label={t('connections.fields.default')} checked={form.isDefault} onChange={(checked) => set('isDefault', checked)} />
    </div>
    <div className="mt-4 flex gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/8 p-4 text-sm"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-500" /><p>{t('connections.securityNote')}</p></div>
    <footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--wms-app-border)] px-5 font-semibold">{t('actions.cancel')}</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : value ? <Save className="size-4" /> : <Plus className="size-4" />}{t('actions.save')}</button></footer>
  </ResponsiveDialog>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactElement }): ReactElement { return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }): ReactElement { return <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-cyan-500" /><span className="font-semibold">{label}</span></label>; }
