import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { ParameterFieldGuide, ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import { useAuthStore } from '@/stores/auth-store';
import { warehouseTransferApi } from '../api/warehouse-transfer.api';
import type { WarehouseTransferPolicy } from '../types/warehouse-transfer.types';
import { parameterGuidance, parameterToggleGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';

const POLICY = 'processPolicy.transfer';

export function WarehouseTransferPolicyPage() {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const branchCode = useAuthStore((x) => x.branch?.code ?? '0');
  const [form, setForm] = useState<WarehouseTransferPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void warehouseTransferApi.policy(branchCode).then(setForm).catch((error: Error) => toast.error(error.message));
  }, [branchCode]);

  const reservationOptions = useMemo(
    () => ([
      { value: 'None', label: t(`${POLICY}.reservationPolicy.None`) },
      { value: 'OnCreate', label: t(`${POLICY}.reservationPolicy.OnCreate`) },
      { value: 'OnRelease', label: t(`${POLICY}.reservationPolicy.OnRelease`) },
    ] as const),
    [language, t],
  );
  const discrepancyOptions = useMemo(
    () => ([
      { value: 'Block', label: t(`${POLICY}.discrepancyPolicy.Block`) },
      { value: 'AllowWithReason', label: t(`${POLICY}.discrepancyPolicy.AllowWithReason`) },
      { value: 'RequireApproval', label: t(`${POLICY}.discrepancyPolicy.RequireApproval`) },
    ] as const),
    [language, t],
  );
  const directPostingOptions = useMemo(
    () => ([
      { value: 'OneStep', label: t(`${POLICY}.directPostingPolicy.OneStep`) },
      { value: 'TwoStepTransit', label: t(`${POLICY}.directPostingPolicy.TwoStepTransit`) },
    ] as const),
    [language, t],
  );

  const set = <K extends keyof WarehouseTransferPolicy>(key: K, value: WarehouseTransferPolicy[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(await warehouseTransferApi.updatePolicy(form));
      toast.success(t(`${POLICY}.saveSuccess`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`${POLICY}.saveError`));
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
    <section className="mx-auto max-w-6xl space-y-5" data-no-auto-localize="true">
      <header>
        <div className="flex items-center gap-2 text-[var(--wms-brand-primary)]">
          <SlidersHorizontal />
          <span className="text-xs font-bold uppercase tracking-widest">{t(`${POLICY}.eyebrow`)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-black">{t(`${POLICY}.title`)}</h1>
        <p className="text-sm text-[var(--wms-app-text-muted)]">{t(`${POLICY}.description`)}</p>
      </header>

      <ParameterPageGuide translationKey="transfer" title="Depolar arası transfer ayar rehberi" description="Rezervasyon, kaynak çıkış, transit stok, hedef kabul, raflama ve miktar farkı davranışını her seçimin altında örnekle açıklar." />

      <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <Section title={t(`${POLICY}.sections.flowMatrix`)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle guideKey="allowOrderBasedTask" label={t(`${POLICY}.toggles.allowOrderBasedTask`)} value={form.allowOrderBasedTask} set={(value) => set('allowOrderBasedTask', value)} />
            <Toggle guideKey="allowStockBasedTask" label={t(`${POLICY}.toggles.allowStockBasedTask`)} value={form.allowStockBasedTask} set={(value) => set('allowStockBasedTask', value)} />
            <Toggle guideKey="allowOrderBasedDirect" label={t(`${POLICY}.toggles.allowOrderBasedDirect`)} value={form.allowOrderBasedDirect} set={(value) => set('allowOrderBasedDirect', value)} />
            <Toggle guideKey="allowStockBasedDirect" label={t(`${POLICY}.toggles.allowStockBasedDirect`)} value={form.allowStockBasedDirect} set={(value) => set('allowStockBasedDirect', value)} />
          </div>
        </Section>

        <Section title={t(`${POLICY}.sections.reservation`)}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label={t(`${POLICY}.fields.reservationTime`)} guideKey="reservationPolicy" value={form.reservationPolicy} currentValue={reservationOptions.find((x) => x.value === form.reservationPolicy)?.label}>
              <AppDropdown
                value={form.reservationPolicy}
                onValueChange={(value) => set('reservationPolicy', value as WarehouseTransferPolicy['reservationPolicy'])}
                options={[...reservationOptions]}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.minimumFulfillment`)} guideKey="minimumFulfillmentPercent" value={form.minimumFulfillmentPercent} currentValue={`%${form.minimumFulfillmentPercent}`}>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.minimumFulfillmentPercent}
                onChange={(event) => set('minimumFulfillmentPercent', Number(event.target.value))}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.discrepancy`)} guideKey="discrepancyPolicy" value={form.discrepancyPolicy} currentValue={discrepancyOptions.find((x) => x.value === form.discrepancyPolicy)?.label}>
              <AppDropdown
                value={form.discrepancyPolicy}
                onValueChange={(value) => set('discrepancyPolicy', value as WarehouseTransferPolicy['discrepancyPolicy'])}
                options={[...discrepancyOptions]}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Toggle guideKey="requireApproval" label={t(`${POLICY}.toggles.requireApproval`)} value={form.requireApproval} set={(value) => set('requireApproval', value)} />
            <Toggle guideKey="requireAssigneeForTask" label={t(`${POLICY}.toggles.requireAssigneeForTask`)} value={form.requireAssigneeForTask} set={(value) => set('requireAssigneeForTask', value)} />
            <Toggle guideKey="allowMultipleAssignees" label={t(`${POLICY}.toggles.allowMultipleAssignees`)} value={form.allowMultipleAssignees} set={(value) => set('allowMultipleAssignees', value)} />
            <Toggle guideKey="autoReleaseTaskBased" label={t(`${POLICY}.toggles.autoReleaseTaskBased`)} value={form.autoReleaseTaskBased} set={(value) => set('autoReleaseTaskBased', value)} />
          </div>
        </Section>

        <Section title={t(`${POLICY}.sections.operation`)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle guideKey="allowPartialPicking" label={t(`${POLICY}.toggles.allowPartialPicking`)} value={form.allowPartialPicking} set={(value) => set('allowPartialPicking', value)} />
            <Toggle guideKey="allowPartialShipment" label={t(`${POLICY}.toggles.allowPartialShipment`)} value={form.allowPartialShipment} set={(value) => set('allowPartialShipment', value)} />
            <Toggle guideKey="allowPartialReceipt" label={t(`${POLICY}.toggles.allowPartialReceipt`)} value={form.allowPartialReceipt} set={(value) => set('allowPartialReceipt', value)} />
            <Toggle guideKey="requireDestinationAcceptance" label={t(`${POLICY}.toggles.requireDestinationAcceptance`)} value={form.requireDestinationAcceptance} set={(value) => set('requireDestinationAcceptance', value)} />
            <Toggle guideKey="createTransitInventory" label={t(`${POLICY}.toggles.createTransitInventory`)} value={form.createTransitInventory} set={(value) => set('createTransitInventory', value)} />
            <Toggle guideKey="requirePutaway" label={t(`${POLICY}.toggles.requirePutaway`)} value={form.requirePutaway} set={(value) => set('requirePutaway', value)} />
            <Toggle guideKey="requireSourceLocation" label={t(`${POLICY}.toggles.requireSourceLocation`)} value={form.requireSourceLocation} set={(value) => set('requireSourceLocation', value)} />
            <Toggle guideKey="requireTargetLocation" label={t(`${POLICY}.toggles.requireTargetLocation`)} value={form.requireTargetLocation} set={(value) => set('requireTargetLocation', value)} />
            <Toggle guideKey="requireShipmentInformation" label={t(`${POLICY}.toggles.requireShipmentInformation`)} value={form.requireShipmentInformation} set={(value) => set('requireShipmentInformation', value)} />
          </div>
          <div className="mt-4 max-w-md">
            <Field label={t(`${POLICY}.fields.directPosting`)} guideKey="directPostingPolicy" value={form.directPostingPolicy} currentValue={directPostingOptions.find((x) => x.value === form.directPostingPolicy)?.label}>
              <AppDropdown
                value={form.directPostingPolicy}
                onValueChange={(value) => set('directPostingPolicy', value as WarehouseTransferPolicy['directPostingPolicy'])}
                options={[...directPostingOptions]}
              />
            </Field>
          </div>
        </Section>

        <div className="rounded-xl border border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] p-4 text-sm text-[var(--wms-app-text)]">
          {t(`${POLICY}.snapshotNote`)}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-5 py-2.5 font-semibold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t(`${POLICY}.save`)}
          </button>
        </div>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 border-b border-[var(--wms-app-border)] pb-6">
      <h2 className="mb-3 font-black text-[var(--wms-app-text)]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, guideKey, value, currentValue }: { label: string; children: ReactNode; guideKey?: string; value?: unknown; currentValue?: string }) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-semibold text-[var(--wms-app-text)]">{label}</span>
      {children}
      {guideKey ? <ParameterFieldGuide guidance={parameterGuidance('transfer', guideKey, value)} currentValue={currentValue} /> : null}
    </div>
  );
}

function Toggle({
  label,
  value,
  set,
  guideKey,
}: {
  label: string;
  value: boolean;
  set: (value: boolean) => void;
  guideKey: string;
}) {
  return <ParameterToggleCard title={label} checked={value} onCheckedChange={set} guidance={parameterToggleGuidance('transfer', guideKey)} />;
}
