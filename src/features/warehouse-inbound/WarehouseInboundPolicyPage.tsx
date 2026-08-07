import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { ParameterFieldGuide, ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth-store';
import { parameterGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';

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
};

type Envelope<T> = { success: boolean; data: T; message?: string };

const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};

export function WarehouseInboundPolicyPage() {
  const { t } = useModuleTranslation('warehouse-inbound');
  const branch = useAuthStore((state) => state.branch?.code ?? '0');
  const [form, setForm] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Envelope<Policy>>(`/api/warehouse-inbound-policy?branchCode=${encodeURIComponent(branch)}`)
      .then((value) => setForm(unwrap(value)))
      .catch((error) => toast.error(error instanceof Error ? error.message : t('policy.loadError')));
  }, [branch, t]);

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(unwrap(await api.put<Envelope<Policy>>('/api/warehouse-inbound-policy', form)));
      toast.success(t('policy.saved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('policy.saveError'));
    } finally {
      setSaving(false);
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
          <span className="text-xs font-bold uppercase tracking-widest">{t('policy.eyebrow')}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{t('policy.title')}</h1>
        <p className="text-sm text-slate-500">{t('policy.description')}</p>
      </header>

      <ParameterPageGuide translationKey="inbound" title="Ambar giriş ayar rehberi" description="Seçimin giriş miktarını, onayları, kalite beklemesini, raflamayı ve ERP aktarımını nasıl değiştirdiğini alan bazında gösterir." />

      <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('policy.fields.overReceipt')} guideKey="overReceiptPolicy" value={form.overReceiptPolicy}>
            <AppDropdown
              value={form.overReceiptPolicy}
              onValueChange={(value) => {
                set('overReceiptPolicy', value);
                if (value === 'NotAllowed') set('overReceiptTolerancePercent', 0);
              }}
              options={[
                { value: 'NotAllowed', label: t('policy.overReceiptOptions.notAllowed') },
                { value: 'WithinTolerance', label: t('policy.overReceiptOptions.withinTolerance') },
                { value: 'ApprovalRequired', label: t('policy.overReceiptOptions.approvalRequired') },
              ]}
            />
          </Field>
          <Field label={t('policy.fields.overReceiptTolerance')} guideKey="overReceiptTolerancePercent" value={form.overReceiptTolerancePercent} currentValue={`%${form.overReceiptTolerancePercent}`}>
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
          <Field label={t('policy.fields.inventoryAvailability')} guideKey="inventoryAvailabilityPolicy" value={form.inventoryAvailabilityPolicy}>
            <AppDropdown
              value={form.inventoryAvailabilityPolicy}
              onValueChange={(value) => set('inventoryAvailabilityPolicy', value)}
              options={[
                { value: 'Immediate', label: t('policy.inventoryAvailabilityOptions.immediate') },
                { value: 'AfterReceiptApproval', label: t('policy.inventoryAvailabilityOptions.afterReceiptApproval') },
                { value: 'AfterQualityApproval', label: t('policy.inventoryAvailabilityOptions.afterQualityApproval') },
                { value: 'AfterAllApprovals', label: t('policy.inventoryAvailabilityOptions.afterAllApprovals') },
              ]}
            />
          </Field>
          <Field label={t('policy.fields.erpPosting')} guideKey="erpPostingPolicy" value={form.erpPostingPolicy}>
            <AppDropdown
              value={form.erpPostingPolicy}
              onValueChange={(value) => set('erpPostingPolicy', value)}
              options={[
                { value: 'AfterReceipt', label: t('policy.erpPostingOptions.afterReceipt') },
                { value: 'AfterReceiptApproval', label: t('policy.erpPostingOptions.afterReceiptApproval') },
                { value: 'AfterQualityApproval', label: t('policy.erpPostingOptions.afterQualityApproval') },
                { value: 'AfterAllApprovals', label: t('policy.erpPostingOptions.afterAllApprovals') },
              ]}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle guideKey="allowUnderReceipt" label={t('policy.toggles.allowUnderReceipt')} value={form.allowUnderReceipt} set={(value) => set('allowUnderReceipt', value)} />
          <Toggle guideKey="requireShortCloseApproval" label={t('policy.toggles.requireShortCloseApproval')} value={form.requireShortCloseApproval} set={(value) => set('requireShortCloseApproval', value)} />
          <Toggle guideKey="requireReceiptApproval" label={t('policy.toggles.requireReceiptApproval')} value={form.requireReceiptApproval} set={(value) => set('requireReceiptApproval', value)} />
          <Toggle guideKey="requireQualityApproval" label={t('policy.toggles.requireQualityApproval')} value={form.requireQualityApproval} set={(value) => set('requireQualityApproval', value)} />
          <Toggle guideKey="requireErpApproval" label={t('policy.toggles.requireErpApproval')} value={form.requireErpApproval} set={(value) => set('requireErpApproval', value)} />
          <Toggle guideKey="holdInventoryUntilQualityDecision" label={t('policy.toggles.holdInventoryUntilQualityDecision')} value={form.holdInventoryUntilQualityDecision} set={(value) => set('holdInventoryUntilQualityDecision', value)} />
          <Toggle guideKey="blockPutawayUntilQualityDecision" label={t('policy.toggles.blockPutawayUntilQualityDecision')} value={form.blockPutawayUntilQualityDecision} set={(value) => set('blockPutawayUntilQualityDecision', value)} />
          <Toggle guideKey="allowOrderlessReceipt" label={t('policy.toggles.allowOrderlessReceipt')} value={form.allowOrderlessReceipt} set={(value) => set('allowOrderlessReceipt', value)} />
          <Toggle guideKey="allowUnplannedReceipt" label={t('policy.toggles.allowUnplannedReceipt')} value={form.allowUnplannedReceipt} set={(value) => set('allowUnplannedReceipt', value)} />
        </div>

        <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
          {t('policy.hint')}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('policy.save')}
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children, guideKey, value, currentValue }: { label: string; children: ReactNode; guideKey?: string; value?: unknown; currentValue?: string }) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {guideKey ? <ParameterFieldGuide guidance={parameterGuidance('inbound', guideKey, value)} currentValue={currentValue ?? String(value)} /> : null}
    </div>
  );
}

function Toggle({ label, value, set, guideKey }: { label: string; value: boolean; set: (value: boolean) => void; guideKey: string }) {
  return <ParameterToggleCard title={label} checked={value} onCheckedChange={set} guidance={parameterGuidance('inbound', guideKey, value)} />;
}
