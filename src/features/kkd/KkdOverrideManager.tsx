import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import type { PagedResponse } from '@/types/api';
import { KkdCheckRow, KkdField, KkdPanel, KkdTableShell, KKD_CELL, KKD_HEAD_CELL } from './kkd-ops-ui';
import { KkdEmployeeLookupField } from './KkdEmployeeLookupField';
import { kkdApi, type KkdEntitlementGroupLookup, type KkdOverride } from './kkd-api';

type OverrideForm = {
  employeeId: string;
  groupCode: string;
  groupLabel: string;
  quantity: string;
  validFrom: string;
  validTo: string;
  reason: string;
  isActive: boolean;
};

const emptyForm = (): OverrideForm => ({
  employeeId: '',
  groupCode: '',
  groupLabel: '',
  quantity: '1',
  validFrom: new Date().toLocaleDateString('en-CA'),
  validTo: '',
  reason: '',
  isActive: true,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ek hak işlemi tamamlanamadı.';

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

export function KkdOverrideManager(): ReactElement {
  const queryClient = useQueryClient();
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const [form, setForm] = useState<OverrideForm>(emptyForm);
  const [editing, setEditing] = useState<KkdOverride | null>(null);
  const [groupLookupOpen, setGroupLookupOpen] = useState(false);
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

  const groupDisplay = useMemo(
    () => form.groupLabel || form.groupCode,
    [form.groupCode, form.groupLabel],
  );

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
      groupLabel: row.groupCode,
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
          <KkdEmployeeLookupField
            value={form.employeeId}
            employees={employees.data}
            onChange={(employeeId) => setForm((current) => ({ ...current, employeeId }))}
            disabled={Boolean(editing)}
          />
          <KkdField label="KKD grubu">
            <PagedLookupDialog<KkdEntitlementGroupLookup>
              variant="ops"
              triggerMode="combobox"
              autoSearchMinLength={1}
              open={groupLookupOpen}
              onOpenChange={setGroupLookupOpen}
              title="KKD grubu seç"
              description="Kod veya ad yazarak arayın; arama ikonu veya çift tık ile liste penceresini açın."
              value={groupDisplay}
              placeholder="KKD grubu yazın veya seçin"
              searchPlaceholder="Grup ara"
              emptyText="KKD grubu bulunamadı."
              queryKey={['kkd', 'override-entitlement-group-lookup']}
              fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
                toPagedResponse(
                  await kkdApi.entitlementGroupsPaged({
                    pageNumber,
                    pageSize,
                    search,
                    searchFields: ['code', 'name'],
                    sortBy: 'code',
                    sortDirection: 'asc',
                    signal: signal ?? new AbortController().signal,
                  }),
                )
              }
              getKey={(item) => item.code}
              getLabel={(item) => `${item.code} · ${item.name}`}
              onSelect={(item) =>
                setForm((current) => ({
                  ...current,
                  groupCode: item.code,
                  groupLabel: `${item.code} · ${item.name}`,
                }))
              }
            />
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
              <AppDateInput
                value={form.validFrom}
                onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))}
                required
              />
            </KkdField>
            <KkdField label="Geçerlilik sonu" hint="Boşsa süresiz">
              <AppDateInput
                value={form.validTo}
                onChange={(event) => setForm((current) => ({ ...current, validTo: event.target.value }))}
              />
            </KkdField>
          </div>
          <KkdField label="Onay gerekçesi">
            <AppInput
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Neden ek hak verildi?"
              required
            />
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
          <AppInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Personel, grup veya gerekçe ara"
          />
        </div>
        <KkdTableShell minWidthClass="min-w-[920px]" className="border-x-0 border-b-0">
          <thead>
            <tr>
              {['Personel', 'Grup', 'Hak', 'Tüketilen', 'Kalan', 'Geçerlilik', 'Durum', 'İşlemler'].map((column) => (
                <th key={column} className={KKD_HEAD_CELL}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td colSpan={8} className="wms-ops-grid-state-cell">
                  <OpsLoadingState code="FETCH" message="Ek haklar yükleniyor…" compact />
                </td>
              </tr>
            ) : !list.data?.items.length ? (
              <tr>
                <td colSpan={8} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message="Arama ölçütlerine uygun ek hak bulunamadı." />
                </td>
              </tr>
            ) : (
              list.data.items.map((row) => (
                <tr key={row.id}>
                  <td className={KKD_CELL}>
                    <div className="font-mono font-semibold">{row.employeeCode}</div>
                    <div className="text-xs text-[var(--wms-app-text-muted)]">{row.employeeName}</div>
                  </td>
                  <td className={KKD_CELL}>{row.groupCode}</td>
                  <td className={KKD_CELL}>{row.quantity}</td>
                  <td className={KKD_CELL}>{row.consumedQuantity}</td>
                  <td className={KKD_CELL}>{row.remainingQuantity}</td>
                  <td className={KKD_CELL}>
                    {row.validFrom}
                    {row.validTo ? ` → ${row.validTo}` : ' → ∞'}
                  </td>
                  <td className={KKD_CELL}>
                    <OpsStatusBadge tone={row.isActive ? 'active' : 'neutral'}>
                      {row.isActive ? 'Aktif' : 'Pasif'}
                    </OpsStatusBadge>
                  </td>
                  <td className={KKD_CELL}>
                    <div className="wms-ops-row-actions">
                      <button
                        type="button"
                        className="wms-ops-grid-icon-btn"
                        title="Düzenle"
                        aria-label="Düzenle"
                        onClick={() => edit(row)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--danger"
                        title="Sil"
                        aria-label="Sil"
                        disabled={row.consumedQuantity > 0 || remove.isPending}
                        onClick={() => {
                          if (window.confirm(`${row.employeeCode} / ${row.groupCode} ek hakkı silinsin mi?`)) {
                            remove.mutate(row.id);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </KkdTableShell>
        {list.data && list.data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--wms-app-border)] px-3 py-2 text-xs">
            <span>
              Sayfa {list.data.pageNumber} / {list.data.totalPages}
            </span>
            <div className="flex gap-2">
              <OpsActionButton
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Önceki
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="secondary"
                disabled={page >= list.data.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Sonraki
              </OpsActionButton>
            </div>
          </div>
        ) : null}
      </KkdPanel>
    </div>
  );
}
