import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, MapPin, PlugZap, Save, SlidersHorizontal, UsersRound, Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { ParameterFieldGuide, ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import type {
  LocationOption,
  WarehouseOption as GoodsReceiptWarehouseOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { userManagementApi } from '@/features/user-management/api/user-management.api';
import type { UserDetail, UserRow, WarehouseOption } from '@/features/user-management/types/user-management.types';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth-store';
import { parameterGuidance, parameterToggleGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';

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
  erpQualityGatePolicy: string;
  allowOrderlessReceipt: boolean;
  allowUnplannedReceipt: boolean;
  showAllocatedOpenOrderLines: boolean;
};

type Envelope<T> = { success: boolean; data: T; message?: string };

const POLICY = 'processPolicy.goodsReceipt';

export function GoodsReceiptPolicyPage() {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const branch = useAuthStore((state) => state.branch?.code ?? '0');
  const { can } = usePermissionAccess();
  const [form, setForm] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingErp, setTestingErp] = useState(false);
  const [tab, setTab] = useState<'policy' | 'defaults' | 'warehouses'>('policy');

  const unwrap = <T,>(value: Envelope<T>): T => {
    if (!value.success) throw new Error(value.message || t(`${POLICY}.operationFailed`));
    return value.data;
  };

  const overReceiptOptions = useMemo(
    () => ([
      { value: 'NotAllowed', label: t(`${POLICY}.overReceiptPolicy.NotAllowed`) },
      { value: 'WithinTolerance', label: t(`${POLICY}.overReceiptPolicy.WithinTolerance`) },
      { value: 'ApprovalRequired', label: t(`${POLICY}.overReceiptPolicy.ApprovalRequired`) },
    ] as const),
    [language, t],
  );

  const inventoryAvailabilityOptions = useMemo(
    () => ([
      'Immediate',
      'AfterReceiptApproval',
      'AfterQualityApproval',
      'AfterAllApprovals',
    ] as const).map((value) => ({
      value,
      label: t(`${POLICY}.inventoryAvailabilityPolicy.${value}`),
    })),
    [language, t],
  );

  const erpPostingOptions = useMemo(
    () => ([
      'AfterReceipt',
      'AfterReceiptApproval',
      'AfterQualityApproval',
      'AfterAllApprovals',
    ] as const).map((value) => ({
      value,
      label: t(`${POLICY}.erpPostingPolicy.${value}`),
    })),
    [language, t],
  );

  const erpQualityGateOptions = useMemo(
    () => ([
      'None',
      'RuleBasedOnly',
      'AnyQualityPlan',
    ] as const).map((value) => ({
      value,
      label: t(`${POLICY}.erpQualityGatePolicy.${value}`),
      description: t(`${POLICY}.erpQualityGatePolicy.${value}Hint`),
    })),
    [language, t],
  );

  useEffect(() => {
    api.get<Envelope<Policy>>(`/api/goods-receipt-policy?branchCode=${encodeURIComponent(branch)}`)
      .then((value) => {
        const policy = unwrap(value);
        setForm({
          ...policy,
          showAllocatedOpenOrderLines: Boolean(policy.showAllocatedOpenOrderLines),
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : t(`${POLICY}.loadError`)));
  }, [branch, t]);

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(unwrap(await api.put<Envelope<Policy>>('/api/goods-receipt-policy', form)));
      toast.success(t(`${POLICY}.saveSuccess`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${POLICY}.saveError`));
    } finally {
      setSaving(false);
    }
  };

  const testErpLogin = async () => {
    setTestingErp(true);
    try {
      await goodsReceiptV2Api.testErpLogin();
      toast.success(t(`${POLICY}.testErpLoginSuccess`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${POLICY}.testErpLoginError`));
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
          <span className="text-xs font-bold uppercase tracking-widest">{t(`${POLICY}.eyebrow`)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{t(`${POLICY}.title`)}</h1>
        <p className="text-sm text-slate-500">{t(`${POLICY}.description`)}</p>
      </header>

      <ParameterPageGuide
        translationKey="goodsReceipt"
        title="Mal kabul ayar rehberi"
        description="Her parametrenin mevcut sonucunu, stok ve ERP üzerindeki etkisini ve örnek mal kabul senaryosunu alanın hemen altında inceleyebilirsiniz."
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-2">
        <TabButton active={tab === 'policy'} onClick={() => setTab('policy')} icon={<SlidersHorizontal className="size-4" />}>
          {t(`${POLICY}.tabs.policy`)}
        </TabButton>
        <TabButton active={tab === 'warehouses'} onClick={() => setTab('warehouses')} icon={<UsersRound className="size-4" />}>
          {t(`${POLICY}.tabs.warehouses`)}
        </TabButton>
        <TabButton active={tab === 'defaults'} onClick={() => setTab('defaults')} icon={<MapPin className="size-4" />}>
          {t(`${POLICY}.tabs.defaults`)}
        </TabButton>
      </div>

      {tab === 'warehouses' ? (
        <UserWarehouseAssignmentsPanel branch={branch} canManage={can('WMS.GOODS_RECEIPT.SETTINGS.MANAGE')} />
      ) : tab === 'defaults' ? (
        <WarehouseDefaultLocationsPanel
          branch={branch}
          canManage={can('WMS.GOODS_RECEIPT.SETTINGS.MANAGE')}
        />
      ) : <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t(`${POLICY}.fields.overReceipt`)} guideKey="overReceiptPolicy" value={form.overReceiptPolicy} currentValue={overReceiptOptions.find((x) => x.value === form.overReceiptPolicy)?.label}>
            <AppDropdown
              value={form.overReceiptPolicy}
              onValueChange={(value) => {
                set('overReceiptPolicy', value);
                if (value === 'NotAllowed') set('overReceiptTolerancePercent', 0);
              }}
              options={[...overReceiptOptions]}
            />
          </Field>
          <Field label={t(`${POLICY}.fields.overReceiptTolerance`)} guideKey="overReceiptTolerancePercent" value={form.overReceiptTolerancePercent} currentValue={`%${form.overReceiptTolerancePercent}`}>
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
          <Field label={t(`${POLICY}.fields.inventoryAvailability`)} guideKey="inventoryAvailabilityPolicy" value={form.inventoryAvailabilityPolicy} currentValue={inventoryAvailabilityOptions.find((x) => x.value === form.inventoryAvailabilityPolicy)?.label}>
            <AppDropdown
              value={form.inventoryAvailabilityPolicy}
              onValueChange={(value) => set('inventoryAvailabilityPolicy', value)}
              options={inventoryAvailabilityOptions}
            />
          </Field>
          <Field label={t(`${POLICY}.fields.erpPosting`)} guideKey="erpPostingPolicy" value={form.erpPostingPolicy} currentValue={erpPostingOptions.find((x) => x.value === form.erpPostingPolicy)?.label}>
            <AppDropdown
              value={form.erpPostingPolicy}
              onValueChange={(value) => set('erpPostingPolicy', value)}
              options={erpPostingOptions}
            />
          </Field>
          <Field label={t(`${POLICY}.erpQualityGatePolicy.title`)} guideKey="erpQualityGatePolicy" value={form.erpQualityGatePolicy} currentValue={erpQualityGateOptions.find((x) => x.value === form.erpQualityGatePolicy)?.label}>
            <AppDropdown
              value={form.erpQualityGatePolicy}
              onValueChange={(value) => set('erpQualityGatePolicy', value)}
              options={erpQualityGateOptions}
            />
            <p className="mt-1 text-xs text-slate-500">
              {t(`${POLICY}.erpQualityGatePolicy.currentHint`, {
                value: t(`${POLICY}.erpQualityGatePolicy.${form.erpQualityGatePolicy}`),
              })}
            </p>
          </Field>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle guideKey="allowUnderReceipt" label={t(`${POLICY}.toggles.allowUnderReceipt`)} value={form.allowUnderReceipt} set={(value) => set('allowUnderReceipt', value)} />
          <Toggle guideKey="requireShortCloseApproval" label={t(`${POLICY}.toggles.requireShortCloseApproval`)} value={form.requireShortCloseApproval} set={(value) => set('requireShortCloseApproval', value)} />
          <Toggle guideKey="requireReceiptApproval" label={t(`${POLICY}.toggles.requireReceiptApproval`)} value={form.requireReceiptApproval} set={(value) => set('requireReceiptApproval', value)} />
          <Toggle guideKey="requireQualityApproval" label={t(`${POLICY}.toggles.requireQualityApproval`)} value={form.requireQualityApproval} set={(value) => set('requireQualityApproval', value)} />
          <Toggle guideKey="requireErpApproval" label={t(`${POLICY}.toggles.requireErpApproval`)} value={form.requireErpApproval} set={(value) => set('requireErpApproval', value)} />
          <Toggle guideKey="holdInventoryUntilQualityDecision" label={t(`${POLICY}.toggles.holdInventoryUntilQualityDecision`)} value={form.holdInventoryUntilQualityDecision} set={(value) => set('holdInventoryUntilQualityDecision', value)} />
          <div>
            <Toggle
              guideKey="blockPutawayUntilQualityDecision"
              label={t(`${POLICY}.toggles.blockPutawayUntilQualityDecision`)}
              value={form.blockPutawayUntilQualityDecision}
              set={(value) => set('blockPutawayUntilQualityDecision', value)}
            />
            <p className="mt-1 px-3 text-xs text-slate-500">
              {t(`${POLICY}.toggles.blockPutawayHint`)}
            </p>
          </div>
          <Toggle guideKey="allowOrderlessReceipt" label={t(`${POLICY}.toggles.allowOrderlessReceipt`)} value={form.allowOrderlessReceipt} set={(value) => set('allowOrderlessReceipt', value)} />
          <Toggle guideKey="allowUnplannedReceipt" label={t(`${POLICY}.toggles.allowUnplannedReceipt`)} value={form.allowUnplannedReceipt} set={(value) => set('allowUnplannedReceipt', value)} />
          <Toggle
            guideKey="showAllocatedOpenOrderLines"
            label={t(`${POLICY}.toggles.showAllocatedOpenOrderLines`)}
            value={form.showAllocatedOpenOrderLines}
            set={(value) => set('showAllocatedOpenOrderLines', value)}
          />
        </div>

        <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
          {t(`${POLICY}.snapshotNote`)}
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
              {t(`${POLICY}.testErpLogin`)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t(`${POLICY}.save`)}
          </button>
        </div>
      </div>}
    </section>
  );
}

function WarehouseDefaultLocationsPanel({
  branch,
  canManage,
}: {
  branch: string;
  canManage: boolean;
}) {
  const { t } = useTranslation('common');
  const [warehouses, setWarehouses] = useState<GoodsReceiptWarehouseOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void goodsReceiptV2Api.warehouses({
      pageNumber: 1,
      pageSize: 500,
      search: undefined,
      filterLogic: 'and',
      filters: [],
      sortBy: 'warehouseCode',
      sortDirection: 'asc',
      signal: new AbortController().signal,
    }, branch).then((page) => {
      if (!active) return;
      setWarehouses(page.items);
      const first = page.items[0];
      setWarehouseId(first ? String(first.id) : null);
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : t(`${POLICY}.defaults.warehousesLoadError`));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [branch, t]);

  useEffect(() => {
    const selectedWarehouseId = Number(warehouseId || 0);
    const selectedWarehouse = warehouses.find((item) => item.id === selectedWarehouseId);
    setLocationId(selectedWarehouse?.defaultGoodsReceiptLocationId
      ? String(selectedWarehouse.defaultGoodsReceiptLocationId)
      : 'none');
    setLocations([]);
    if (!selectedWarehouseId) return;
    let active = true;
    setLocationsLoading(true);
    void goodsReceiptV2Api.locations({
      pageNumber: 1,
      pageSize: 500,
      search: undefined,
      filterLogic: 'and',
      filters: [],
      sortBy: 'code',
      sortDirection: 'asc',
      signal: new AbortController().signal,
    }, selectedWarehouseId).then((page) => {
      if (active) setLocations(page.items);
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : t(`${POLICY}.defaults.locationsLoadError`));
    }).finally(() => {
      if (active) setLocationsLoading(false);
    });
    return () => { active = false; };
  }, [warehouseId, warehouses, t]);

  const save = async (): Promise<void> => {
    const selectedWarehouseId = Number(warehouseId || 0);
    if (!selectedWarehouseId || !canManage) return;
    setSaving(true);
    try {
      const result = await goodsReceiptV2Api.updateWarehouseDefaultLocation({
        branchCode: branch,
        warehouseId: selectedWarehouseId,
        defaultLocationId: locationId === 'none' ? undefined : Number(locationId),
      });
      setWarehouses((current) => current.map((item) => item.id === result.warehouseId
        ? { ...item, defaultGoodsReceiptLocationId: result.defaultLocationId }
        : item));
      toast.success(result.defaultLocationCode
        ? t(`${POLICY}.defaults.saveSuccessWithLocation`, {
          warehouseCode: result.warehouseCode,
          locationCode: result.defaultLocationCode,
        })
        : t(`${POLICY}.defaults.saveSuccessRemoved`, { warehouseCode: result.warehouseCode }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${POLICY}.defaults.saveError`));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-600"><MapPin className="size-5" /></span>
        <div>
          <h2 className="font-bold">{t(`${POLICY}.defaults.title`)}</h2>
          <p className="text-sm text-slate-500">{t(`${POLICY}.defaults.description`)}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t(`${POLICY}.fields.warehouse`)} guideKey="warehouseDefaultWarehouse" value={warehouseId} currentValue={warehouses.find((x) => String(x.id) === warehouseId)?.warehouseName ?? warehouseId ?? undefined}>
          <AppDropdown
            value={warehouseId}
            onValueChange={setWarehouseId}
            options={warehouses.map((item) => ({
              value: String(item.id),
              label: `${item.warehouseCode} · ${item.warehouseName}`,
            }))}
          />
        </Field>
        <Field label={t(`${POLICY}.fields.defaultLocation`)} guideKey="warehouseDefaultLocation" value={locationId} currentValue={locations.find((x) => String(x.id) === locationId)?.name ?? locationId}>
          <AppDropdown
            value={locationId}
            onValueChange={setLocationId}
            disabled={!warehouseId || locationsLoading}
            options={[
              { value: 'none', label: t(`${POLICY}.defaults.noDefaultLocation`) },
              ...locations.map((item) => ({
                value: String(item.id),
                label: `${item.code} · ${item.name}`,
                description: item.locationType,
              })),
            ]}
          />
        </Field>
      </div>
      <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
        {t(`${POLICY}.defaults.policyNote`)}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canManage || saving || !warehouseId || locationsLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t(`${POLICY}.defaults.save`)}
        </button>
      </div>
    </div>
  );
}

function UserWarehouseAssignmentsPanel({ branch, canManage }: { branch: string; canManage: boolean }) {
  const { t } = useTranslation('common');
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
      if (active) toast.error(error instanceof Error ? error.message : t(`${POLICY}.warehouses.loadError`));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [branch, t]);

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
        if (active) toast.error(error instanceof Error ? error.message : t(`${POLICY}.warehouses.userLoadError`));
      })
      .finally(() => {
        if (active) setLoadingUser(false);
      });
    return () => { active = false; };
  }, [selectedUserId, t]);

  const unrestrictedByRole = detail?.role === 'Admin' || detail?.role === 'superadmin';
  const save = async (): Promise<void> => {
    if (!detail || unrestrictedByRole) return;
    setSaving(true);
    try {
      const savedWarehouseIds = await userManagementApi.updateWarehouseAssignments(detail.id, warehouseIds);
      setWarehouseIds(savedWarehouseIds);
      setDetail({ ...detail, warehouseIds: savedWarehouseIds });
      toast.success(warehouseIds.length
        ? t(`${POLICY}.warehouses.saveSuccessAssigned`)
        : t(`${POLICY}.warehouses.saveSuccessUnrestricted`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${POLICY}.warehouses.saveError`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-600"><Warehouse className="size-5" /></span>
        <div>
          <h2 className="font-bold">{t(`${POLICY}.warehouses.title`)}</h2>
          <p className="text-sm text-slate-500">{t(`${POLICY}.warehouses.description`)}</p>
        </div>
      </div>

      {loading ? <div className="grid min-h-44 place-items-center"><Loader2 className="animate-spin" /></div> : (
        <>
          <Field label={t(`${POLICY}.fields.user`)} guideKey="assignmentUser" value={selectedUserId} currentValue={(() => { const selected = users.find((x) => String(x.id) === selectedUserId); return selected ? `${selected.firstName ?? ''} ${selected.lastName ?? ''}`.trim() || selected.username || undefined : selectedUserId ?? undefined; })()}>
            <AppDropdown
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              options={users.map((user) => ({
                value: String(user.id),
                label: `${`${user.firstName} ${user.lastName}`.trim() || user.username} · ${user.username}`,
                description: `${user.email} · ${user.role}`,
              }))}
              placeholder={t(`${POLICY}.warehouses.selectUserPlaceholder`)}
              searchable
            />
          </Field>

          {loadingUser ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin" /></div> : detail ? (
            <div className="mt-5 space-y-4">
              <div className={`rounded-xl border p-4 text-sm ${unrestrictedByRole || warehouseIds.length === 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-cyan-500/30 bg-cyan-500/10'}`}>
                <strong>
                  {unrestrictedByRole
                    ? t(`${POLICY}.warehouses.statusAllByRole`)
                    : warehouseIds.length === 0
                      ? t(`${POLICY}.warehouses.statusAllOpen`)
                      : t(`${POLICY}.warehouses.statusRestricted`, { count: warehouseIds.length })}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {unrestrictedByRole
                    ? t(`${POLICY}.warehouses.hintAllByRole`)
                    : t(`${POLICY}.warehouses.hintRestricted`)}
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
                      <strong className="block text-sm">{t(`${POLICY}.warehouses.warehouseLabel`, { code: warehouse.warehouseCode })}</strong>
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
                  {t(`${POLICY}.warehouses.clearRestriction`)}
                </button>
                <button
                  type="button"
                  disabled={!canManage || unrestrictedByRole || saving}
                  onClick={() => void save()}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t(`${POLICY}.warehouses.save`)}
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

function Field({ label, children, guideKey, value, currentValue }: { label: string; children: ReactNode; guideKey?: string; value?: unknown; currentValue?: string }) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {guideKey ? <ParameterFieldGuide guidance={parameterGuidance('goodsReceipt', guideKey, value)} currentValue={currentValue} /> : null}
    </div>
  );
}

function Toggle({ label, value, set, guideKey }: { label: string; value: boolean; set: (value: boolean) => void; guideKey: string }) {
  return <ParameterToggleCard title={label} checked={value} onCheckedChange={set} guidance={parameterToggleGuidance('goodsReceipt', guideKey)} />;
}
