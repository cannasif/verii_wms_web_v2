import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Building2,
  Eye,
  Hash,
  Layers3,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Images,
  Tag,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from '@/components/shared/OpsDialogShell';
import { OpsCodeBadge } from '@/components/shared/OpsStatusBadge';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { formatProjectDateTime } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import {
  stockTrackingApi,
  type StockTrackingSettings,
  type UpdateStockTrackingSettingsInput,
} from '@/features/stock-tracking/api/stock-tracking.api';
import type { StockMirror } from '../types/erp-mirror.types';
import { StockImageManager } from './StockImageManager';

interface Props {
  stock: StockMirror | null;
  initialTab?: 'details' | 'tracking' | 'images';
  onClose: () => void;
}

const STS = 'erpMirror.stockTrackingSettings';
const ST = 'stockTrackingPolicyField';
const CARD = 'erpMirror.stockCardUi';

const emptyForm = (branchCode: string): UpdateStockTrackingSettingsInput => ({
  branchCode,
  requireSerial: false,
  serialQuantityRule: 'NotApplicable',
  autoGenerateSerials: false,
  serialMaskTemplate: '{STOCK}-{YY}{MM}-{N:6}',
  requireLot: false,
  requireManufacturingDate: false,
  requireExpirationDate: false,
  minimumRemainingShelfLifeDays: null,
  concurrencyToken: null,
  serialRuleConcurrencyToken: null,
});

const fromSettings = (value: StockTrackingSettings): UpdateStockTrackingSettingsInput => ({
  branchCode: value.branchCode,
  requireSerial: value.requireSerial,
  serialQuantityRule: value.requireSerial ? value.serialQuantityRule : 'NotApplicable',
  autoGenerateSerials: value.requireSerial && value.autoGenerateSerials,
  serialMaskTemplate: value.serialMaskTemplate ?? '{STOCK}-{YY}{MM}-{N:6}',
  requireLot: value.requireLot,
  requireManufacturingDate: value.requireManufacturingDate,
  requireExpirationDate: value.requireExpirationDate,
  minimumRemainingShelfLifeDays: value.minimumRemainingShelfLifeDays ?? null,
  concurrencyToken: value.concurrencyToken ?? null,
  serialRuleConcurrencyToken: value.serialRuleConcurrencyToken ?? null,
});

const hasSameTrackingValues = (
  current: UpdateStockTrackingSettingsInput,
  baseline: StockTrackingSettings,
) =>
  current.requireSerial === baseline.requireSerial
  && current.serialQuantityRule === (baseline.requireSerial ? baseline.serialQuantityRule : 'NotApplicable')
  && current.autoGenerateSerials === (baseline.requireSerial && baseline.autoGenerateSerials)
  && current.serialMaskTemplate === (baseline.serialMaskTemplate ?? '{STOCK}-{YY}{MM}-{N:6}')
  && current.requireLot === baseline.requireLot
  && current.requireManufacturingDate === baseline.requireManufacturingDate
  && current.requireExpirationDate === baseline.requireExpirationDate
  && current.minimumRemainingShelfLifeDays === (baseline.minimumRemainingShelfLifeDays ?? null);

const display = (value?: string | number | null) => {
  if (value == null || value === '') return '—';
  return String(value);
};

