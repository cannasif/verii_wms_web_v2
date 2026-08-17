import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Plus, Save, ShieldCheck, Star, Trash2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ParameterFieldGuide, ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeEnumValue } from '@/lib/enum-localization';
import { useAuthStore } from '@/stores/auth-store';
import { qualityApi, type QualityParameter, type QualityQuarantineDestination, type QualityWarehouseRoute } from '../api/quality.api';
import { parameterGuidance, parameterToggleGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';

export function QualitySettingsPage() {
  const { t } = useModuleTranslation('quality');
  const branch = useAuthStore((s) => s.branch?.code ?? '0');
  const [form, setForm] = useState<QualityParameter | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    qualityApi.getParameters(branch)
      .then((value) => setForm({ ...value, quarantineDestinations: value.quarantineDestinations ?? [], warehouseRoutes: value.warehouseRoutes ?? [] }))
      .catch((e) => toast.error(e.message));
  }, [branch]);

  const set = <K extends keyof QualityParameter>(k: K, v: QualityParameter[K]) =>
    setForm((x) => (x ? { ...x, [k]: v } : x));

  const save = async () => {
    if (!form) return;
    const destinations = form.quarantineDestinations ?? [];
    if (destinations.some((destination) => destination.locationId <= 0)) {
      toast.error(t('settings.locationsSection.destinationRequired'));
      return;
    }
    if (new Set(destinations.map((destination) => destination.locationId)).size !== destinations.length) {
      toast.error(t('settings.locationsSection.destinationDuplicate'));
      return;
    }
    const routes = form.warehouseRoutes ?? [];
    if (routes.some((route) => route.sourceWarehouseId <= 0)) {
      toast.error(t('settings.locationsSection.routeWarehouseRequired'));
      return;
    }
    if (new Set(routes.map((route) => route.sourceWarehouseId)).size !== routes.length) {
      toast.error(t('settings.locationsSection.routeWarehouseDuplicate'));
      return;
    }
    if (routes.some((route) => !route.qualityLocationId && !route.acceptedLocationId && !route.quarantineLocationId && !route.rejectLocationId)) {
      toast.error(t('settings.locationsSection.routeTargetRequired'));
      return;
    }
    const defaultQuarantineLocationId = destinations.some(
      (destination) => destination.locationId === form.defaultQuarantineLocationId,
    )
      ? form.defaultQuarantineLocationId
      : destinations[0]?.locationId ?? null;
    setSaving(true);
    try {
      setForm(await qualityApi.updateParameters({
        ...form,
        defaultQuarantineLocationId,
        quarantineDestinations: destinations.map((destination, index) => ({
          ...destination,
          priority: Math.max(1, Math.min(9999, Number(destination.priority) || (index + 1) * 100)),
          isActive: true,
        })),
      }));
      toast.success(t('settings.toast.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settings.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="grid min-h-72 place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <Header eyebrow={t('settings.eyebrow')} title={t('settings.title')} text={t('settings.description')} />
      <ParameterPageGuide translationKey="quality" title="Kalite ayar rehberi" description="Kontrol tipinin, başarısız sonuç davranışının, bekleme raflarının ve stok/ERP blokajlarının etkisini örneklerle açıklar." />
      <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('settings.defaultInspectionModeLabel')} guideKey="defaultInspectionMode" value={form.defaultInspectionMode} currentValue={localizeEnumValue(form.defaultInspectionMode)}>
            <AppDropdown
              value={form.defaultInspectionMode}
              onValueChange={(v) => set('defaultInspectionMode', v)}
              options={['NoCheck', 'QuickCheck', 'InspectionRequired'].map((value) => ({
                value,
                label: localizeEnumValue(value),
              }))}
            />
          </Field>
          <Field label={t('settings.defaultFailActionLabel')} guideKey="defaultFailAction" value={form.defaultFailAction} currentValue={localizeEnumValue(form.defaultFailAction)}>
            <AppDropdown
              value={form.defaultFailAction}
              onValueChange={(v) => set('defaultFailAction', v)}
              options={['Quarantine', 'Reject', 'ReturnToSupplier', 'ManagerApproval'].map((value) => ({
                value,
                label: localizeEnumValue(value),
              }))}
            />
          </Field>
        </div>

        <section className="mt-5 rounded-xl border border-[var(--wms-app-border)] p-4">
          <h2 className="font-bold">{t('settings.locationsSection.title')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('settings.locationsSection.description')}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <LocationField
              label={t('settings.locationsSection.qualityLocationLabel')}
              placeholder={t('settings.locationsSection.locationPlaceholder')}
              branch={branch}
              value={form.defaultQualityLocationId}
              set={(value) => set('defaultQualityLocationId', value)}
              guideKey="defaultQualityLocationId"
            />
            <LocationField
              label={t('settings.locationsSection.acceptedLocationLabel')}
              placeholder={t('settings.locationsSection.locationPlaceholder')}
              branch={branch}
              value={form.defaultAcceptedLocationId}
              set={(value) => set('defaultAcceptedLocationId', value)}
              putawayOnly
              disabled
              hint={t('settings.locationsSection.acceptedLocationDisabledHint')}
              guideKey="defaultAcceptedLocationId"
            />
            <LocationField
              label={t('settings.locationsSection.rejectLocationLabel')}
              placeholder={t('settings.locationsSection.locationPlaceholder')}
              branch={branch}
              value={form.defaultRejectLocationId}
              set={(value) => set('defaultRejectLocationId', value)}
              quarantineOnly
              guideKey="defaultRejectLocationId"
            />
          </div>
          <QuarantineDestinationsField
            branch={branch}
            destinations={form.quarantineDestinations ?? []}
            defaultLocationId={form.defaultQuarantineLocationId}
            onChange={(destinations) => set('quarantineDestinations', destinations)}
            onDefaultChange={(locationId) => set('defaultQuarantineLocationId', locationId)}
          />
          <WarehouseRoutesField
            branch={branch}
            routes={form.warehouseRoutes ?? []}
            onChange={(routes) => set('warehouseRoutes', routes)}
          />
        </section>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle guideKey="autoCreateInspectionOnReceipt" label={t('settings.toggles.autoCreateInspection')} value={form.autoCreateInspectionOnReceipt} set={(v) => set('autoCreateInspectionOnReceipt', v)} />
          <Toggle guideKey="holdInventoryUntilDecision" label={t('settings.toggles.holdInventory')} value={form.holdInventoryUntilDecision} set={(v) => set('holdInventoryUntilDecision', v)} />
          <Toggle guideKey="blockPutawayUntilDecision" label={t('settings.toggles.blockPutaway')} value={form.blockPutawayUntilDecision} set={(v) => set('blockPutawayUntilDecision', v)} />
          <Toggle guideKey="blockErpPostingUntilDecision" label={t('settings.toggles.blockErpPosting')} value={form.blockErpPostingUntilDecision} set={(v) => set('blockErpPostingUntilDecision', v)} />
          <Toggle guideKey="requireManagerApprovalForRelease" label={t('settings.toggles.requireManagerApproval')} value={form.requireManagerApprovalForRelease} set={(v) => set('requireManagerApprovalForRelease', v)} />
          <Toggle guideKey="allowPartialDecision" label={t('settings.toggles.allowPartialDecision')} value={form.allowPartialDecision} set={(v) => set('allowPartialDecision', v)} />
          <Toggle guideKey="allowDirectReceiptWhenNoRule" label={t('settings.toggles.allowDirectReceipt')} value={form.allowDirectReceiptWhenNoRule} set={(v) => set('allowDirectReceiptWhenNoRule', v)} />
          <Toggle guideKey="blockReceiptWhenLotMissing" label={t('settings.toggles.blockWhenLotMissing')} value={form.blockReceiptWhenLotMissing} set={(v) => set('blockReceiptWhenLotMissing', v)} />
          <Toggle guideKey="blockReceiptWhenSerialMissing" label={t('settings.toggles.blockWhenSerialMissing')} value={form.blockReceiptWhenSerialMissing} set={(v) => set('blockReceiptWhenSerialMissing', v)} />
          <Toggle guideKey="blockReceiptWhenExpiryMissing" label={t('settings.toggles.blockWhenExpiryMissing')} value={form.blockReceiptWhenExpiryMissing} set={(v) => set('blockReceiptWhenExpiryMissing', v)} />
        </div>

        <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600">
          {t('settings.holdNotice')}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('settings.saveButton')}
          </button>
        </div>
      </div>
    </section>
  );
}

