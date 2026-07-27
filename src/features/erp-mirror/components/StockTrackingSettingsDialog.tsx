import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Save, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import {
  stockTrackingApi,
  type StockTrackingSettings,
  type UpdateStockTrackingSettingsInput,
} from '@/features/stock-tracking/api/stock-tracking.api';
import type { StockMirror } from '../types/erp-mirror.types';

interface Props {
  stock: StockMirror | null;
  onClose: () => void;
}

const STS = 'erpMirror.stockTrackingSettings';
const ST = 'stockTrackingPolicyField';

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

export function StockTrackingSettingsDialog({ stock, onClose }: Props) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissionAccess();
  const [form, setForm] = useState<UpdateStockTrackingSettingsInput>(() => emptyForm(stock?.branchCode ?? '0'));
  const queryKey = useMemo(
    () => ['stock-tracking-settings', stock?.branchCode, stock?.id],
    [stock?.branchCode, stock?.id],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => stockTrackingApi.getStockSettings(stock!.id, stock!.branchCode),
    enabled: Boolean(stock),
  });

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

  return (
    <Dialog open={Boolean(stock)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] !max-w-3xl overflow-y-auto rounded-2xl border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-0"
        data-no-auto-localize="true"
      >
        <header className="border-b border-[var(--wms-app-border)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500">
              <Boxes className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl font-black">{t(`${STS}.title`)}</DialogTitle>
              <DialogDescription className="mt-1">
                {stock?.erpStockCode} · {stock?.stockName}
              </DialogDescription>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {query.isLoading ? (
            <div className="grid min-h-48 place-items-center text-sm text-slate-500">{t(`${STS}.loading`)}</div>
          ) : query.isError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
              {query.error instanceof Error ? query.error.message : t(`${STS}.loadFailed`)}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t(`${STS}.activeTrackingType`)}</p>
                  <p className="mt-1 text-lg font-black text-cyan-500">{trackingLabel}</p>
                </div>
                <div className="text-left text-xs text-slate-500 sm:text-right">
                  {query.data?.hasStockOverride
                    ? t(`${STS}.stockOverride`, { version: query.data.version ?? 1 })
                    : t(`${STS}.noStockOverride`)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                <label className="rounded-xl border border-[var(--wms-app-border)] p-4 sm:col-span-2">
                  <span className="block text-sm font-bold">{t(`${STS}.serialMaskLabel`)}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {t(`${STS}.serialMaskDescription`)}
                  </span>
                  <input
                    className="input mt-3 w-full font-mono"
                    value={form.serialMaskTemplate ?? ''}
                    disabled={!canManage || !form.requireSerial}
                    onChange={event => setForm(current => ({ ...current, serialMaskTemplate: event.target.value.toUpperCase() }))}
                  />
                  {query.data?.nextSerialSequence != null && (
                    <span className="mt-2 block text-xs text-slate-500">
                      {t(`${STS}.nextSequence`, { value: query.data.nextSerialSequence })}
                    </span>
                  )}
                </label>
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
                <label className="rounded-xl border border-[var(--wms-app-border)] p-4">
                  <span className="block text-sm font-bold">{t(`${STS}.minimumShelfLifeLabel`)}</span>
                  <span className="mt-1 block text-xs text-slate-500">{t(`${STS}.minimumShelfLifeDescription`)}</span>
                  <div className="mt-3 flex items-center gap-2">
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
                    <span className="text-sm font-semibold text-slate-500">{t(`${STS}.daysUnit`)}</span>
                  </div>
                </label>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <p className="text-slate-500">{t(`${STS}.validationNote`)}</p>
              </div>
            </>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[var(--wms-app-border)] p-5 sm:flex-row sm:justify-end sm:p-6">
          <button type="button" className="rounded-xl border px-4 py-2.5 font-semibold" onClick={onClose}>
            {canManage ? t('common.cancel') : t('common.close')}
          </button>
          {canManage && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              disabled={
                query.isLoading
                || query.isError
                || mutation.isPending
                || permissionsLoading
                || !isDirty
              }
              onClick={save}
            >
              <Save className="size-4" />
              {mutation.isPending
                ? t('common.saving')
                : isDirty
                  ? t(`${STS}.saveSettings`)
                  : t(`${STS}.noChanges`)}
            </button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
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
}) {
  return (
    <label className={`flex min-h-28 gap-3 rounded-xl border border-[var(--wms-app-border)] p-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-cyan-500"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  );
}
