import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { localizeEnumValue } from '@/lib/enum-localization';
import { useAuthStore } from '@/stores/auth-store';
import { qualityApi, type QualityParameter } from '../api/quality.api';

export function QualitySettingsPage() {
  const { t } = useModuleTranslation('quality');
  const branch = useAuthStore((s) => s.branch?.code ?? '0');
  const [form, setForm] = useState<QualityParameter | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    qualityApi.getParameters(branch).then(setForm).catch((e) => toast.error(e.message));
  }, [branch]);

  const set = <K extends keyof QualityParameter>(k: K, v: QualityParameter[K]) =>
    setForm((x) => (x ? { ...x, [k]: v } : x));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(await qualityApi.updateParameters(form));
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
      <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('settings.defaultInspectionModeLabel')}>
            <AppDropdown
              value={form.defaultInspectionMode}
              onValueChange={(v) => set('defaultInspectionMode', v)}
              options={['NoCheck', 'QuickCheck', 'InspectionRequired'].map((value) => ({
                value,
                label: localizeEnumValue(value),
              }))}
            />
          </Field>
          <Field label={t('settings.defaultFailActionLabel')}>
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
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <LocationField
              label={t('settings.locationsSection.qualityLocationLabel')}
              placeholder={t('settings.locationsSection.locationPlaceholder')}
              branch={branch}
              value={form.defaultQualityLocationId}
              set={(value) => set('defaultQualityLocationId', value)}
            />
            <LocationField
              label={t('settings.locationsSection.quarantineLocationLabel')}
              placeholder={t('settings.locationsSection.locationPlaceholder')}
              branch={branch}
              value={form.defaultQuarantineLocationId}
              set={(value) => set('defaultQuarantineLocationId', value)}
              quarantineOnly
            />
            <LocationField
              label={t('settings.locationsSection.rejectLocationLabel')}
              placeholder={t('settings.locationsSection.locationPlaceholder')}
              branch={branch}
              value={form.defaultRejectLocationId}
              set={(value) => set('defaultRejectLocationId', value)}
              quarantineOnly
            />
          </div>
        </section>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle label={t('settings.toggles.autoCreateInspection')} value={form.autoCreateInspectionOnReceipt} set={(v) => set('autoCreateInspectionOnReceipt', v)} />
          <Toggle label={t('settings.toggles.holdInventory')} value={form.holdInventoryUntilDecision} set={(v) => set('holdInventoryUntilDecision', v)} />
          <Toggle label={t('settings.toggles.blockPutaway')} value={form.blockPutawayUntilDecision} set={(v) => set('blockPutawayUntilDecision', v)} />
          <Toggle label={t('settings.toggles.blockErpPosting')} value={form.blockErpPostingUntilDecision} set={(v) => set('blockErpPostingUntilDecision', v)} />
          <Toggle label={t('settings.toggles.requireManagerApproval')} value={form.requireManagerApprovalForRelease} set={(v) => set('requireManagerApprovalForRelease', v)} />
          <Toggle label={t('settings.toggles.allowPartialDecision')} value={form.allowPartialDecision} set={(v) => set('allowPartialDecision', v)} />
          <Toggle label={t('settings.toggles.allowDirectReceipt')} value={form.allowDirectReceiptWhenNoRule} set={(v) => set('allowDirectReceiptWhenNoRule', v)} />
          <Toggle label={t('settings.toggles.blockWhenLotMissing')} value={form.blockReceiptWhenLotMissing} set={(v) => set('blockReceiptWhenLotMissing', v)} />
          <Toggle label={t('settings.toggles.blockWhenSerialMissing')} value={form.blockReceiptWhenSerialMissing} set={(v) => set('blockReceiptWhenSerialMissing', v)} />
          <Toggle label={t('settings.toggles.blockWhenExpiryMissing')} value={form.blockReceiptWhenExpiryMissing} set={(v) => set('blockReceiptWhenExpiryMissing', v)} />
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, set }: { label: string; value: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="size-4" />
    </label>
  );
}

function LocationField({
  label,
  placeholder,
  branch,
  value,
  set,
  quarantineOnly = false,
}: {
  label: string;
  placeholder: string;
  branch: string;
  value: number | null;
  set: (value: number | null) => void;
  quarantineOnly?: boolean;
}) {
  return (
    <Field label={label}>
      <PagedAppDropdown
        queryKey={['quality-locations', branch, label]}
        fetchPage={(request) => qualityApi.locations(request, branch)}
        toOption={(location) => ({
          value: String(location.id),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.locationType,
          disabled: quarantineOnly && !location.isQuarantine,
        })}
        value={value ? String(value) : null}
        onValueChange={(next) => set(next ? Number(next) : null)}
        placeholder={placeholder}
        searchable
      />
    </Field>
  );
}