function Header({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <header>
      <div className="flex items-center gap-2 text-cyan-500">
        <ShieldCheck />
        <span className="text-xs font-bold uppercase tracking-widest">{eyebrow}</span>
      </div>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="text-sm text-slate-500">{text}</p>
    </header>
  );
}

function Field({ label, children, guideKey, value, currentValue }: { label: string; children: ReactNode; guideKey?: string; value?: unknown; currentValue?: string }) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {guideKey ? <ParameterFieldGuide guidance={parameterGuidance('quality', guideKey, value)} currentValue={currentValue} /> : null}
    </div>
  );
}

function QuarantineDestinationsField({
  branch,
  destinations,
  defaultLocationId,
  onChange,
  onDefaultChange,
}: {
  branch: string;
  destinations: QualityQuarantineDestination[];
  defaultLocationId: number | null;
  onChange: (value: QualityQuarantineDestination[]) => void;
  onDefaultChange: (value: number | null) => void;
}) {
  const { t } = useModuleTranslation('quality');
  const selectedIds = new Set(destinations.map((destination) => destination.locationId).filter(Boolean));
  const patch = (index: number, value: Partial<QualityQuarantineDestination>) =>
    onChange(destinations.map((destination, current) => current === index ? { ...destination, ...value } : destination));
  const remove = (index: number) => {
    const removed = destinations[index];
    const next = destinations.filter((_, current) => current !== index);
    onChange(next);
    if (removed?.locationId === defaultLocationId) {
      onDefaultChange(next.find((destination) => destination.locationId > 0)?.locationId ?? null);
    }
  };
  const add = () => onChange([
    ...destinations,
    {
      id: 0,
      locationId: 0,
      warehouseId: 0,
      warehouseCode: 0,
      warehouseName: '',
      locationCode: '',
      locationName: '',
      priority: (destinations.length + 1) * 100,
      isDefault: false,
      isActive: true,
    },
  ]);

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{t('settings.locationsSection.quarantineLocationsLabel')}</h3>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            {t('settings.locationsSection.quarantineLocationsDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/35 px-3 py-2 text-xs font-bold text-cyan-600 hover:bg-cyan-500/10"
        >
          <Plus className="size-4" /> {t('settings.locationsSection.addQuarantineLocation')}
        </button>
      </div>

      {destinations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--wms-app-border)] p-4 text-sm text-slate-500">
          {t('settings.locationsSection.noQuarantineLocations')}
        </div>
      ) : (
        <div className="space-y-2">
          {destinations.map((destination, index) => {
            const isDefault = destination.locationId > 0 && destination.locationId === defaultLocationId;
            return (
              <div key={`${destination.id || 'new'}-${index}`} className="grid gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3 lg:grid-cols-[minmax(0,1fr)_8rem_auto_auto] lg:items-end">
                <label className="space-y-1.5 text-sm">
                  <span className="font-semibold">{t('settings.locationsSection.quarantineLocationLabel')}</span>
                  <PagedAppDropdown
                    queryKey={['quality-quarantine-locations', branch, index]}
                    fetchPage={(request) => qualityApi.locations(request, branch)}
                    toOption={(location) => ({
                      value: String(location.id),
                      label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
                      description: location.warehouseName,
                      disabled: !location.isQuarantine || (selectedIds.has(location.id) && location.id !== destination.locationId),
                    })}
                    selectedOption={destination.locationId > 0 && destination.locationCode ? {
                      value: String(destination.locationId),
                      label: `${destination.warehouseCode} / ${destination.locationCode} · ${destination.locationName}`,
                      description: destination.warehouseName,
                    } : undefined}
                    value={destination.locationId > 0 ? String(destination.locationId) : null}
                    onValueChange={(next) => {
                      const locationId = next ? Number(next) : 0;
                      patch(index, { locationId });
                      if (!defaultLocationId || destination.locationId === defaultLocationId) {
                        onDefaultChange(locationId || null);
                      }
                    }}
                    placeholder={t('settings.locationsSection.locationPlaceholder')}
                    searchable
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-semibold">{t('settings.locationsSection.priorityLabel')}</span>
                  <AppInput
                    type="number"
                    min={1}
                    max={9999}
                    value={destination.priority}
                    onChange={(event) => patch(index, { priority: Number(event.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  disabled={destination.locationId <= 0}
                  onClick={() => onDefaultChange(destination.locationId)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold ${isDefault ? 'border-amber-400/50 bg-amber-400/10 text-amber-600' : 'border-[var(--wms-app-border)] text-slate-500 hover:bg-slate-500/10'}`}
                >
                  <Star className={`size-4 ${isDefault ? 'fill-current' : ''}`} />
                  {isDefault ? t('settings.locationsSection.defaultBadge') : t('settings.locationsSection.makeDefault')}
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={t('settings.locationsSection.removeLocation')}
                  className="inline-flex size-10 items-center justify-center rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <ParameterFieldGuide
        guidance={parameterGuidance('quality', 'defaultQuarantineLocationId', defaultLocationId)}
        currentValue={destinations.length > 0 ? t('settings.locationsSection.destinationCount', { count: destinations.length }) : t('settings.locationsSection.noSelection')}
      />
    </div>
  );
}

function WarehouseRoutesField({
  branch,
  routes,
  onChange,
}: {
  branch: string;
  routes: QualityWarehouseRoute[];
  onChange: (value: QualityWarehouseRoute[]) => void;
}) {
  const { t } = useModuleTranslation('quality');
  const selectedWarehouseIds = new Set(routes.map((route) => route.sourceWarehouseId).filter(Boolean));
  const patch = (index: number, value: Partial<QualityWarehouseRoute>) =>
    onChange(routes.map((route, current) => current === index ? { ...route, ...value } : route));
  const add = () => onChange([...routes, {
    id: 0,
    sourceWarehouseId: 0,
    sourceWarehouseCode: 0,
    sourceWarehouseName: '',
    qualityLocationId: null,
    acceptedLocationId: null,
    quarantineLocationId: null,
    rejectLocationId: null,
    qualityLocation: null,
    acceptedLocation: null,
    quarantineLocation: null,
    rejectLocation: null,
    isActive: true,
  }]);

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Warehouse className="size-4 text-violet-500" />
            <h3 className="text-sm font-bold">{t('settings.locationsSection.warehouseRoutesTitle')}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t('settings.locationsSection.warehouseRoutesDescription')}
          </p>
        </div>
        <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl border border-violet-500/35 px-3 py-2 text-xs font-bold text-violet-600 hover:bg-violet-500/10">
          <Plus className="size-4" /> {t('settings.locationsSection.addWarehouseRoute')}
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--wms-app-border)] p-4 text-sm text-slate-500">
          {t('settings.locationsSection.noWarehouseRoutes')}
        </div>
      ) : routes.map((route, index) => (
        <article key={`${route.id || 'new'}-${index}`} className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4">
          <div className="flex items-start justify-between gap-3">
            <label className="w-full max-w-xl space-y-1.5 text-sm">
              <span className="font-semibold">{t('settings.locationsSection.sourceWarehouseLabel')}</span>
              <PagedAppDropdown
                queryKey={['quality-route-warehouses', branch, index]}
                fetchPage={(request) => qualityApi.warehouses(request, branch)}
                toOption={(warehouse) => ({
                  value: String(warehouse.id),
                  label: `${warehouse.warehouseCode} · ${warehouse.warehouseName}`,
                  disabled: selectedWarehouseIds.has(warehouse.id) && warehouse.id !== route.sourceWarehouseId,
                })}
                selectedOption={route.sourceWarehouseId > 0 && (route.sourceWarehouseCode > 0 || route.sourceWarehouseName) ? {
                  value: String(route.sourceWarehouseId),
                  label: `${route.sourceWarehouseCode} · ${route.sourceWarehouseName}`,
                } : undefined}
                value={route.sourceWarehouseId > 0 ? String(route.sourceWarehouseId) : null}
                onValueChange={(next) => patch(index, {
                  sourceWarehouseId: next ? Number(next) : 0,
                  sourceWarehouseCode: 0,
                  sourceWarehouseName: '',
                  qualityLocationId: null,
                  qualityLocation: null,
                })}
                placeholder={t('settings.locationsSection.warehousePlaceholder')}
                searchable
              />
            </label>
            <button type="button" onClick={() => onChange(routes.filter((_, current) => current !== index))} aria-label={t('settings.locationsSection.removeWarehouseRoute')} className="mt-6 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10">
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <RouteLocationField branch={branch} route={route} kind="quality" label={t('settings.locationsSection.qualityLocationLabel')} warehouseId={route.sourceWarehouseId || null} onChange={(locationId) => patch(index, { qualityLocationId: locationId, qualityLocation: null })} />
            <RouteLocationField branch={branch} route={route} kind="accepted" label={t('settings.locationsSection.acceptedLocationLabel')} disabled hint={t('settings.locationsSection.acceptedLocationDisabledHint')} onChange={(locationId) => patch(index, { acceptedLocationId: locationId, acceptedLocation: null })} />
            <RouteLocationField branch={branch} route={route} kind="quarantine" label={t('settings.locationsSection.quarantineLocationLabel')} onChange={(locationId) => patch(index, { quarantineLocationId: locationId, quarantineLocation: null })} />
            <RouteLocationField branch={branch} route={route} kind="reject" label={t('settings.locationsSection.rejectLocationLabel')} onChange={(locationId) => patch(index, { rejectLocationId: locationId, rejectLocation: null })} />
          </div>
          <p className="mt-3 rounded-lg bg-violet-500/10 px-3 py-2 text-xs leading-5 text-violet-700 dark:text-violet-300">
            {t('settings.locationsSection.routeFallbackNotice')}
          </p>
        </article>
      ))}
    </div>
  );
}

function RouteLocationField({
  branch,
  route,
  kind,
  label,
  warehouseId,
  onChange,
  disabled = false,
  hint,
}: {
  branch: string;
  route: QualityWarehouseRoute;
  kind: 'quality' | 'accepted' | 'quarantine' | 'reject';
  label: string;
  warehouseId?: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const { t } = useModuleTranslation('quality');
  const idKey = `${kind}LocationId` as const;
  const destinationKey = `${kind}Location` as const;
  const locationId = route[idKey];
  const destination = route[destinationKey];
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <PagedAppDropdown
        queryKey={['quality-route-locations', branch, route.sourceWarehouseId, kind]}
        fetchPage={(request) => qualityApi.locations(request, branch, warehouseId)}
        toOption={(location) => ({
          value: String(location.id),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.warehouseName,
          disabled: kind === 'quality' ? location.isPickable
            : kind === 'accepted' ? !location.isPutaway || location.isQuarantine
              : !location.isQuarantine,
        })}
        selectedOption={locationId && destination ? {
          value: String(locationId),
          label: `${destination.warehouseCode} / ${destination.locationCode} · ${destination.locationName}`,
          description: destination.warehouseName,
        } : undefined}
        value={locationId ? String(locationId) : null}
        onValueChange={(next) => onChange(next ? Number(next) : null)}
        placeholder={kind === 'quality' && route.sourceWarehouseId <= 0
          ? t('settings.locationsSection.selectWarehouseFirst')
          : t('settings.locationsSection.inheritPlaceholder')}
        disabled={disabled || (kind === 'quality' && route.sourceWarehouseId <= 0)}
        searchable
      />
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Toggle({ label, value, set, guideKey }: { label: string; value: boolean; set: (v: boolean) => void; guideKey: string }) {
  return <ParameterToggleCard title={label} checked={value} onCheckedChange={set} guidance={parameterToggleGuidance('quality', guideKey)} />;
}

function LocationField({
  label,
  placeholder,
  branch,
  value,
  set,
  quarantineOnly = false,
  putawayOnly = false,
  disabled = false,
  hint,
  guideKey,
}: {
  label: string;
  placeholder: string;
  branch: string;
  value: number | null;
  set: (value: number | null) => void;
  quarantineOnly?: boolean;
  putawayOnly?: boolean;
  disabled?: boolean;
  hint?: string;
  guideKey: string;
}) {
  return (
    <Field label={label} guideKey={guideKey} value={value} currentValue={value ? `Raf #${value}` : 'Seçilmedi'}>
      <PagedAppDropdown
        queryKey={['quality-locations', branch, label]}
        fetchPage={(request) => qualityApi.locations(request, branch)}
        toOption={(location) => ({
          value: String(location.id),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.locationType,
          disabled: (quarantineOnly && !location.isQuarantine)
            || (putawayOnly && (!location.isPutaway || location.isQuarantine)),
        })}
        value={value ? String(value) : null}
        onValueChange={(next) => set(next ? Number(next) : null)}
        placeholder={placeholder}
        disabled={disabled}
        searchable
      />
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </Field>
  );
}
