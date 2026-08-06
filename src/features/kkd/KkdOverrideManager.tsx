import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { KkdCheckRow, KkdField, KkdPanel, KkdTableShell, KKD_CELL, KKD_HEAD_CELL } from './kkd-ops-ui';
import { kkdApi, type KkdOverride } from './kkd-api';

type OverrideForm = {
  employeeId: string;
  groupCode: string;
  quantity: string;
  validFrom: string;
  validTo: string;
  reason: string;
  isActive: boolean;
};

const emptyForm = (): OverrideForm => ({
  employeeId: '',
  groupCode: '',
  quantity: '1',
  validFrom: new Date().toLocaleDateString('en-CA'),
  validTo: '',
  reason: '',
  isActive: true,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ek hak işlemi tamamlanamadı.';

export function KkdOverrideManager(): ReactElement {
  const queryClient = useQueryClient();
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const [form, setForm] = useState<OverrideForm>(emptyForm);
  const [editing, setEditing] = useState<KkdOverride | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const list = useQuery({
    queryKey: ['kkd', 'overrides', page, search],
    queryFn: () => kkdApi.overridesPaged({ pageNumber: page, pageSize: 25, search: search || undefined }),
  });

  const reset = (): void => {
    setEditing(null);
    setForm(emptyForm());
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!Number(form.employeeId)) throw new Error('Personel seçilmelidir.');
      if (!form.groupCode.trim()) throw new Error('KKD grubu seçilmelidir.');
      if (!(Number(form.quantity) > 0)) throw new Error('Ek hak miktarı sıfırdan büyük olmalıdır.');
      if (form.reason.trim().length < 5) throw new Error('Gerekçe en az 5 karakter olmalıdır.');
      const payload = {
        employeeId: Number(form.employeeId),
        ruleId: null,
        groupCode: form.groupCode,
        quantity: Number(form.quantity),
        validFrom: form.validFrom,
        validTo: form.validTo || null,
        reason: form.reason.trim(),
        isActive: form.isActive,
        ...(editing ? { expectedRowVersion: editing.rowVersion } : {}),
      };
      return editing ? kkdApi.updateOverride(editing.id, payload) : kkdApi.createOverride(payload);
    },
    onSuccess: async () => {
      toast.success(editing ? 'Personel ek hakkı güncellendi.' : 'Personel ek hakkı tanımlandı.');
      reset();
      await queryClient.invalidateQueries({ queryKey: ['kkd', 'overrides'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: kkdApi.deleteOverride,
    onSuccess: async () => {
      toast.success('Kullanılmamış ek hak silindi.');
      reset();
      await queryClient.invalidateQueries({ queryKey: ['kkd', 'overrides'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const edit = (row: KkdOverride): void => {
    setEditing(row);
    setForm({
      employeeId: String(row.employeeId),
      groupCode: row.groupCode,
      quantity: String(row.quantity),
      validFrom: row.validFrom,
      validTo: row.validTo || '',
      reason: row.reason,
      isActive: row.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(340px,.72fr)_1.28fr]">
      <KkdPanel
        code={editing ? `OVR_${editing.id}` : 'OVR_NEW'}
        icon={editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        title={editing ? 'Ek hakkı düzenle' : 'Yeni personel ek hakkı'}
        description="Geçici, gerekçeli ve tarih sınırları belirlenmiş personel istisnası tanımlayın."
      >
        <form className="grid gap-3" onSubmit={submit}>
          <KkdField label="Personel">
            <OpsSelect
              value={form.employeeId}
              onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}
              options={(employees.data || []).map((item) => ({
                value: String(item.id),
                label: `${item.employeeCode} · ${item.fullName}`,
                description: `${item.departmentName} · ${item.roleName}`,
              }))}
              placeholder="Personel seçin"
              searchable
              disabled={Boolean(editing)}
            />
          </KkdField>
          <KkdField label="KKD grubu">
            <div className="wms-ops-field-shell">
              <PagedAppDropdown
                queryKey="kkd-override-group-lookup"
                fetchPage={kkdApi.entitlementGroupsPaged}
                toOption={(item) => ({ value: item.code, label: `${item.code} · ${item.name}`, description: `${item.ruleCount} kural` })}
                value={form.groupCode || null}
                onValueChange={(value) => setForm((current) => ({ ...current, groupCode: value }))}
                placeholder="KKD grubu seçin"
                searchPlaceholder="Kod veya ad ile ara"
                searchable
                minSearchLength={1}
                searchFields={['code', 'name']}
                className={OPS_SELECT_TRIGGER_CLASS}
              />
            </div>
          </KkdField>
          <KkdField label="Ek hak miktarı" hint={editing ? `Tüketilen: ${editing.consumedQuantity}` : undefined}>
            <AppInput
              type="number"
              step="any"
              min={editing?.consumedQuantity ?? 0.000001}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              required
            />
          </KkdField>
          <div className="grid gap-3 sm:grid-cols-2">
            <KkdField label="Geçerlilik başlangıcı">
              <AppDateInput value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} required />
            </KkdField>
            <KkdField label="Geçerlilik sonu" hint="Boşsa süresiz">
              <AppDateInput value={form.validTo} onChange={(event) => setForm((current) => ({ ...current, validTo: event.target.value }))} />
            </KkdField>
          </div>
          <KkdField label="Onay gerekçesi">
            <AppInput value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Neden ek hak verildi?" required />
          </KkdField>
          <KkdCheckRow
            checked={form.isActive}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
            title="Ek hak aktif"
            description="Pasif kayıt hak hesabına katılmaz; geçmişi korunur."
          />
          <div className="flex flex-wrap gap-2">
            <OpsActionButton type="submit" variant="primary" className="flex-1" loading={save.isPending}>
              <Save className="size-3.5" />
              {editing ? 'Değişiklikleri kaydet' : 'Ek hakkı tanımla'}
            </OpsActionButton>
            {editing ? (
              <OpsActionButton type="button" variant="secondary" onClick={reset}>
                <X className="size-3.5" /> Vazgeç
              </OpsActionButton>
            ) : null}
          </div>
        </form>
      </KkdPanel>

      <KkdPanel
        code="OVR_LST"
        icon={<Search className="size-4" />}
        title="Personel ek hakları"
        description="Aktif, tüketilmiş ve süresi dolmuş istisnaları tek listede izleyin."
        actions={
          <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => void list.refetch()}>
            <RefreshCw className="size-3.5" /> Yenile
          </OpsActionButton>
        }
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="border-b border-[var(--wms-app-border)] p-3">
          <AppInput value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Personel, grup veya gerekçe ara" />
        </div>
        <KkdTableShell minWidthClass="min-w-[920px]" className="border-x-0 border-b-0">
          <thead><tr>
            {['Personel', 'Grup', 'Hak', 'Tüketilen', 'Kalan', 'Geçerlilik', 'Durum', 'İşlemler'].map((column) => <th key={column} className={KKD_HEAD_CELL}>{column}</th>)}
          </tr></thead>
          <tbody>
            {list.isLoading ? <tr><td colSpan={8} className="wms-ops-grid-state-cell"><OpsLoadingState code="FETCH" message="Ek haklar yükleniyor…" compact /></td></tr>
              : !list.data?.items.length ? <tr><td colSpan={8} className="wms-ops-grid-state-cell"><OpsGridEmptyState message="Arama ölçütlerine uygun ek hak bulunamadı." /></td></tr>
              : list.data.items.map((row) => (
                <tr key={row.id}>
                  <td className={KKD_CELL}><strong>{row.employeeCode}</strong><span className="block text-xs text-[var(--wms-app-text-muted)]">{row.employeeName}</span></td>
                  <td className={KKD_CELL}>{row.groupCode}</td>
                  <td className={KKD_CELL}>{row.quantity}</td>
                  <td className={KKD_CELL}>{row.consumedQuantity}</td>
                  <td className={KKD_CELL}><strong>{row.remainingQuantity}</strong></td>
                  <td className={KKD_CELL}>{row.validFrom}<span className="block text-xs text-[var(--wms-app-text-muted)]">{row.validTo || 'Süresiz'}</span></td>
                  <td className={KKD_CELL}><OpsStatusBadge tone={row.isActive ? 'active' : 'neutral'}>{row.isActive ? 'Aktif' : 'Pasif'}</OpsStatusBadge></td>
                  <td className={KKD_CELL}>
                    <div className="flex gap-1">
                      <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" onClick={() => edit(row)}><Pencil className="size-3.5" /> Düzenle</OpsActionButton>
                      <OpsActionButton
                        variant="secondary"
                        className="wms-ops-list-toolbar-btn !text-rose-500"
                        disabled={row.consumedQuantity > 0 || remove.isPending}
                        title={row.consumedQuantity > 0 ? 'Tüketilmiş hak silinemez; düzenleyerek pasife alın.' : 'Sil'}
                        onClick={() => {
                          if (window.confirm(`${row.employeeCode} / ${row.groupCode} ek hakkı silinsin mi?`)) remove.mutate(row.id);
                        }}
                      ><Trash2 className="size-3.5" /> Sil</OpsActionButton>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </KkdTableShell>
        {list.data && list.data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--wms-app-border)] p-3 text-sm">
            <span>{list.data.totalCount} kayıt · Sayfa {list.data.pageNumber}/{list.data.totalPages}</span>
            <div className="flex gap-2">
              <OpsActionButton variant="secondary" disabled={!list.data.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>Önceki</OpsActionButton>
              <OpsActionButton variant="secondary" disabled={!list.data.hasNextPage} onClick={() => setPage((value) => value + 1)}>Sonraki</OpsActionButton>
            </div>
          </div>
        ) : null}
      </KkdPanel>
    </div>
  );
}
