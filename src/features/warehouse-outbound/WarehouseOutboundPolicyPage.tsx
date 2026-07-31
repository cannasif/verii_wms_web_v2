import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { useAuthStore } from '@/stores/auth-store';
import { warehouseOutboundApi } from './warehouseOutbound-api';
import type { ShipmentPolicy } from './types';

export function WarehouseOutboundPolicyPage() {
  const { t } = useModuleTranslation('warehouse-outbound');
  const branch = useAuthStore((x) => x.branch?.code ?? '0');
  const [f, setF] = useState<ShipmentPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void warehouseOutboundApi.policy(branch).then(setF).catch((e: Error) => toast.error(e.message));
  }, [branch]);

  if (!f) return <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin" /></div>;

  const set = <K extends keyof ShipmentPolicy>(k: K, v: ShipmentPolicy[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const save = async () => {
    setSaving(true);
    try {
      setF(await warehouseOutboundApi.updatePolicy(f));
      toast.success(t('settings.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header>
        <div className="flex items-center gap-2 text-cyan-500">
          <SlidersHorizontal />
          <span className="text-xs font-bold uppercase tracking-widest">{t('settings.eyebrow')}</span>
        </div>
        <h1 className="mt-2 text-2xl font-black">{t('settings.title')}</h1>
        <p className="text-sm text-slate-500">{t('settings.description')}</p>
      </header>
      <div className="space-y-6 rounded-2xl border bg-[var(--wms-app-panel)] p-5">
        <Section title={t('settings.sections.flowMatrix')}>
          <Grid>
            <Toggle l={t('settings.flowToggles.orderTask')} v={f.allowOrderBasedTask} s={(v) => set('allowOrderBasedTask', v)} />
            <Toggle l={t('settings.flowToggles.stockTask')} v={f.allowStockBasedTask} s={(v) => set('allowStockBasedTask', v)} />
            <Toggle l={t('settings.flowToggles.orderDirect')} v={f.allowOrderBasedDirect} s={(v) => set('allowOrderBasedDirect', v)} />
            <Toggle l={t('settings.flowToggles.stockDirect')} v={f.allowStockBasedDirect} s={(v) => set('allowStockBasedDirect', v)} />
          </Grid>
        </Section>
        <Section title={t('settings.sections.reservationPickingQuantity')}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field l={t('settings.fields.reservation')}>
              <AppDropdown value={f.reservationPolicy} onValueChange={(v) => set('reservationPolicy', v as ShipmentPolicy['reservationPolicy'])}
                options={[
                  { value: 'None', label: t('settings.reservationOptions.none') },
                  { value: 'OnCreate', label: t('settings.reservationOptions.onCreate') },
                  { value: 'OnRelease', label: t('settings.reservationOptions.onRelease') },
                ]} />
            </Field>
            <Field l={t('settings.fields.shortage')}>
              <AppDropdown value={f.shortagePolicy} onValueChange={(v) => set('shortagePolicy', v as ShipmentPolicy['shortagePolicy'])}
                options={[
                  { value: 'Block', label: t('settings.shortageOptions.block') },
                  { value: 'AllowPartial', label: t('settings.shortageOptions.allowPartial') },
                  { value: 'RequireApproval', label: t('settings.shortageOptions.requireApproval') },
                ]} />
            </Field>
            <Field l={t('settings.fields.overPick')}>
              <AppDropdown value={f.overPickPolicy} onValueChange={(v) => set('overPickPolicy', v as ShipmentPolicy['overPickPolicy'])}
                options={[
                  { value: 'Block', label: t('settings.overPickOptions.block') },
                  { value: 'AllowWithinTolerance', label: t('settings.overPickOptions.allowWithinTolerance') },
                  { value: 'RequireApproval', label: t('settings.overPickOptions.requireApproval') },
                ]} />
            </Field>
            <Field l={t('settings.fields.packing')}>
              <AppDropdown value={f.packingPolicy} onValueChange={(v) => set('packingPolicy', v as ShipmentPolicy['packingPolicy'])}
                options={[
                  { value: 'NotRequired', label: t('settings.packingOptions.notRequired') },
                  { value: 'Optional', label: t('settings.packingOptions.optional') },
                  { value: 'Required', label: t('settings.packingOptions.required') },
                ]} />
            </Field>
            <Field l={t('settings.fields.minimumFulfillment')}>
              <input className="input" type="number" min="0" max="100" value={f.minimumFulfillmentPercent}
                onChange={(e) => set('minimumFulfillmentPercent', Number(e.target.value))} />
            </Field>
            <Field l={t('settings.fields.overPickTolerance')}>
              <input className="input" type="number" min="0" max="100" value={f.overPickTolerancePercent}
                onChange={(e) => set('overPickTolerancePercent', Number(e.target.value))} />
            </Field>
          </div>
        </Section>
        <Section title={t('settings.sections.operationGates')}>
          <Grid>
            <Toggle l={t('settings.gateToggles.requireApproval')} v={f.requireApproval} s={(v) => set('requireApproval', v)} />
            <Toggle l={t('settings.gateToggles.requireAssigneeForTask')} v={f.requireAssigneeForTask} s={(v) => set('requireAssigneeForTask', v)} />
            <Toggle l={t('settings.gateToggles.allowMultipleAssignees')} v={f.allowMultipleAssignees} s={(v) => set('allowMultipleAssignees', v)} />
            <Toggle l={t('settings.gateToggles.autoReleaseTaskBased')} v={f.autoReleaseTaskBased} s={(v) => set('autoReleaseTaskBased', v)} />
            <Toggle l={t('settings.gateToggles.allowPartialPicking')} v={f.allowPartialPicking} s={(v) => set('allowPartialPicking', v)} />
            <Toggle l={t('settings.gateToggles.allowPartialShipment')} v={f.allowPartialShipment} s={(v) => set('allowPartialShipment', v)} />
            <Toggle l={t('settings.gateToggles.requireSourceLocation')} v={f.requireSourceLocation} s={(v) => set('requireSourceLocation', v)} />
            <Toggle l={t('settings.gateToggles.requireShipmentInformation')} v={f.requireShipmentInformation} s={(v) => set('requireShipmentInformation', v)} />
            <Toggle l={t('settings.gateToggles.requireLoadingConfirmation')} v={f.requireLoadingConfirmation} s={(v) => set('requireLoadingConfirmation', v)} />
            <Toggle l={t('settings.gateToggles.autoPostErpAfterApproval')} v={f.autoPostErpAfterApproval} s={(v) => set('autoPostErpAfterApproval', v)} />
          </Grid>
        </Section>
        <div className="flex justify-end">
          <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('settings.save')}
          </button>
        </div>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-3 font-black">{title}</h2>{children}</section>;
}
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}
function Toggle({ l, v, s }: { l: string; v: boolean; s: (v: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-xl border p-3 text-sm"><span>{l}</span><input type="checkbox" checked={v} onChange={(e) => s(e.target.checked)} /></label>;
}
function Field({ l, children }: { l: string; children: ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-semibold">{l}</span>{children}</label>;
}
