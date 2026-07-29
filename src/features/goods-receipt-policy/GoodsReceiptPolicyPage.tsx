import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, PlugZap, Save, SlidersHorizontal, UsersRound, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import { userManagementApi } from '@/features/user-management/api/user-management.api';
import type { UserDetail, UserRow, WarehouseOption } from '@/features/user-management/types/user-management.types';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth-store';

type Policy = {
  id: number;
  branchCode: string;
  overReceiptPolicy: string;
  overReceiptTolerancePercent: number;
  allowUnderReceipt: boolean;
  requireShortCloseApproval: boolean;
  requireReceiptApproval: boolean;
  requireQualityApproval: boolean;
  requireErpApproval: boolean;
  holdInventoryUntilQualityDecision: boolean;
  blockPutawayUntilQualityDecision: boolean;
  inventoryAvailabilityPolicy: string;
  erpPostingPolicy: string;
  allowOrderlessReceipt: boolean;
  allowUnplannedReceipt: boolean;
  showAllocatedOpenOrderLines: boolean;
  locationSelectionPolicy: 'ReceivingOrStagingOnly' | 'AnyActiveWarehouseLocation';
};

type Envelope<T> = { success: boolean; data: T; message?: string };

const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};

export function GoodsReceiptPolicyPage() {
  const branch = useAuthStore((state) => state.branch?.code ?? '0');
  const { can } = usePermissionAccess();
  const [form, setForm] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingErp, setTestingErp] = useState(false);
  const [tab, setTab] = useState<'policy' | 'warehouses'>('policy');

  useEffect(() => {
    api.get<Envelope<Policy>>(`/api/goods-receipt-policy?branchCode=${encodeURIComponent(branch)}`)
      .then((value) => {
        const policy = unwrap(value);
        setForm({
          ...policy,
          showAllocatedOpenOrderLines: Boolean(policy.showAllocatedOpenOrderLines),
          locationSelectionPolicy:
            policy.locationSelectionPolicy === 'AnyActiveWarehouseLocation'
              ? 'AnyActiveWarehouseLocation'
              : 'ReceivingOrStagingOnly',
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Politika yüklenemedi.'));
  }, [branch]);

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(unwrap(await api.put<Envelope<Policy>>('/api/goods-receipt-policy', form)));
      toast.success('Mal kabul politikası kaydedildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const testErpLogin = async () => {
    setTestingErp(true);
    try {
      await goodsReceiptV2Api.testErpLogin();
      toast.success('Netsis REST login başarılı. Token güvenli biçimde alındı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Netsis REST login başarısız.');
    } finally {
      setTestingErp(false);
    }
  };

  if (!form) {
    return <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header>
        <div className="flex items-center gap-2 text-cyan-500">
          <SlidersHorizontal />
          <span className="text-xs font-bold uppercase tracking-widest">Mal Kabul</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">Mal Kabul Süreç Politikası</h1>
        <p className="text-sm text-slate-500">
          Fazla/eksik kabul, operasyon onayı, kalite kapısı, stok kullanılabilirliği ve ERP gönderim zamanını merkezi yönetin.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-2">
        <TabButton active={tab === 'policy'} onClick={() => setTab('policy')} icon={<SlidersHorizontal className="size-4" />}>
          Süreç Politikası
        </TabButton>
        <TabButton active={tab === 'warehouses'} onClick={() => setTab('warehouses')} icon={<UsersRound className="size-4" />}>
          Kullanıcı Depo Yetkileri
        </TabButton>
      </div>

      {tab === 'warehouses' ? (
        <UserWarehouseAssignmentsPanel branch={branch} canManage={can('WMS.GOODS_RECEIPT.SETTINGS.MANAGE')} />
      ) : <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fazla kabul">
            <AppDropdown
              value={form.overReceiptPolicy}
              onValueChange={(value) => {
                set('overReceiptPolicy', value);
                if (value === 'NotAllowed') set('overReceiptTolerancePercent', 0);
              }}
              options={[
                { value: 'NotAllowed', label: 'İzin verme' },
                { value: 'WithinTolerance', label: 'Tolerans içinde izin ver' },
                { value: 'ApprovalRequired', label: 'Tolerans içinde onaya gönder' },
              ]}
            />
          </Field>
          <Field label="Fazla kabul toleransı (%)">
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={form.overReceiptPolicy === 'NotAllowed'}
              value={form.overReceiptTolerancePercent}
              onChange={(event) => set('overReceiptTolerancePercent', Number(event.target.value))}
            />
          </Field>
          <Field label="Stok ne zaman kullanılabilir?">
            <AppDropdown
              value={form.inventoryAvailabilityPolicy}
              onValueChange={(value) => set('inventoryAvailabilityPolicy', value)}
              options={[
                ['Immediate', 'Kabulde hemen'],
                ['AfterReceiptApproval', 'Mal kabul onayından sonra'],
                ['AfterQualityApproval', 'Kalite onayından sonra'],
                ['AfterAllApprovals', 'Tüm onaylardan sonra'],
              ].map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="ERP kaydı ne zaman?">
            <AppDropdown
              value={form.erpPostingPolicy}
              onValueChange={(value) => set('erpPostingPolicy', value)}
              options={[
                ['AfterReceipt', 'Kabul tamamlanınca'],
                ['AfterReceiptApproval', 'Mal kabul onayından sonra'],
                ['AfterQualityApproval', 'Kalite onayından sonra'],
                ['AfterAllApprovals', 'Tüm onaylardan sonra'],
              ].map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Mal kabulde hangi raflar seçilebilir?">
            <AppDropdown
              value={form.locationSelectionPolicy}
              onValueChange={(value) => set(
                'locationSelectionPolicy',
                value === 'AnyActiveWarehouseLocation'
                  ? 'AnyActiveWarehouseLocation'
                  : 'ReceivingOrStagingOnly',
              )}
              options={[
                {
                  value: 'ReceivingOrStagingOnly',
                  label: 'Yalnızca kabul / staging alanları',
                },
                {
                  value: 'AnyActiveWarehouseLocation',
                  label: 'Seçilen depodaki tüm aktif raflar',
                },
              ]}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle label="Eksik kabule izin ver" value={form.allowUnderReceipt} set={(value) => set('allowUnderReceipt', value)} />
          <Toggle label="Eksik kapatmada onay iste" value={form.requireShortCloseApproval} set={(value) => set('requireShortCloseApproval', value)} />
          <Toggle label="Kabul sonrası operasyon onayı iste" value={form.requireReceiptApproval} set={(value) => set('requireReceiptApproval', value)} />
          <Toggle label="Kalite onayı iste" value={form.requireQualityApproval} set={(value) => set('requireQualityApproval', value)} />
          <Toggle label="ERP onayı iste" value={form.requireErpApproval} set={(value) => set('requireErpApproval', value)} />
          <Toggle label="Kalite kararına kadar stoğu beklet" value={form.holdInventoryUntilQualityDecision} set={(value) => set('holdInventoryUntilQualityDecision', value)} />
          <Toggle label="Kalite kararına kadar rafa kaldırmayı beklet" value={form.blockPutawayUntilQualityDecision} set={(value) => set('blockPutawayUntilQualityDecision', value)} />
          <Toggle label="Emirsiz kabule izin ver" value={form.allowOrderlessReceipt} set={(value) => set('allowOrderlessReceipt', value)} />
          <Toggle label="Plansız kabule izin ver" value={form.allowUnplannedReceipt} set={(value) => set('allowUnplannedReceipt', value)} />
          <Toggle
            label="Ayrılmış / gönderilmiş sipariş kalemlerini göster"
            value={form.showAllocatedOpenOrderLines}
            set={(value) => set('showAllocatedOpenOrderLines', value)}
          />
        </div>

        <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
          Bu ayarlar emir oluşturulurken başlığa snapshot olarak yazılır. Sonradan ayar değişse bile devam eden emir aynı kurallarla tamamlanır.
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {can('WMS.GOODS_RECEIPT.SETTINGS.MANAGE') ? (
            <button
              type="button"
              onClick={() => void testErpLogin()}
              disabled={testingErp}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 px-5 py-2.5 font-semibold text-cyan-700 disabled:opacity-50 dark:text-cyan-300"
            >
              {testingErp ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Netsis REST Login Testi
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Politikayı kaydet
          </button>
        </div>
      </div>}
    </section>
  );
}

function UserWarehouseAssignmentsPanel({ branch, canManage }: { branch: string; canManage: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [warehouseIds, setWarehouseIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUser, setLoadingUser] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      userManagementApi.getPaged({
        pageNumber: 1,
        pageSize: 500,
        search: null,
        sortBy: 'username',
        sortDirection: 'asc',
        filterLogic: 'and',
        filters: [{ column: 'isActive', operator: 'equals', value: 'true' }],
      }),
      userManagementApi.getWarehouses(branch),
    ]).then(([userPage, warehouseRows]) => {
      if (!active) return;
      setUsers(userPage.items);
      setWarehouses(warehouseRows);
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Kullanıcı ve depo listesi yüklenemedi.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [branch]);

  useEffect(() => {
    const userId = Number(selectedUserId || 0);
    if (!userId) {
      setDetail(null);
      setWarehouseIds([]);
      return;
    }
    let active = true;
    setLoadingUser(true);
    userManagementApi.getById(userId)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        setWarehouseIds(value.warehouseIds);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : 'Kullanıcı bilgisi yüklenemedi.');
      })
      .finally(() => {
        if (active) setLoadingUser(false);
      });
    return () => { active = false; };
  }, [selectedUserId]);

  const unrestrictedByRole = detail?.role === 'Admin' || detail?.role === 'superadmin';
  const save = async (): Promise<void> => {
    if (!detail || unrestrictedByRole) return;
    setSaving(true);
    try {
      const savedWarehouseIds = await userManagementApi.updateWarehouseAssignments(detail.id, warehouseIds);
      setWarehouseIds(savedWarehouseIds);
      setDetail({ ...detail, warehouseIds: savedWarehouseIds });
      toast.success(warehouseIds.length
        ? 'Kullanıcının mal kabul depoları güncellendi.'
        : 'Depo kısıtı kaldırıldı; kullanıcı tüm depolarda çalışabilir.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Depo yetkileri kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-600"><Warehouse className="size-5" /></span>
        <div>
          <h2 className="font-bold">Kullanıcıya göre mal kabul depoları</h2>
          <p className="text-sm text-slate-500">
            Tanım yoksa kullanıcı tüm depolarda çalışır. En az bir depo seçilirse yalnızca seçilen depolarda mal kabul yapabilir.
          </p>
        </div>
      </div>

      {loading ? <div className="grid min-h-44 place-items-center"><Loader2 className="animate-spin" /></div> : (
        <>
          <Field label="Kullanıcı">
            <AppDropdown
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              options={users.map((user) => ({
                value: String(user.id),
                label: `${`${user.firstName} ${user.lastName}`.trim() || user.username} · ${user.username}`,
                description: `${user.email} · ${user.role}`,
              }))}
              placeholder="Aktif kullanıcı seçin"
              searchable
            />
          </Field>

          {loadingUser ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin" /></div> : detail ? (
            <div className="mt-5 space-y-4">
              <div className={`rounded-xl border p-4 text-sm ${unrestrictedByRole || warehouseIds.length === 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-cyan-500/30 bg-cyan-500/10'}`}>
                <strong>{unrestrictedByRole ? 'Rol nedeniyle tüm depolar açık' : warehouseIds.length === 0 ? 'Tanım yok: tüm depolar açık' : `${warehouseIds.length} depo ile kısıtlı`}</strong>
                <p className="mt-1 text-xs text-slate-500">
                  {unrestrictedByRole
                    ? 'Admin ve SuperAdmin kullanıcıları depo atamalarından bağımsız olarak tüm depoları görür.'
                    : 'Bu kural sipariş seçimi, depo dropdownları ve mal kabul kaydı sırasında API tarafından da doğrulanır.'}
                </p>
              </div>

              <div className="grid max-h-[28rem] gap-2 overflow-auto sm:grid-cols-2">
                {warehouses.map((warehouse) => (
                  <label key={warehouse.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--wms-app-border)] p-3 hover:bg-[var(--wms-brand-soft)]">
                    <input
                      type="checkbox"
                      disabled={!canManage || unrestrictedByRole}
                      checked={!unrestrictedByRole && warehouseIds.includes(warehouse.id)}
                      onChange={() => setWarehouseIds((current) => current.includes(warehouse.id)
                        ? current.filter((id) => id !== warehouse.id)
                        : [...current, warehouse.id])}
                      className="mt-1 size-4"
                    />
                    <span>
                      <strong className="block text-sm">Depo {warehouse.warehouseCode}</strong>
                      <small className="text-slate-500">{warehouse.warehouseName}</small>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={!canManage || unrestrictedByRole || warehouseIds.length === 0 || saving}
                  onClick={() => setWarehouseIds([])}
                  className="rounded-xl border border-[var(--wms-app-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Kısıtı kaldır (tüm depolar)
                </button>
                <button
                  type="button"
                  disabled={!canManage || unrestrictedByRole || saving}
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Depo yetkilerini kaydet
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${active ? 'bg-cyan-600 text-white' : 'hover:bg-[var(--wms-brand-soft)]'}`}>
      {icon}{children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, set }: { label: string; value: boolean; set: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => set(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}
