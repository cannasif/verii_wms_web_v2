import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { useAuthStore } from '@/stores/auth-store';
import { shippingApi } from './shipping-api';
import type { ShipmentPolicy } from './types';

const POLICY = 'processPolicy.shipping';

export function ShippingPolicyPage() {
  const { t, i18n } = useTranslation('common');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const branch = useAuthStore((x) => x.branch?.code ?? '0');
  const [form, setForm] = useState<ShipmentPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void shippingApi.policy(branch).then(setForm).catch((error: Error) => toast.error(error.message));
  }, [branch]);

  const reservationOptions = useMemo(
    () => ([
      { value: 'None', label: t(`${POLICY}.reservationPolicy.None`) },
      { value: 'OnCreate', label: t(`${POLICY}.reservationPolicy.OnCreate`) },
      { value: 'OnRelease', label: t(`${POLICY}.reservationPolicy.OnRelease`) },
    ] as const),
    [language, t],
  );
  const shortageOptions = useMemo(
    () => ([
      { value: 'Block', label: t(`${POLICY}.shortagePolicy.Block`) },
      { value: 'AllowPartial', label: t(`${POLICY}.shortagePolicy.AllowPartial`) },
      { value: 'RequireApproval', label: t(`${POLICY}.shortagePolicy.RequireApproval`) },
    ] as const),
    [language, t],
  );
  const overPickOptions = useMemo(
    () => ([
      { value: 'Block', label: t(`${POLICY}.overPickPolicy.Block`) },
      { value: 'AllowWithinTolerance', label: t(`${POLICY}.overPickPolicy.AllowWithinTolerance`) },
      { value: 'RequireApproval', label: t(`${POLICY}.overPickPolicy.RequireApproval`) },
    ] as const),
    [language, t],
  );
  const packingOptions = useMemo(
    () => ([
      { value: 'NotRequired', label: t(`${POLICY}.packingPolicy.NotRequired`) },
      { value: 'Optional', label: t(`${POLICY}.packingPolicy.Optional`) },
      { value: 'Required', label: t(`${POLICY}.packingPolicy.Required`) },
    ] as const),
    [language, t],
  );

  const set = <K extends keyof ShipmentPolicy>(key: K, value: ShipmentPolicy[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(await shippingApi.updatePolicy(form));
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
        <div className="flex items-center gap-2 text-cyan-500">
          <SlidersHorizontal />
          <span className="text-xs font-bold uppercase tracking-widest">{t(`${POLICY}.eyebrow`)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-black">{t(`${POLICY}.title`)}</h1>
        <p className="text-sm text-slate-500">{t(`${POLICY}.description`)}</p>
      </header>

      <div className="space-y-6 rounded-2xl border bg-[var(--wms-app-panel)] p-5">
        <Section title={t(`${POLICY}.sections.flowMatrix`)}>
          <Grid>
            <Toggle label={t(`${POLICY}.toggles.allowOrderBasedTask`)} value={form.allowOrderBasedTask} set={(value) => set('allowOrderBasedTask', value)} />
            <Toggle label={t(`${POLICY}.toggles.allowStockBasedTask`)} value={form.allowStockBasedTask} set={(value) => set('allowStockBasedTask', value)} />
            <Toggle label={t(`${POLICY}.toggles.allowOrderBasedDirect`)} value={form.allowOrderBasedDirect} set={(value) => set('allowOrderBasedDirect', value)} />
            <Toggle label={t(`${POLICY}.toggles.allowStockBasedDirect`)} value={form.allowStockBasedDirect} set={(value) => set('allowStockBasedDirect', value)} />
          </Grid>
        </Section>

        <Section title={t(`${POLICY}.sections.reservation`)}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t(`${POLICY}.fields.reservation`)}>
              <AppDropdown
                value={form.reservationPolicy}
                onValueChange={(value) => set('reservationPolicy', value as ShipmentPolicy['reservationPolicy'])}
                options={[...reservationOptions]}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.shortage`)}>
              <AppDropdown
                value={form.shortagePolicy}
                onValueChange={(value) => set('shortagePolicy', value as ShipmentPolicy['shortagePolicy'])}
                options={[...shortageOptions]}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.overPick`)}>
              <AppDropdown
                value={form.overPickPolicy}
                onValueChange={(value) => set('overPickPolicy', value as ShipmentPolicy['overPickPolicy'])}
                options={[...overPickOptions]}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.packing`)}>
              <AppDropdown
                value={form.packingPolicy}
                onValueChange={(value) => set('packingPolicy', value as ShipmentPolicy['packingPolicy'])}
                options={[...packingOptions]}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.minimumFulfillment`)}>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={form.minimumFulfillmentPercent}
                onChange={(event) => set('minimumFulfillmentPercent', Number(event.target.value))}
              />
            </Field>
            <Field label={t(`${POLICY}.fields.overPickTolerance`)}>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={form.overPickTolerancePercent}
                onChange={(event) => set('overPickTolerancePercent', Number(event.target.value))}
              />
            </Field>
          </div>
        </Section>

        <Section title={t(`${POLICY}.sections.gates`)}>
          <Grid>
            <Toggle label={t(`${POLICY}.toggles.requireApproval`)} value={form.requireApproval} set={(value) => set('requireApproval', value)} />
            <Toggle label={t(`${POLICY}.toggles.requireAssigneeForTask`)} value={form.requireAssigneeForTask} set={(value) => set('requireAssigneeForTask', value)} />
            <Toggle label={t(`${POLICY}.toggles.allowMultipleAssignees`)} value={form.allowMultipleAssignees} set={(value) => set('allowMultipleAssignees', value)} />
            <Toggle label={t(`${POLICY}.toggles.autoReleaseTaskBased`)} value={form.autoReleaseTaskBased} set={(value) => set('autoReleaseTaskBased', value)} />
            <Toggle label={t(`${POLICY}.toggles.allowPartialPicking`)} value={form.allowPartialPicking} set={(value) => set('allowPartialPicking', value)} />
            <Toggle label={t(`${POLICY}.toggles.allowPartialShipment`)} value={form.allowPartialShipment} set={(value) => set('allowPartialShipment', value)} />
            <Toggle label={t(`${POLICY}.toggles.requireSourceLocation`)} value={form.requireSourceLocation} set={(value) => set('requireSourceLocation', value)} />
            <Toggle label={t(`${POLICY}.toggles.requireShipmentInformation`)} value={form.requireShipmentInformation} set={(value) => set('requireShipmentInformation', value)} />
            <Toggle label={t(`${POLICY}.toggles.requireLoadingConfirmation`)} value={form.requireLoadingConfirmation} set={(value) => set('requireLoadingConfirmation', value)} />
            <Toggle label={t(`${POLICY}.toggles.autoPostErpAfterApproval`)} value={form.autoPostErpAfterApproval} set={(value) => set('autoPostErpAfterApproval', value)} />
          </Grid>
        </Section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white"
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
    <section>
      <h2 className="mb-3 font-black">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function Toggle({
  label,
  value,
  set,
}: {
  label: string;
  value: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(event) => set(event.target.checked)} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