export function StockTrackingSettingsDialog({ stock, initialTab = 'details', onClose }: Props) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissionAccess();
  const canViewTracking = can('WMS.SERIAL_RULES.VIEW');
  const [activeTab, setActiveTab] = useState<'details' | 'tracking' | 'images'>(initialTab);
  const [form, setForm] = useState<UpdateStockTrackingSettingsInput>(() => emptyForm(stock?.branchCode ?? '0'));
  const queryKey = useMemo(
    () => ['stock-tracking-settings', stock?.branchCode, stock?.id],
    [stock?.branchCode, stock?.id],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => stockTrackingApi.getStockSettings(stock!.id, stock!.branchCode),
    enabled: Boolean(stock && canViewTracking),
  });

  useEffect(() => {
    setActiveTab(initialTab === 'tracking' && canViewTracking ? 'tracking' : initialTab === 'images' ? 'images' : 'details');
  }, [canViewTracking, initialTab, stock?.id]);

  useEffect(() => {
    if (query.data) setForm(fromSettings(query.data));
    else if (stock) setForm(emptyForm(stock.branchCode));
  }, [query.data, stock]);

  const mutation = useMutation({
    mutationFn: (value: UpdateStockTrackingSettingsInput) =>
      stockTrackingApi.updateStockSettings(stock!.id, value),
    onSuccess: async (value) => {
      setForm(fromSettings(value));
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t(`${STS}.saveSuccess`, { stockCode: value.stockCode }));
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t(`${STS}.saveFailed`));
    },
  });

  const updateSerial = (required: boolean) => setForm(current => ({
    ...current,
    requireSerial: required,
    serialQuantityRule: required ? 'OneSerialPerLine' : 'NotApplicable',
    autoGenerateSerials: false,
  }));
  const updateOnePerUnit = (enabled: boolean) => setForm(current => ({
    ...current,
    serialQuantityRule: enabled ? 'OneSerialPerBaseUnit' : 'OneSerialPerLine',
    autoGenerateSerials: enabled ? current.autoGenerateSerials : false,
  }));
  const updateAutoGenerate = (enabled: boolean) => setForm(current => ({
    ...current,
    autoGenerateSerials: enabled,
    serialQuantityRule: enabled ? 'OneSerialPerBaseUnit' : current.serialQuantityRule,
  }));
  const updateExpiration = (required: boolean) => setForm(current => ({
    ...current,
    requireExpirationDate: required,
    minimumRemainingShelfLifeDays: required ? current.minimumRemainingShelfLifeDays : null,
  }));
  const save = () => {
    if (form.minimumRemainingShelfLifeDays != null && form.minimumRemainingShelfLifeDays < 0) {
      toast.error(t(`${STS}.minShelfLifeNegative`));
      return;
    }
    if (form.autoGenerateSerials && !/\{N:[1-9]\d?\}/.test(form.serialMaskTemplate ?? '')) {
      toast.error(t(`${STS}.serialMaskRequired`));
      return;
    }
    mutation.mutate(form);
  };
  const canManage = can('WMS.SERIAL_RULES.MANAGE');
  const isDirty = Boolean(
    query.data
    && (!query.data.hasStockOverride || !hasSameTrackingValues(form, query.data)),
  );
  const trackingLabel = form.requireLot && form.requireSerial
    ? t(`${STS}.trackingTypes.lotAndSerial`)
    : form.requireLot
      ? t(`${STS}.trackingTypes.lot`)
      : form.requireSerial
        ? t(`${STS}.trackingTypes.serial`)
        : t(`${STS}.trackingTypes.none`);

  const specialCodes = stock
    ? [
        { key: 'groupCode', label: t('erpMirror.fields.groupCode'), value: stock.groupCode },
        { key: 'code1', label: t('erpMirror.fields.code1'), value: stock.code1 },
        { key: 'code2', label: t('erpMirror.fields.code2'), value: stock.code2 },
        { key: 'code3', label: t('erpMirror.fields.code3'), value: stock.code3 },
        { key: 'code4', label: t('erpMirror.fields.code4'), value: stock.code4 },
        { key: 'code5', label: t('erpMirror.fields.code5'), value: stock.code5 },
      ]
    : [];

  return (
    <Dialog open={Boolean(stock)} onOpenChange={open => { if (!open) onClose(); }}>
      <OpsDialogContent
        size="xl"
        portalRoot="body"
        overlayClassName="!z-[11000]"
        className="!z-[11010] !max-h-[min(92dvh,900px)] !gap-0 !overflow-hidden !p-0 data-no-auto-localize"
      >
        <OpsDialogHeader className="!m-0 !w-full !rounded-none !border-x-0 !border-t-0 !px-5 !py-4 !pr-14 sm:!px-6">
          <div className="flex w-full items-start gap-3 sm:gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--wms-ops-accent)_28%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)] text-[var(--wms-ops-accent)] shadow-[0_0_18px_color-mix(in_oklab,var(--wms-ops-accent)_16%,transparent)]">
              <Boxes className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-ops-accent)]">
                {t(`${CARD}.eyebrow`)}
              </p>
              <DialogTitle className="wms-ops-detail-dialog__title">
                {t('erpMirror.stockCard')}
                {stock ? (
                  <span className="ml-2 font-mono text-base font-bold text-[var(--wms-ops-accent)]">
                    {stock.erpStockCode}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="wms-ops-detail-dialog__description">
                {stock?.stockName || t(`${CARD}.untitled`)}
              </DialogDescription>
              {stock ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <OpsCodeBadge>{display(stock.unitCode)}</OpsCodeBadge>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_80%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--wms-app-text-muted)]">
                    <Building2 className="size-3.5" aria-hidden />
                    {t('erpMirror.fields.branchCode')}: {display(stock.branchCode)}
                  </span>
                  {stock.groupCode ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--wms-ops-accent)_30%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--wms-ops-accent)]">
                      <Layers3 className="size-3.5" aria-hidden />
                      {display(stock.groupCode)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wms-app-border)] px-2.5 py-1 font-mono text-xs text-[var(--wms-app-text-muted)]">
                    <Hash className="size-3.5" aria-hidden />
                    #{stock.id}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </OpsDialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as 'details' | 'tracking' | 'images')}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="w-full shrink-0 border-b border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-ops-card-bg)_70%,transparent)]">
            <TabsList
              className={cn(
                'wms-ops-tabs wms-ops-stock-card-tabs',
                canViewTracking ? 'wms-ops-stock-card-tabs--triple' : 'wms-ops-stock-card-tabs--dual',
                activeTab === 'tracking'
                  ? 'wms-ops-tabs--stock'
                  : activeTab === 'images'
                    ? canViewTracking ? 'wms-ops-tabs--images' : 'wms-ops-tabs--stock'
                    : '',
              )}
            >
              {canViewTracking ? <span className="wms-ops-tab-indicator" aria-hidden /> : null}
              <TabsTrigger value="details" className="wms-ops-tab gap-2">
                <Eye className="size-3.5" aria-hidden />
                {t('erpMirror.details')}
              </TabsTrigger>
              {canViewTracking ? (
                <TabsTrigger value="tracking" className="wms-ops-tab gap-2">
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  {t('erpMirror.trackingSettings')}
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="images" className="wms-ops-tab gap-2">
                <Images className="size-3.5" aria-hidden />
                Görseller
              </TabsTrigger>
            </TabsList>
          </div>

          <OpsDialogBody className="!px-5 !py-4 sm:!px-6">
            <TabsContent value="details" className="m-0 space-y-5 outline-none">
              {stock ? (
                <>
                  <section className="overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--wms-ops-accent)_22%,var(--wms-app-border))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent),transparent_55%)]">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_14%,transparent)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--wms-ops-accent)]">
                          {t(`${CARD}.identitySection`)}
                        </p>
                        <p className="mt-1 truncate font-mono text-lg font-black text-[var(--wms-app-text)]">
                          {stock.erpStockCode}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--wms-app-text-muted)]">{stock.stockName}</p>
                      </div>
                      <div className="text-right text-xs text-[var(--wms-app-text-muted)]">
                        <p className="inline-flex items-center gap-1.5">
                          <RefreshCw className="size-3.5" aria-hidden />
                          {t('erpMirror.fields.lastSyncDate')}
                        </p>
                        <p className="mt-1 font-mono font-semibold text-[var(--wms-app-text)]">
                          {stock.lastSyncDate ? formatProjectDateTime(stock.lastSyncDate) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-px bg-[color-mix(in_oklab,var(--wms-app-border)_70%,transparent)] sm:grid-cols-3">
                      <MetaCell label={t('erpMirror.fields.unitCode')} value={display(stock.unitCode)} />
                      <MetaCell label={t('erpMirror.fields.businessUnitCode')} value={display(stock.businessUnitCode)} />
                      <MetaCell label={t('erpMirror.fields.manufacturerCode')} value={display(stock.manufacturerCode)} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionHeading
                      icon={<Tag className="size-3.5" aria-hidden />}
                      title={t(`${CARD}.codesSection`)}
                      hint={t(`${CARD}.codesHint`)}
                    />
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {specialCodes.map((item) => (
                        <CodeTile
                          key={item.key}
                          label={item.label}
                          value={item.value}
                          emphasized={item.key === 'code1' || item.key === 'code2' || item.key === 'code3' || item.key === 'groupCode'}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionHeading
                      icon={<Building2 className="size-3.5" aria-hidden />}
                      title={t(`${CARD}.orgSection`)}
                    />
                    <div className="grid gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)] p-4 sm:grid-cols-2">
                      <OpsDetailField label={t('erpMirror.fields.id')}>{display(stock.id)}</OpsDetailField>
                      <OpsDetailField label={t('erpMirror.fields.branchCode')}>{display(stock.branchCode)}</OpsDetailField>
                      <OpsDetailField label={t('erpMirror.fields.businessUnitCode')}>{display(stock.businessUnitCode)}</OpsDetailField>
                      <OpsDetailField label={t('erpMirror.fields.unitCode')}>{display(stock.unitCode)}</OpsDetailField>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionHeading
                      icon={<ShieldCheck className="size-3.5" aria-hidden />}
                      title={t(`${CARD}.auditSection`)}
                    />
                    <div className="grid gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)] p-4 sm:grid-cols-2">
                      <OpsDetailField label={t('erpMirror.fields.createdBy')}>{display(stock.createdBy)}</OpsDetailField>
                      <OpsDetailField label={t('erpMirror.fields.createdDate')}>
                        {stock.createdDate ? formatProjectDateTime(stock.createdDate) : '—'}
                      </OpsDetailField>
                      <OpsDetailField label={t('erpMirror.fields.updatedBy')}>{display(stock.updatedBy)}</OpsDetailField>
                      <OpsDetailField label={t('erpMirror.fields.updatedDate')}>
                        {stock.updatedDate ? formatProjectDateTime(stock.updatedDate) : '—'}
                      </OpsDetailField>
                    </div>
                  </section>
                </>
              ) : null}
            </TabsContent>

            {canViewTracking ? (
              <TabsContent value="tracking" className="m-0 space-y-5 outline-none">
                {query.isLoading ? (
                  <div className="grid min-h-48 place-items-center text-sm text-[var(--wms-app-text-muted)]">
                    {t(`${STS}.loading`)}
                  </div>
                ) : query.isError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                    {query.error instanceof Error ? query.error.message : t(`${STS}.loadFailed`)}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_oklab,var(--wms-ops-accent)_24%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wms-app-text-muted)]">
                          {t(`${STS}.activeTrackingType`)}
                        </p>
                        <p className="mt-1 text-lg font-black text-[var(--wms-ops-accent)]">{trackingLabel}</p>
                      </div>
                      <div className="text-left text-xs text-[var(--wms-app-text-muted)] sm:text-right">
                        {query.data?.hasStockOverride
                          ? t(`${STS}.stockOverride`, { version: query.data.version ?? 1 })
                          : t(`${STS}.noStockOverride`)}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)]">
                      <div className="divide-y divide-[var(--wms-app-border)] px-3 sm:px-4">
                        <TrackingCheck
                          label={t(`${ST}.requireSerial`)}
                          description={t(`${STS}.requireSerialDescription`)}
                          checked={form.requireSerial}
                          disabled={!canManage}
                          onChange={updateSerial}
                        />
                        <TrackingCheck
                          label={t(`${ST}.oneSerialPerUnit`)}
                          description={t(`${STS}.oneSerialPerUnitDescription`)}
                          checked={form.serialQuantityRule === 'OneSerialPerBaseUnit'}
                          disabled={!canManage || !form.requireSerial}
                          onChange={updateOnePerUnit}
                        />
                        <TrackingCheck
                          label={t(`${ST}.autoGenerateSerials`)}
                          description={t(`${STS}.autoGenerateSerialsDescription`)}
                          checked={form.autoGenerateSerials}
                          disabled={!canManage || !form.requireSerial}
                          onChange={updateAutoGenerate}
                        />
                      </div>

                      <div className="border-t border-[var(--wms-app-border)] px-3 py-3 sm:px-4">
                        <label className="block">
                          <span className="block text-xs font-bold text-[var(--wms-app-text)]">{t(`${STS}.serialMaskLabel`)}</span>
                          <span className="mt-0.5 block text-[11px] text-[var(--wms-app-text-muted)]">
                            {t(`${STS}.serialMaskDescription`)}
                          </span>
                          <input
                            className="input mt-2 w-full font-mono text-sm"
                            value={form.serialMaskTemplate ?? ''}
                            disabled={!canManage || !form.requireSerial}
                            onChange={event => setForm(current => ({ ...current, serialMaskTemplate: event.target.value.toUpperCase() }))}
                          />
                          {query.data?.nextSerialSequence != null ? (
                            <span className="mt-1.5 block text-[11px] text-[var(--wms-app-text-muted)]">
                              {t(`${STS}.nextSequence`, { value: query.data.nextSerialSequence })}
                            </span>
                          ) : null}
                        </label>
                      </div>

                      <div className="divide-y divide-[var(--wms-app-border)] border-t border-[var(--wms-app-border)] px-3 sm:px-4">
                        <TrackingCheck
                          label={t(`${ST}.requireLot`)}
                          description={t(`${STS}.requireLotDescription`)}
                          checked={form.requireLot}
                          disabled={!canManage}
                          onChange={value => setForm(current => ({ ...current, requireLot: value }))}
                        />
                        <TrackingCheck
                          label={t(`${STS}.requireManufacturingDateLabel`)}
                          description={t(`${STS}.requireManufacturingDateDescription`)}
                          checked={form.requireManufacturingDate}
                          disabled={!canManage}
                          onChange={value => setForm(current => ({ ...current, requireManufacturingDate: value }))}
                        />
                        <TrackingCheck
                          label={t(`${STS}.requireExpirationDateLabel`)}
                          description={t(`${STS}.requireExpirationDateDescription`)}
                          checked={form.requireExpirationDate}
                          disabled={!canManage}
                          onChange={updateExpiration}
                        />
                      </div>

                      <div className="border-t border-[var(--wms-app-border)] px-3 py-3 sm:px-4">
                        <label className="block">
                          <span className="block text-xs font-bold text-[var(--wms-app-text)]">{t(`${STS}.minimumShelfLifeLabel`)}</span>
                          <span className="mt-0.5 block text-[11px] text-[var(--wms-app-text-muted)]">{t(`${STS}.minimumShelfLifeDescription`)}</span>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              className="input min-w-0 flex-1"
                              type="number"
                              min={0}
                              step={1}
                              value={form.minimumRemainingShelfLifeDays ?? ''}
                              disabled={!canManage || !form.requireExpirationDate}
                              onChange={event => setForm(current => ({
                                ...current,
                                minimumRemainingShelfLifeDays: event.target.value === '' ? null : Number(event.target.value),
                              }))}
                            />
                            <span className="text-xs font-semibold text-[var(--wms-app-text-muted)]">{t(`${STS}.daysUnit`)}</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
                      <p className="text-[var(--wms-app-text-muted)]">{t(`${STS}.validationNote`)}</p>
                    </div>
                  </>
                )}
              </TabsContent>
            ) : null}
            <TabsContent value="images" className="m-0 outline-none">
              {stock ? <StockImageManager stockId={stock.id} stockName={stock.stockName} canManage={can('ERP.MIRROR.SYNC')} /> : null}
            </TabsContent>
          </OpsDialogBody>
        </Tabs>

        <OpsDialogFooter className="!m-0 !w-full !rounded-none !border-x-0 !border-b-0 !px-5 !py-3.5 sm:!px-6">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            {activeTab === 'tracking' && canManage ? t('common.cancel') : t('common.close')}
          </OpsActionButton>
          {activeTab === 'tracking' && canManage ? (
            <OpsActionButton
              type="button"
              disabled={
                query.isLoading
                || query.isError
                || mutation.isPending
                || permissionsLoading
                || !isDirty
              }
              onClick={save}
            >
              <Save className="size-4" aria-hidden />
              {mutation.isPending
                ? t('common.saving')
                : isDirty
                  ? t(`${STS}.saveSettings`)
                  : t(`${STS}.noChanges`)}
            </OpsActionButton>
          ) : null}
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function SectionHeading({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md border border-[color-mix(in_oklab,var(--wms-ops-accent)_24%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)] text-[var(--wms-ops-accent)]">
          {icon}
        </span>
        <h3 className="text-sm font-bold text-[var(--wms-app-text)]">{title}</h3>
      </div>
      {hint ? <p className="text-[11px] text-[var(--wms-app-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function CodeTile({
  label,
  value,
  emphasized,
}: {
  label: string;
  value?: string | null;
  emphasized?: boolean;
}): ReactElement {
  const filled = Boolean(value && String(value).trim());
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        emphasized
          ? 'border-[color-mix(in_oklab,var(--wms-ops-accent)_32%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)]'
          : 'border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)]',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 break-all font-mono text-sm font-black',
          filled ? 'text-[var(--wms-ops-accent)]' : 'text-[var(--wms-app-text-muted)]',
        )}
      >
        {filled ? String(value) : '—'}
      </p>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="bg-[color-mix(in_oklab,var(--wms-app-panel)_94%,transparent)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-[var(--wms-app-text)]">{value}</p>
    </div>
  );
}

function OpsDetailField({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="wms-ops-detail-field">
      <span className="wms-ops-detail-field__label">{label}</span>
      <span className="wms-ops-detail-field__value">{children}</span>
    </div>
  );
}

function TrackingCheck({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): ReactElement {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) onChange(!checked); }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onChange(!checked);
        }
      }}
      className={cn(
        'flex items-start gap-2.5 py-2.5 transition-colors',
        disabled ? 'opacity-55' : 'cursor-pointer',
      )}
    >
      <OpsSkinCheckbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-5 text-[var(--wms-app-text)]">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-[var(--wms-app-text-muted)]">{description}</span>
      </span>
    </div>
  );
}
